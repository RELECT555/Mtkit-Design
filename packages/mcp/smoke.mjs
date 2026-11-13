import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { copyFile, mkdtemp, readdir, realpath, rm } from "node:fs/promises";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { build } from "esbuild";

const executable = fileURLToPath(new URL("../../plugins/mtkit-design/dist/catalog.cjs", import.meta.url));
const catalog = await build({
  entryPoints: [fileURLToPath(new URL("../catalog/index.ts", import.meta.url))],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const { catalogCategories, catalogCounts, catalogEntries } = await import(
  `data:text/javascript;base64,${Buffer.from(catalog.outputFiles[0].contents).toString("base64")}`
);

// Fail closed before accepting connections, including when the parent environment
// happens to contain valid deployment credentials.
for (const [args, overrides, expected] of [
  [["--unsupported"], {}, /Usage:/],
  [["--http", "--port", "65536"], {}, /Usage:/],
  [["--hosted"], {}, /MTKIT_PUBLIC_URL/],
  [["--hosted"], { MTKIT_PUBLIC_URL: "http://mcp.example/mcp" }, /MTKIT_PUBLIC_URL/],
  [["--hosted"], { MTKIT_PUBLIC_URL: "https://mcp.example/mcp/" }, /MTKIT_PUBLIC_URL/],
  [["--hosted"], { MTKIT_PUBLIC_URL: "https://mcp.example/mcp" }, /MTKIT_MCP_TOKEN/],
  [["--hosted"], { MTKIT_PUBLIC_URL: "https://mcp.example/mcp", MTKIT_MCP_TOKEN: "short" }, /MTKIT_MCP_TOKEN/],
  [["--hosted"], { PORT: "65536" }, /PORT/],
]) {
  const result = spawnSync(process.execPath, [executable, ...args], {
    env: { ...process.env, MTKIT_PUBLIC_URL: "", MTKIT_MCP_TOKEN: "", PORT: "0", ...overrides },
    encoding: "utf8",
    timeout: 5_000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 1, `Invalid configuration must stop startup: ${JSON.stringify(args)}`);
  assert.match(result.stderr, expected);
  assert.equal(result.stdout, "", "Startup diagnostics must not corrupt stdio MCP output");
}
console.log("Startup: invalid CLI, endpoint, token, and port fail closed");

async function checkCatalog(client) {
  assert.match(client.getInstructions() ?? "", /recommend_tools/);
  assert.match(client.getInstructions() ?? "", /get_skill/);
  assert.match(client.getInstructions() ?? "", /bootstrap_project/);
  assert(client.getServerCapabilities()?.tools);
  assert(client.getServerCapabilities()?.resources);
  const listing = await client.listTools();
  assert.deepEqual(listing.tools.map(({ name }) => name).sort(), ["bootstrap_project", "get_entry", "get_skill", "list_categories", "plan_install", "recommend_tools", "search_entries"]);
  const bootstrapTool = listing.tools.find(({ name }) => name === "bootstrap_project");
  assert.equal(bootstrapTool.annotations?.readOnlyHint, true, "Remote bootstrap returns a client-side plan rather than writing project files");
  assert.equal(bootstrapTool.annotations?.destructiveHint, false);

  for (const [target, instructionFile] of [
    ["codex", "AGENTS.md"], ["claude-code", "CLAUDE.md"], ["cursor", "AGENTS.md"], ["vscode", ".github/copilot-instructions.md"],
  ]) {
    const response = await client.callTool({ name: "bootstrap_project", arguments: { client: target } });
    assert(!response.isError);
    const { setup: plan } = response.structuredContent;
    assert.equal(plan.client, target);
    assert.equal(plan.instructionFile, instructionFile);
    assert.match(plan.content, /recommend_tools/);
    assert.match(plan.content, /get_skill/);
    assert.match(plan.content, /@mtkit\/ui/);
    assert(plan.markerStart && plan.markerEnd && plan.markerStart !== plan.markerEnd);
    const repeat = await client.callTool({ name: "bootstrap_project", arguments: { client: target } });
    assert.deepEqual(repeat.structuredContent, response.structuredContent, "Bootstrap plan must remain stable across repeated connections");
  }
  const invalidBootstrap = await client.callTool({ name: "bootstrap_project", arguments: { client: "unsupported" } });
  assert.equal(invalidBootstrap.isError, true);

  const uri = "mtkit://catalog/inventory";
  const listed = await client.listResources();
  assert(listed.resources.some((resource) => resource.uri === uri));
  const inventory = JSON.parse((await client.readResource({ uri })).contents[0].text);
  assert.deepEqual(inventory.entries, catalogEntries);
  assert.deepEqual(inventory.categories, catalogCategories);
  assert.deepEqual(inventory.counts, catalogCounts);
  const categories = await client.callTool({ name: "list_categories", arguments: {} });
  assert.deepEqual(categories.structuredContent.categories, catalogCategories);
  assert.deepEqual(categories.structuredContent.counts, catalogCounts);
  const optional = await client.callTool({ name: "search_entries", arguments: { kind: "mcp", availability: "optional" } });
  assert.equal(optional.structuredContent.entries.length, catalogCounts.optional);
  assert(optional.structuredContent.entries.every((entry) => entry.availability === "optional"));

  const search = await client.callTool({ name: "search_entries", arguments: { query: "документация React", kind: "mcp", limit: 2 } });
  assert.equal(search.structuredContent.entries[0].id, "context7");

  const recommend = async (task) => {
    const result = await client.callTool({ name: "recommend_tools", arguments: { task } });
    assert(!result.isError);
    assert.equal(result.structuredContent.projectSetup.tool, "bootstrap_project");
    const { recommendations } = result.structuredContent;
    assert.equal(new Set(recommendations.map(({ id }) => id)).size, recommendations.length);
    for (const { id, name, kind, reason } of recommendations) {
      assert(catalogEntries.some((entry) => entry.id === id && entry.name === name && entry.kind === kind));
      assert(reason);
    }
    return recommendations.map(({ id }) => id);
  };
  for (const [task, primary, companion] of [
    ["Сделай мини CRM для записи поставщиков и других удобных вещей", "design-screen", "playwright"],
    ["Проверь, можно ли с клавиатуры добавить поставщика на телефоне. Только ревью.", "review-screen", "playwright"],
    ["Find the current API documentation for React useEffect", "library-docs", "context7"],
  ]) {
    const recommendations = await recommend(task);
    assert.equal(recommendations[0], primary, task);
    assert(recommendations.includes(companion), task);
  }
  assert.deepEqual(await recommend("Переведи описание договора на английский"), []);
  const emptyTask = await client.callTool({ name: "recommend_tools", arguments: { task: " " } });
  assert.equal(emptyTask.isError, true);

  const details = await client.callTool({ name: "get_entry", arguments: { id: "context7" } });
  assert.equal(details.structuredContent.entry.id, "context7");
  assert(details.structuredContent.entry.sourceUrl);

  const skill = await client.callTool({ name: "get_skill", arguments: { id: "design-screen" } });
  assert(!skill.isError);
  assert.match(skill.content.filter(({ type }) => type === "text").map(({ text }) => text).join("\n"), /@mtkit\/ui/);
  const reference = await client.callTool({ name: "get_skill", arguments: { id: "design-screen", path: "references/mtkit.md" } });
  assert(!reference.isError);
  assert.match(reference.content.filter(({ type }) => type === "text").map(({ text }) => text).join("\n"), /pkgs\.dev\.azure\.com/);
  for (const arguments_ of [
    { id: "context7" },
    { id: "no-such-catalog-entry" },
    { id: "design-screen", path: "../../.env" },
    { id: "design-screen", path: "references/missing.md" },
  ]) {
    const result = await client.callTool({ name: "get_skill", arguments: arguments_ });
    assert.equal(result.isError, true, `Invalid skill request must fail: ${JSON.stringify(arguments_)}`);
  }

  const plan = await client.callTool({ name: "plan_install", arguments: { id: "context7" } });
  assert.equal(plan.structuredContent.plan.client, "codex");
  assert.deepEqual(plan.structuredContent.plan.steps[0].args, ["mcp", "add", "context7", "--url", "https://mcp.context7.com/mcp"]);

  const getPlan = async (id, target) => (await client.callTool({ name: "plan_install", arguments: { id, client: target } })).structuredContent.plan;
  for (const [target, configPath, skillDir] of [
    ["claude-code", ".mcp.json", ".claude/skills"],
    ["cursor", ".cursor/mcp.json", ".cursor/skills"],
    ["vscode", ".mcp.json", ".github/skills"],
  ]) {
    const catalogPlan = await getPlan("mtkit-catalog", target);
    assert.equal(catalogPlan.client, target);
    assert.equal(catalogPlan.scope, "project");
    assert.equal(catalogPlan.configuration.path, configPath);
    assert.deepEqual(catalogPlan.configuration.content.mcpServers.mtkit_catalog, {
      type: "http", url: "http://127.0.0.1:4387/mcp", ...(target === "vscode" && { tools: ["*"] }),
    });
    assert.deepEqual(catalogPlan.steps.map(({ args }) => args), [["ci"], ["run", "catalog:build"], ["run", "catalog:serve"]]);

    const playwright = await getPlan("playwright", target);
    assert.equal(playwright.configuration.path, configPath);
    assert.equal(playwright.configuration.content.mcpServers.playwright.type, "stdio");
    assert(playwright.configuration.content.mcpServers.playwright.args.includes("--isolated"));

    const localSkill = await getPlan("design-screen", target);
    assert.deepEqual(localSkill.steps, []);
    assert.equal(localSkill.copySkill.to, `${skillDir}/design-screen/`);
    assert.deepEqual(localSkill.companionSkills, [
      { from: "plugins/mtkit-design/skills/library-docs/", to: `${skillDir}/library-docs/` },
      { from: "plugins/mtkit-design/skills/review-screen/", to: `${skillDir}/review-screen/` },
    ]);
    const externalSkill = await getPlan("accessibility", target);
    assert.deepEqual(externalSkill.steps[0].args, ["scripts/install.mjs", "--prepare-only"]);
    assert.equal(externalSkill.copySkill.to, `${skillDir}/accessibility/`);
  }
  const invalidClient = await client.callTool({ name: "plan_install", arguments: { id: "context7", client: "unsupported" } });
  assert.equal(invalidClient.isError, true);

  const page = async (offset = 0) => (await client.callTool({ name: "search_entries", arguments: { kind: "skill", limit: 2, offset } })).structuredContent;
  const first = await page();
  assert.equal(first.nextOffset, 2);
  assert.equal(first.total, catalogCounts.skills);
  const second = await page(first.nextOffset);
  assert.equal(second.entries.length, 2);
  assert(first.entries.every(({ id }) => second.entries.every((entry) => entry.id !== id)));
  const last = await page(first.total - 1);
  assert.equal(last.entries.length, 1);
  assert.equal(last.total, first.total);
  assert.equal(last.nextOffset, null);

  const unknown = await client.callTool({ name: "get_entry", arguments: { id: "no-such-catalog-entry" } });
  assert.equal(unknown.isError, true);
  const invalid = await client.callTool({ name: "search_entries", arguments: { limit: 500 } });
  assert.equal(invalid.isError, true);

  for (const [query, kind, id] of [
    ["доступность", "skill", "accessibility"],
    ["next-devtools", "mcp", "next-devtools"],
    ["chrome-devtools", "mcp", "chrome-devtools"],
    ["shadcn", "skill", "shadcn"],
    ["mtkit-catalog", "mcp", "mtkit-catalog"],
  ]) {
    const result = await client.callTool({ name: "search_entries", arguments: { query, kind, limit: 10 } });
    assert(result.structuredContent.entries.some((entry) => entry.id === id), `No match for ${query}`);
    const details = await client.callTool({ name: "get_entry", arguments: { id } });
    assert.equal(details.structuredContent.entry.kind, kind);
    assert(details.structuredContent.entry.access);
    const install = await client.callTool({ name: "plan_install", arguments: { id, client: "codex" } });
    assert.equal(install.structuredContent.plan.entryId, id);
    assert(install.structuredContent.plan.steps.length);
  }
}

const stdioClient = new Client({ name: "mtkit-stdio-smoke", version: "1.0.0" });
const temporaryRoot = await realpath(tmpdir());
const standalone = await mkdtemp(join(temporaryRoot, "mtkit-standalone-smoke-"));
try {
  const standaloneExecutable = join(standalone, "catalog.cjs");
  await copyFile(executable, standaloneExecutable);
  await stdioClient.connect(new StdioClientTransport({ command: process.execPath, args: [standaloneExecutable], cwd: standalone, stderr: "inherit" }));
  await checkCatalog(stdioClient);
  assert.deepEqual(await readdir(standalone), ["catalog.cjs"], "Bootstrap must not create project rules on the server filesystem");
  console.log("Standalone stdio: bootstrap without server writes, initialization guidance, inventory, recommendations, skill references, install plans, and validation passed");
} finally {
  try {
    await stdioClient.close();
  } finally {
    assert.equal(dirname(await realpath(standalone)), temporaryRoot);
    await rm(standalone, { recursive: true, force: true });
  }
}

async function withHttpServer(args, env, check) {
  const child = spawn(process.execPath, [executable, ...args], {
    env: { ...process.env, ...env },
    stdio: ["ignore", "inherit", "pipe"],
  });
  const stopped = once(child, "exit");
  const lines = createInterface({ input: child.stderr });
  const httpClient = new Client({ name: "mtkit-http-smoke", version: "1.0.0" });
  try {
    const [startup] = await once(lines, "line", { signal: AbortSignal.timeout(5_000) });
    const address = /http:\/\/(?:0\.0\.0\.0|127\.0\.0\.1):(\d+)\/mcp/.exec(startup);
    assert(address && startup.includes("listening"), startup);
    await check(new URL(`http://127.0.0.1:${address[1]}/mcp`), httpClient);
  } finally {
    try {
      await httpClient.close();
    } finally {
      lines.close();
      child.kill();
      await stopped;
    }
  }
}

async function checkHttpValidation(address, extraHeaders = {}) {
  const headers = { accept: "application/json, text/event-stream", "content-type": "application/json", ...extraHeaders };
  const post = (body, additionalHeaders = {}) => fetch(address, {
    method: "POST", headers: { ...headers, ...additionalHeaders }, body,
    signal: AbortSignal.timeout(5_000),
  });
  const malformed = await post("{");
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).error.code, -32700);

  const oversized = await post(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: { padding: "x".repeat(70 * 1024) } }));
  assert.equal(oversized.status, 413);
  await oversized.text();

  const unsupportedVersion = await post(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }), { "MCP-Protocol-Version": "1900-01-01" });
  assert.equal(unsupportedVersion.status, 400);
  await unsupportedVersion.text();
  const unsupportedMethod = await fetch(address, { method: "PUT", headers, signal: AbortSignal.timeout(5_000) });
  assert.equal(unsupportedMethod.status, 405);
  await unsupportedMethod.text();
}

