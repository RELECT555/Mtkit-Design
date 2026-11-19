import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { writeSkillPack } from "../../scripts/skill-pack.mjs";

await writeSkillPack(
  fileURLToPath(new URL("../../plugins/mtkit-design/skills", import.meta.url)),
  fileURLToPath(new URL("./skill-pack.gz", import.meta.url)),
);
const result = await build({
  entryPoints: [fileURLToPath(new URL("./skills.ts", import.meta.url))],
  bundle: true, platform: "node", target: "node22", format: "esm", write: false, loader: { ".md": "text", ".gz": "binary" },
});
const { readSkill, readSkillBundle } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}`);
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

test("authored skills install as complete file sets with integrity hashes", () => {
  const skill = readSkillBundle("design-screen");
  assert.equal(skill.files[0].path, "SKILL.md");
  assert.equal(skill.nextOffset, null);
  assert.deepEqual(skill.files.map(({ path }) => path).sort(), [
    "SKILL.md", "references/catalog-recommendations.md", "references/frontend-skills.md", "references/mtkit.md",
  ]);
  for (const file of skill.files) {
    assert.match(file.sha256, /^[a-f0-9]{64}$/);
    assert.equal(file.bytes, Buffer.byteLength(file.content));
    assert.match(file.path, /^[\w.-]+(?:\/[\w.-]+)*$/);
    assert(!file.path.split("/").includes(".."));
  }
});

test("large skills are delivered in pages that cover every file exactly once", () => {
  const first = readSkillBundle("design-screen", 0, 1);
  assert.equal(first.files.length, 1);
  assert.equal(first.nextOffset, 1);
  const seen = [];
  for (let offset = 0, page; offset !== null; offset = page.nextOffset) {
    page = readSkillBundle("design-screen", offset, 2_000);
    assert(page.files.length >= 1);
    seen.push(...page.files.map(({ path }) => path));
  }
  assert.equal(new Set(seen).size, seen.length);
  assert.equal(seen.length, readSkillBundle("design-screen").total);
});

test("skill installation rejects non-skills, unknown IDs and out-of-range pages", () => {
  for (const id of ["playwright", "unknown", "constructor", "__proto__"]) assert.throws(() => readSkillBundle(id));
  for (const offset of [-1, 1_000_000, 1.5]) assert.throws(() => readSkillBundle("design-screen", offset), /Offset/);
});

test("every skill present locally installs from the server bundle", () => {
  for (const id of ["design-screen", "review-screen", "library-docs"]) {
    assert.match(readSkillBundle(id).files[0].content, /^---\r?\nname:/);
  }
});

test("skill versions are stable per build and change with any file", async () => {
  const first = readSkillBundle("design-screen").version;
  assert.match(first, /^[a-f0-9]{16}$/);
  assert.equal(readSkillBundle("design-screen").version, first);
  assert.notEqual(readSkillBundle("review-screen").version, first);
});
