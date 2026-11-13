import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const result = await build({
  entryPoints: [fileURLToPath(new URL("./skills.ts", import.meta.url))],
  bundle: true, platform: "node", format: "esm", write: false, loader: { ".md": "text" },
});
const { readSkill } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}`);
const noNetwork = () => assert.fail("Unexpected network request");

test("remote clients can read authored skills and every bundled reference offline", async () => {
  for (const id of ["design-screen", "review-screen", "library-docs"]) {
    const skill = await readSkill(id, undefined, noNetwork);
    assert.match(skill.content, /^---\r?\nname:/);
    for (const path of skill.files) {
      const reference = await readSkill(id, path, noNetwork);
      assert(reference.content.length > 100);
    }
  }
});

test("external instruction retrieval uses the pinned revision and bounded fetch", async () => {
  const skill = await readSkill("accessibility", undefined, async (url, options) => {
    assert.match(url, /^https:\/\/raw\.githubusercontent\.com\/addyosmani\/web-quality-skills\/[a-f0-9]{40}\/skills\/accessibility\/SKILL\.md$/);
    assert(options.signal instanceof AbortSignal);
    assert.equal(options.redirect, "error");
    return new Response("# Accessibility\nCheck keyboard navigation.");
  });
  assert.match(skill.revision, /^[a-f0-9]{40}$/);
  assert.match(skill.content, /keyboard/);
});

test("non-skills, scripts and paths outside the skill never trigger network requests", async () => {
  for (const id of ["playwright", "unknown", "constructor"]) await assert.rejects(readSkill(id, undefined, noNetwork));
  for (const path of ["../SKILL.md", "references/../../SKILL.md", "/SKILL.md", "C:/SKILL.md", "https://example.com/SKILL.md", "references\\SKILL.md", "scripts/run.py", "%2e%2e/SKILL.md"]) {
    await assert.rejects(readSkill("accessibility", path, noNetwork));
  }
  await assert.rejects(readSkill("design-screen", "references/missing.md", noNetwork), /Choose one of/);
});

test("upstream failures are actionable and never reported as loaded skills", async () => {
  for (const response of [new Response("missing", { status: 404 }), new Response(""), new Response("x", { headers: { "Content-Length": "300000" } }), new Response("x".repeat(262145))]) {
    await assert.rejects(readSkill("accessibility", undefined, async () => response), /The skill was not loaded/);
  }
  await assert.rejects(readSkill("accessibility", undefined, async () => { throw new Error("fetch failed"); }), /Read the installed skill locally/);
});
