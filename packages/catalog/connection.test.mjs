import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const compiled = await build({
  entryPoints: [fileURLToPath(new URL("./index.ts", import.meta.url))],
  bundle: true, platform: "node", format: "esm", write: false,
});
const { catalogConnection, catalogPrompts, claudeCodeCommand, promptCommand } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString("base64")}`);
const hosted = "https://mcp.company.example/mcp";

test("the Claude Code command registers the same server as the JSON configuration", () => {
  for (const endpoint of [undefined, hosted]) {
    const [name] = Object.keys(catalogConnection("claude-code", endpoint).content.mcpServers);
    const command = claudeCodeCommand(endpoint);
    assert.match(command, new RegExp(`^claude mcp add --transport http --scope project ${name} `));
    assert(command.includes(endpoint ?? "http://127.0.0.1:4387/mcp"));
  }
});

test("the hosted command keeps the token as a quoted variable reference", () => {
  const command = claudeCodeCommand(hosted);
  assert(command.endsWith(" --header 'Authorization: Bearer ${MTKIT_MCP_TOKEN}'"));
  assert(!claudeCodeCommand().includes("Authorization"));
});

test("prompt commands follow each client's naming and are absent where clients have none", () => {
  assert.equal(promptCommand("claude-code", "setup", true), "/mcp__mtkit_catalog_remote__setup");
  assert.equal(promptCommand("claude-code", "update", false), "/mcp__mtkit_catalog__update");
  assert.equal(promptCommand("vscode", "setup", true), "/mcp.mtkit_catalog_remote.setup");
  for (const client of ["codex", "cursor"]) assert.equal(promptCommand(client, "setup", true), undefined);
  assert.deepEqual([...catalogPrompts], ["setup", "install", "update", "pick"]);
});
