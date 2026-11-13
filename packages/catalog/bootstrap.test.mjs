import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const compiled = await build({
  entryPoints: [fileURLToPath(new URL("./index.ts", import.meta.url))],
  bundle: true, platform: "node", format: "esm", write: false,
});
const { planBootstrap } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString("base64")}`);

for (const [client, instructionFile] of [
  ["codex", "AGENTS.md"],
  ["claude-code", "CLAUDE.md"],
  ["cursor", "AGENTS.md"],
  ["vscode", ".github/copilot-instructions.md"],
]) {
  test(`bootstrap for ${client} targets its supported project instruction file`, () => {
    const setup = planBootstrap(client);
    assert.equal(setup.client, client);
    assert.equal(setup.instructionFile, instructionFile);
    assert(!/^(?:[a-z]:|\/|\\)/i.test(setup.instructionFile));
    assert(!setup.instructionFile.split("/").includes(".."));
    assert.equal(setup.content.split(setup.markerStart).length, 2);
    assert.equal(setup.content.split(setup.markerEnd).length, 2);
    assert(setup.content.indexOf(setup.markerStart) < setup.content.indexOf(setup.markerEnd));
    assert.match(setup.content, /recommend_tools/);
    assert.match(setup.content, /get_skill/);
    assert.match(setup.content, /@mtkit\/ui/);
    assert.deepEqual(setup, planBootstrap(client));
  });
}

test("bootstrap distinguishes client persistence, session-only guidance and verification", () => {
  const setup = planBootstrap("codex");
  const instructions = setup.instructions.join("\n");
  assert.match(instructions, /project root/);
  assert.match(instructions, /Preserve all content outside/);
  assert.match(instructions, /malformed or duplicated/);
  assert.match(instructions, /symlink/);
  assert.match(instructions, /review-only/);
  assert.match(instructions, /not persisted/);
  assert.match(instructions, /reread/);
  assert.match(instructions, /Returning this plan alone does not mean setup was applied/);
  assert(setup.checks.some(check => check.includes("list_categories")));
  assert(setup.checks.some(check => check.includes("@mtkit/ui")));
});