function requestStatus(url, headers) {
  return new Promise((resolve, reject) => {
    const req = request(url, { headers, signal: AbortSignal.timeout(5_000) }, (response) => {
      response.resume();
      resolve(response.statusCode);
    });
    req.on("error", reject).end();
  });
}

await withHttpServer(["--http", "--port", "0"], {}, async (address, client) => {
  await checkHttpValidation(address);
  await client.connect(new StreamableHTTPClientTransport(address));
  await checkCatalog(client);
  const parallelResults = await Promise.all(catalogEntries.slice(0, 8).map(({ id }) => client.callTool({ name: "get_entry", arguments: { id } })));
  assert.deepEqual(parallelResults.map(({ structuredContent }) => structuredContent.entry.id), catalogEntries.slice(0, 8).map(({ id }) => id));
  assert.equal((await fetch(address, { headers: { origin: "https://unrelated.example" } })).status, 403);
  assert.equal(await requestStatus(address, { host: "unrelated.example" }), 403);
  assert.equal((await fetch(new URL("/healthz", address), { method: "HEAD" })).status, 200);
  assert.equal((await fetch(new URL("/missing", address))).status, 404);
  console.log("Loopback HTTP: request validation, concurrent tools, health, Host and Origin guards passed");
});

const host = "127.0.0.1";
const token = randomBytes(32).toString("hex");
await withHttpServer(["--hosted"], {
  PORT: "0",
  MTKIT_PUBLIC_URL: `https://${host}/mcp`,
  MTKIT_MCP_TOKEN: token,
}, async (address, client) => {
  assert.equal(await requestStatus(new URL("/healthz", address)), 200);
  assert.equal(await requestStatus(address, { host: "unrelated.example" }), 403);
  assert.equal(await requestStatus(address, { host }), 401);
  assert.equal(await requestStatus(address, { host, authorization: `Bearer ${"0".repeat(64)}` }), 401);
  assert.equal(await requestStatus(address, { host, origin: `http://${host}`, authorization: `Bearer ${token}` }), 403);
  const unauthorized = await fetch(address);
  assert.equal(unauthorized.headers.get("www-authenticate"), 'Bearer realm="MTKit Catalog"');
  assert.equal(unauthorized.headers.get("cache-control"), "no-store");
  const authorizedHeaders = { authorization: `Bearer ${token}`, origin: `https://${host}` };
  await checkHttpValidation(address, authorizedHeaders);
  await client.connect(new StreamableHTTPClientTransport(address, {
    requestInit: { headers: authorizedHeaders },
  }));
  await checkCatalog(client);
  console.log("Hosted HTTP: health, Host and Origin guards, bearer authorization, inventory parity, and tools passed");
});
