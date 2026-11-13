// Explicit network/browser integration check, separate from the offline smoke suite.
// Uses pinned MCP commands from the plugin and temporary fixtures only.
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const manifest = JSON.parse(await readFile(new URL("../../plugins/mtkit-design/.mcp.json", import.meta.url), "utf8"));
const fixture = await mkdtemp(join(tmpdir(), "mtkit-mcp-integration-"));
const textContent = (result) => result.content.filter(({ type }) => type === "text").map(({ text }) => text).join("\n");

async function snapshotText(result) {
  const file = /\[Snapshot\]\(([^)]+)\)/.exec(result)?.[1];
  if (!file) return result;
  const path = resolve(fixture, file);
  assert(path.startsWith(`${resolve(fixture)}${sep}`), "Snapshot path must stay in the temporary fixture");
  return readFile(path, "utf8");
}

async function check(name, run) {
  const config = manifest.mcpServers[name];
  const client = new Client({ name: "mtkit-integration-check", version: "1.0.0" });
  const transport = config.url
    ? new StreamableHTTPClientTransport(new URL(config.url))
    : new StdioClientTransport({ command: config.command, args: config.args, cwd: fixture, stderr: "pipe" });
  // Drain package-manager diagnostics without mixing them into the MCP protocol.
  transport.stderr?.resume();
  const started = Date.now();
  try {
    await client.connect(transport, { timeout: 120_000 });
    const { tools } = await client.listTools();
    const call = async (tool, arguments_) => {
      assert(tools.some(({ name: registered }) => registered === tool), `${name} does not expose ${tool}`);
      const result = await client.callTool({ name: tool, arguments: arguments_ }, undefined, { timeout: 60_000 });
      assert(!result.isError, `${name}.${tool} failed: ${textContent(result).slice(0, 500)}`);
      return textContent(result);
    };
    const details = await run(call);
    console.log(JSON.stringify({ integration: name, passed: true, elapsedMs: Date.now() - started, ...details }));
  } finally {
    await client.close();
  }
}

await mkdir(join(fixture, "src"));
await writeFile(join(fixture, "package.json"), JSON.stringify({ name: "mtkit-integration-fixture", private: true }));
await writeFile(join(fixture, "tsconfig.json"), JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } } }));
await writeFile(join(fixture, "src/index.css"), "");
await writeFile(join(fixture, "components.json"), JSON.stringify({
  $schema: "https://ui.shadcn.com/schema.json",
  style: "new-york", rsc: false, tsx: true,
  tailwind: { config: "", css: "src/index.css", baseColor: "neutral", cssVariables: true },
  aliases: { components: "@/components", utils: "@/lib/utils", ui: "@/components/ui", lib: "@/lib", hooks: "@/hooks" },
}));

const page = createServer((_request, response) => {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(`<!doctype html>
    <html lang="en"><meta charset="utf-8"><title>MTKit MCP integration fixture</title>
    <body><h1>MTKit MCP integration fixture</h1><button id="verify" onclick="document.querySelector('#status').textContent='Interaction passed'">Verify interaction</button>
    <p id="status" role="status">Waiting for interaction</p></body></html>`);
});
page.listen(0, "127.0.0.1");
await once(page, "listening");

try {
  const results = await Promise.allSettled([
    check("context7", async (call) => {
      const libraries = await call("resolve-library-id", { libraryName: "React", query: "React useEffect cleanup function documentation" });
      const ids = [...libraries.matchAll(/library ID:\s*(\/[\w./-]+)/gi)].map((match) => match[1]);
      const libraryId = ids.find((id) => id === "/reactjs/react.dev") ?? ids.find((id) => /react_dev/.test(id));
      assert(libraryId, "Context7 did not resolve an official React documentation source");
      const docs = await call("query-docs", { libraryId, query: "React useEffect cleanup function example", language: "TypeScript" });
      assert.match(docs, /useEffect/);
      assert.match(docs, /cleanup|clean.up|return\s*\(/i);
      return { libraryId, verified: "React useEffect documentation and cleanup examples" };
    }),
    check("shadcn", async (call) => {
      const registries = await call("get_project_registries", {});
      assert.match(registries, /@shadcn/);
      const items = await call("view_items_in_registries", { items: ["@shadcn/button"] });
      assert.match(items, /button/i);
      assert.match(items, /registry:ui/);
      assert.match(items, /Files.*[1-9]/);
      return { verified: "Temporary project registry and button item metadata lookup" };
    }),
    check("playwright", async (call) => {
      const address = page.address();
      const snapshot = await snapshotText(await call("browser_navigate", { url: `http://127.0.0.1:${address.port}/` }));
      assert.match(snapshot, /MTKit MCP integration fixture/);
      assert.match(snapshot, /Verify interaction/);
      await call("browser_click", { target: "#verify", element: "Verify interaction button in the temporary test page" });
      const updated = await snapshotText(await call("browser_snapshot", {}));
      assert.match(updated, /Interaction passed/);
      await call("browser_close", {});
      return { verified: "Browser launch, local navigation, snapshot, click, and updated state" };
    }),
  ]);
  for (let index = 0; index < results.length; index++) {
    const result = results[index];
    if (result.status === "rejected") {
      console.error(JSON.stringify({ integration: ["context7", "shadcn", "playwright"][index], passed: false, error: result.reason.message }));
      process.exitCode = 1;
    }
  }
} finally {
  await new Promise((resolve, reject) => page.close((error) => error ? reject(error) : resolve()));
  assert.equal(dirname(resolve(fixture)), resolve(tmpdir()));
  assert(basename(fixture).startsWith("mtkit-mcp-integration-"));
  await rm(fixture, { recursive: true, force: true });
}
