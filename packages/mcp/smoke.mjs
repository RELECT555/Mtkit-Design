import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { request } from "node:http";
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

async function checkCatalog(client) {
  const listing = await client.listTools();
  assert.deepEqual(listing.tools.map(({ name }) => name).sort(), ["get_entry", "list_categories", "plan_install", "search_entries"]);

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

  const details = await client.callTool({ name: "get_entry", arguments: { id: "context7" } });
  assert.equal(details.structuredContent.entry.id, "context7");
  assert(details.structuredContent.entry.sourceUrl);

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
try {
  await stdioClient.connect(new StdioClientTransport({ command: process.execPath, args: [executable], stderr: "inherit" }));
  await checkCatalog(stdioClient);
  console.log("stdio: inventory parity, search, pagination, details, plan, and validation passed");
} finally {
  await stdioClient.close();
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

await withHttpServer(["--http", "--port", "0"], {}, async (address, client) => {
  await client.connect(new StreamableHTTPClientTransport(address));
  await checkCatalog(client);
  assert.equal((await fetch(address, { headers: { origin: "https://unrelated.example" } })).status, 403);
  assert.equal((await fetch(new URL("/missing", address))).status, 404);
  console.log("Loopback HTTP: inventory parity, tools, and Origin guard passed");
});

const host = "127.0.0.1";
const token = randomBytes(32).toString("hex");
await withHttpServer(["--hosted"], {
  PORT: "0",
  MTKIT_PUBLIC_URL: `https://${host}/mcp`,
  MTKIT_MCP_TOKEN: token,
}, async (address, client) => {
  const status = (url, headers) => new Promise((resolve, reject) => {
    const req = request(url, { headers }, (response) => {
      response.resume();
      resolve(response.statusCode);
    });
    req.on("error", reject).end();
  });
  assert.equal(await status(new URL("/healthz", address)), 200);
  assert.equal(await status(address, { host: "unrelated.example" }), 403);
  assert.equal(await status(address, { host }), 401);
  assert.equal(await status(address, { host, authorization: `Bearer ${"0".repeat(64)}` }), 401);
  assert.equal(await status(address, { host, origin: `http://${host}`, authorization: `Bearer ${token}` }), 403);
  await client.connect(new StreamableHTTPClientTransport(address, {
    requestInit: { headers: { authorization: `Bearer ${token}`, origin: `https://${host}` } },
  }));
  await checkCatalog(client);
  console.log("Hosted HTTP: health, Host and Origin guards, bearer authorization, inventory parity, and tools passed");
});
