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
import { gunzipSync } from "node:zlib";
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

// Remote mode checks an already running deployment, such as the built container in CI:
// MTKIT_SMOKE_URL=http://localhost:8080/mcp MTKIT_SMOKE_TOKEN=... MTKIT_SMOKE_PUBLIC_URL=https://localhost/mcp
if (process.env.MTKIT_SMOKE_URL) {
  const address = new URL(process.env.MTKIT_SMOKE_URL);
  const publicOrigin = new URL(process.env.MTKIT_SMOKE_PUBLIC_URL ?? address.href).origin;
  const remoteToken = process.env.MTKIT_SMOKE_TOKEN;
  const headers = remoteToken ? { authorization: `Bearer ${remoteToken}` } : {};
  if (remoteToken) {
    assert.equal((await fetch(address)).status, 401, "The deployment must require the bearer token");
    assert.equal((await fetch(new URL("/skills/design-screen.tar.gz", address))).status, 401);
  }
  assert.equal((await fetch(new URL("/healthz", address))).status, 200);
  const remote = new Client({ name: "mtkit-remote-smoke", version: "1.0.0" });
  await remote.connect(new StreamableHTTPClientTransport(address, { requestInit: { headers } }));
  try {
    await checkCatalog(remote);
    await checkArchives(remote, address, { origin: publicOrigin, bearer: Boolean(remoteToken), headers });
    // The image prepares the pinned external skills, so a third-party skill must be served in full.
    const external = await remote.callTool({ name: "install_skills", arguments: { id: "accessibility", client: "claude-code" } });
    assert(!external.isError, "External skills must be in the deployed skill pack");
    assert(external.structuredContent.install.archive, "External skills must be downloadable from the deployment");
    const archive = await fetch(new URL("/skills/design-taste-frontend.tar.gz", address), { headers });
    assert.equal(archive.status, 200);
    assert((await archive.arrayBuffer()).byteLength > 1_000_000, "Heavy skills must include their assets");
  } finally {
    await remote.close();
  }
  console.log(`Remote ${address.origin}: catalog, prompts, install_skills, archives, licenses and authorization passed`);
  process.exit(0);
}

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
  [["--hosted"], { MTKIT_PUBLIC_URL: "https://mcp.example/mcp", MTKIT_MCP_TOKEN: `${"a".repeat(32)},short` }, /MTKIT_MCP_TOKEN/],
  [["--hosted"], { MTKIT_PUBLIC_URL: "https://mcp.example/mcp", MTKIT_MCP_TOKEN: `${"a".repeat(32)},` }, /MTKIT_MCP_TOKEN/],
  [["--hosted"], { MTKIT_PUBLIC_URL: "https://mcp.example/mcp", MTKIT_MCP_TOKEN: Array(9).fill("a".repeat(32)).join(",") }, /MTKIT_MCP_TOKEN/],
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
  assert.match(client.getInstructions() ?? "", /install_skills/);
  assert(client.getServerCapabilities()?.tools);
  assert(client.getServerCapabilities()?.resources);
  assert(client.getServerCapabilities()?.prompts);
  const prompts = await client.listPrompts();
  assert.deepEqual(prompts.prompts.map(({ name }) => name).sort(), ["install", "pick", "setup", "update"]);
  const setupPrompt = await client.getPrompt({ name: "setup", arguments: { client: "cursor", task: "CRM на React" } });
  const setupText = setupPrompt.messages[0].content.text;
  for (const tool of ["bootstrap_project", "recommend_tools", "install_skills", "plan_install"]) assert.match(setupText, new RegExp(tool));
  assert.match(setupText, /client "cursor"/);
  assert.match(setupText, /Install nothing before I answer/);
  assert.match((await client.getPrompt({ name: "setup", arguments: {} })).messages[0].content.text, /client "claude-code"/);
  const installPrompt = (await client.getPrompt({ name: "install", arguments: { id: "design-screen" } })).messages[0].content.text;
  assert.match(installPrompt, /library-docs, review-screen/);
  assert.match((await client.getPrompt({ name: "install", arguments: { id: "no-such-entry" } })).messages[0].content.text, /search_entries/);
  assert.match((await client.getPrompt({ name: "pick", arguments: { task: "a11y review" } })).messages[0].content.text, /Do not install anything/);
  await assert.rejects(client.getPrompt({ name: "setup", arguments: { client: "unsupported" } }));
  assert.match((await client.getPrompt({ name: "update", arguments: {} })).messages[0].content.text, /check_skills/);
  const completion = await client.complete({ ref: { type: "ref/prompt", name: "install" }, argument: { name: "id", value: "design" } });
  assert.equal(completion.completion.values[0], "design-screen", "install suggests catalog IDs, prefix matches first");
  assert(completion.completion.values.every(id => catalogEntries.some(entry => entry.id === id)));
  const playwrightCompletion = await client.complete({ ref: { type: "ref/prompt", name: "install" }, argument: { name: "id", value: "Playwright" } });
  assert(playwrightCompletion.completion.values.includes("playwright"), "Completion matches names case-insensitively");
  const listing = await client.listTools();
  assert.deepEqual(listing.tools.map(({ name }) => name).sort(), ["bootstrap_project", "check_skills", "get_entry", "get_skill", "install_skills", "list_categories", "plan_install", "recommend_tools", "search_entries"]);
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
    for (const { kind, installWith } of recommendations) assert.equal(installWith, kind === "skill" ? "install_skills" : "plan_install");
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

  for (const [target, directory] of [["claude-code", ".claude/skills"], ["cursor", ".cursor/skills"], ["vscode", ".github/skills"]]) {
    const response = await client.callTool({ name: "install_skills", arguments: { id: "design-screen", client: target } });
    assert(!response.isError, `install_skills failed for ${target}`);
    const { install } = response.structuredContent;
    assert.equal(install.targetDirectory, `${directory}/design-screen`);
    assert.equal(install.files[0].path, "SKILL.md");
    assert.match(install.files[0].content, /@mtkit\/ui/);
    assert.equal(install.page.nextOffset, null);
    assert.equal(install.files.length, install.page.total);
    assert.deepEqual(install.companionSkills, ["library-docs", "review-screen"]);
    assert.match(install.version, /^[a-f0-9]{16}$/);
    assert.equal(install.manifest.path, `${directory}/design-screen/.mtkit-skill.json`);
    assert.equal(JSON.parse(install.manifest.content).version, install.version);
    const check = (await client.callTool({ name: "check_skills", arguments: { client: target, installed: [
      { id: "design-screen", version: install.version },
      { id: "review-screen", version: "0000000000000000" },
      { id: "claude-dual-review-file-based", version: "0000000000000000" },
      { id: "context7", version: "0000000000000000" },
    ] } })).structuredContent;
    assert.deepEqual(check.skills.map(({ status }) => status), ["current", "outdated", "unavailable", "unavailable"]);
    assert.match(check.skills[1].update, new RegExp(`client "${target}"`));
    assert.deepEqual(check.summary, { current: 1, outdated: 1, unavailable: 2 });
    assert(install.files.every(({ path }) => !path.startsWith("/") && !path.includes("..")));
    const text = response.content.filter(({ type }) => type === "text").map(({ text }) => text).join("\n");
    assert.match(text, /"SKILL\.md"/, "Clients that only read text content must receive the files");
  }
  for (const arguments_ of [
    { id: "context7", client: "claude-code" },
    { id: "no-such-catalog-entry", client: "claude-code" },
    { id: "design-screen", client: "codex" },
    { id: "design-screen", client: "claude-code", offset: 999 },
    { id: "claude-dual-review-file-based", client: "claude-code" },
  ]) {
    const result = await client.callTool({ name: "install_skills", arguments: arguments_ });
    assert.equal(result.isError, true, `Invalid install request must fail: ${JSON.stringify(arguments_)}`);
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
  const stdioInstall = await stdioClient.callTool({ name: "install_skills", arguments: { id: "design-screen", client: "claude-code" } });
  assert.equal(stdioInstall.structuredContent.install.archive, undefined, "stdio has no download endpoint, so files must come through the tool");
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
  const logged = [];
  lines.on("line", line => logged.push(line));
  const httpClient = new Client({ name: "mtkit-http-smoke", version: "1.0.0" });
  try {
    const [startup] = await once(lines, "line", { signal: AbortSignal.timeout(5_000) });
    const address = /http:\/\/(?:0\.0\.0\.0|127\.0\.0\.1):(\d+)\/mcp/.exec(startup);
    assert(address && startup.includes("listening"), startup);
    await check(new URL(`http://127.0.0.1:${address[1]}/mcp`), httpClient, logged);
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

async function checkArchives(client, address, { origin, bearer, headers }) {
  const response = await client.callTool({ name: "install_skills", arguments: { id: "design-screen", client: "claude-code" } });
  const { archive } = response.structuredContent.install;
  assert.equal(archive.url, origin + "/skills/design-screen.tar.gz");
  assert.equal(archive.authorization, bearer ? "bearer" : "none");
  assert.equal(archive.extractDirectory, ".claude/skills");
  assert.match(archive.commands.posix, /curl -fsSL/);
  assert.match(archive.commands.powershell, /curl\.exe/);
  assert.equal(archive.commands.posix.includes("MTKIT_MCP_TOKEN"), bearer, "The command must reference the token variable, never the secret");
  assert(!JSON.stringify(response.structuredContent).includes(headers?.authorization?.slice(7) ?? "no-token"));

  const url = new URL("/skills/design-screen.tar.gz", address);
  const download = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
  assert.equal(download.status, 200);
  assert.equal(download.headers.get("content-type"), "application/gzip");
  assert.equal(download.headers.get("cache-control"), "no-store");
  const bytes = Buffer.from(await download.arrayBuffer());
  assert(bytes[0] === 0x1f && bytes[1] === 0x8b, "Archive must be gzip");
  const tar = gunzipSync(bytes).toString("latin1");
  assert(tar.includes("design-screen/.mtkit-skill.json") && tar.includes('"source": "mtkit-catalog"'), "Archives carry the install manifest");
  assert.equal((await fetch(url, { method: "HEAD", headers })).status, 200);
  for (const path of ["/skills/context7.tar.gz", "/skills/no-such-skill.tar.gz", "/skills/design-screen.zip", "/skills/..%2f..%2fpackage.json"]) {
    assert.equal((await fetch(new URL(path, address), { headers })).status, 404, path);
  }
  assert.equal((await fetch(url, { method: "POST", headers })).status, 404, "Archives are read-only");
  assert.equal((await fetch(new URL("/skills/claude-dual-review-file-based.tar.gz", address), { headers })).status, 404, "Unlicensed skills are never served");
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
  await checkArchives(client, address, { origin: new URL(address).origin, bearer: false });
  const parallelResults = await Promise.all(catalogEntries.slice(0, 8).map(({ id }) => client.callTool({ name: "get_entry", arguments: { id } })));
  assert.deepEqual(parallelResults.map(({ structuredContent }) => structuredContent.entry.id), catalogEntries.slice(0, 8).map(({ id }) => id));
  assert.equal((await fetch(address, { headers: { origin: "https://unrelated.example" } })).status, 403);
  assert.equal(await requestStatus(address, { host: "unrelated.example" }), 403);
  assert.equal((await fetch(new URL("/healthz", address), { method: "HEAD" })).status, 200);
  const health = await (await fetch(new URL("/healthz", address))).json();
  assert.equal(health.status, "ok");
  assert.match(health.version, /^\d+\.\d+\.\d+$/);
  assert.equal(health.archives, true);
  assert.equal((await fetch(new URL("/missing", address))).status, 404);
  console.log("Loopback HTTP: request validation, concurrent tools, health, Host and Origin guards passed");
});

const host = "127.0.0.1";
const token = randomBytes(32).toString("hex");
const previousToken = randomBytes(32).toString("hex");
await withHttpServer(["--hosted"], {
  PORT: "0",
  MTKIT_PUBLIC_URL: `https://${host}/mcp`,
  MTKIT_MCP_TOKEN: `${token}, ${previousToken}`,
}, async (address, client, logged) => {
  assert.notEqual(await requestStatus(address, { host, authorization: `Bearer ${previousToken}` }), 401, "Every configured token is accepted during rotation");
  assert.equal(await requestStatus(address, { host, authorization: `Bearer ${token},${previousToken}` }), 401, "A token list is never a valid credential");
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
  assert.equal((await fetch(new URL("/skills/design-screen.tar.gz", address))).status, 401, "Archives require the bearer token");
  assert.equal((await fetch(new URL("/skills/design-screen.tar.gz", address), { headers: { authorization: `Bearer ${"0".repeat(64)}` } })).status, 401);
  assert.equal(await requestStatus(new URL("/skills/design-screen.tar.gz", address), { host: "unrelated.example", authorization: `Bearer ${token}` }), 403);
  await checkArchives(client, address, { origin: `https://${host}`, bearer: true, headers: { authorization: `Bearer ${token}` } });
  const events = logged.filter(line => line.startsWith("{")).map(line => JSON.parse(line));
  assert(events.some(({ event, tool, ok }) => event === "tool" && tool === "install_skills" && ok), "Tool calls are logged");
  assert(events.some(({ event, token }) => event === "request" && token === 1), "Logs show which configured token was used");
  assert(events.some(({ event, skill }) => event === "archive" && skill === "design-screen"));
  assert(events.some(({ event }) => event === "unauthorized"));
  assert(!logged.some(line => line.includes(token) || line.includes(previousToken)), "Logs never contain tokens");
  console.log("Hosted HTTP: health, Host and Origin guards, bearer authorization, inventory parity, and tools passed");
});

await withHttpServer(["--hosted"], {
  PORT: "0",
  MTKIT_PUBLIC_URL: `https://${host}/mcp`,
  MTKIT_MCP_TOKEN: token,
  MTKIT_RATE_LIMIT: "12",
}, async (address, _client, logged) => {
  const headers = { host, authorization: `Bearer ${token}` };
  assert.equal(await requestStatus(new URL("/skills/design-screen.tar.gz", address), headers), 200, "An archive costs ten requests");
  const statuses = [];
  for (let index = 0; index < 4; index++) statuses.push(await requestStatus(address, headers));
  assert.deepEqual(statuses.map(status => status === 429), [false, false, true, true]);
  assert.equal(await requestStatus(address, { host }), 401, "Missing tokens are rejected before rate limiting");
  assert(logged.some(line => line.includes('"rate_limited"')));
  console.log("Rate limit: per-token budget, archive cost and 429 passed");
});
