import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build } from "esbuild";

const exec = promisify(execFile);
const result = await build({
  entryPoints: [fileURLToPath(new URL("./archive.ts", import.meta.url))],
  bundle: true, platform: "node", target: "node22", format: "esm", write: false,
});
const { archivePathPattern, createSkillArchive, hasSkillFolder } = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}`
);

const temporaryRoot = await realpath(tmpdir());
const longFolder = Array.from({ length: 6 }, (_, index) => `reference-folder-${index}`).join("/");

async function withSkills(check) {
  const directory = await mkdtemp(join(temporaryRoot, "mtkit-archive-test-"));
  try {
    const skill = join(directory, "sample-skill");
    await mkdir(join(skill, longFolder), { recursive: true });
    await mkdir(join(skill, ".git"));
    await writeFile(join(skill, "SKILL.md"), "---\nname: sample-skill\n---\nUse me.\n");
    await writeFile(join(skill, longFolder, "deep-reference-with-a-long-file-name.md"), "deep\n");
    await writeFile(join(skill, "binary.bin"), Buffer.from([0, 255, 1, 254, 2]));
    await writeFile(join(skill, "big.bin"), Buffer.alloc(100_000, 7));
    await writeFile(join(skill, "empty.txt"), "");
    await writeFile(join(skill, ".mtkit-source.json"), "{}");
    await writeFile(join(skill, ".git", "config"), "secret");
    await writeFile(join(skill, "has space.md"), "skipped: unsafe name\n");
    await writeFile(join(directory, "outside.txt"), "outside the skill\n");
    await check(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function extract(directory, id) {
  const archive = join(directory, `${id}.tar.gz`);
  await pipeline(createSkillArchive(directory, id), createWriteStream(archive));
  const target = join(directory, "extracted");
  await mkdir(target);
  // Relative names keep GNU tar from reading a drive letter as a remote host.
  await exec("tar", ["-xzf", `${id}.tar.gz`, "-C", "extracted"], { cwd: directory });
  return join(target, id);
}

test("archives contain every regular file of the skill, including long paths and binaries", () => withSkills(async directory => {
  const root = await extract(directory, "sample-skill");
  assert.equal(await readFile(join(root, "SKILL.md"), "utf8"), "---\nname: sample-skill\n---\nUse me.\n");
  assert.equal(await readFile(join(root, longFolder, "deep-reference-with-a-long-file-name.md"), "utf8"), "deep\n");
  assert.deepEqual(await readFile(join(root, "binary.bin")), Buffer.from([0, 255, 1, 254, 2]));
  assert.deepEqual(await readFile(join(root, "big.bin")), Buffer.alloc(100_000, 7));
  assert.equal((await readFile(join(root, "empty.txt"))).length, 0);
}));

test("archives omit install markers, VCS data, unsafe names and files outside the skill", () => withSkills(async directory => {
  const root = await extract(directory, "sample-skill");
  const names = (await readdir(root)).sort();
  assert.deepEqual(names, ["SKILL.md", "big.bin", "binary.bin", "empty.txt", longFolder.split("/")[0]].sort());
  assert.deepEqual(await readdir(join(directory, "extracted")), ["sample-skill"]);
}));

test("symbolic links are never followed", async t => {
  await withSkills(async directory => {
    try {
      await symlink(join(directory, "outside.txt"), join(directory, "sample-skill", "link.md"));
    } catch (error) {
      if (error.code === "EPERM") return t.skip("symlink creation needs a privilege on this machine");
      throw error;
    }
    const root = await extract(directory, "sample-skill");
    assert(!(await readdir(root)).includes("link.md"));
  });
});

test("only catalog-shaped skill names with a SKILL.md can be archived", () => withSkills(async directory => {
  assert.equal(hasSkillFolder(directory, "sample-skill"), true);
  for (const id of ["missing-skill", "..", "../sample-skill", "sample-skill/..", "Sample-Skill", "", "constructor"]) {
    assert.equal(hasSkillFolder(directory, id), false, id);
    assert.throws(() => createSkillArchive(directory, id));
  }
  assert(archivePathPattern.test("/skills/design-screen.tar.gz"));
  for (const path of ["/skills/../x.tar.gz", "/skills/a/b.tar.gz", "/skills/Design.tar.gz", "/skills/x.tar", "/skills/%2e%2e.tar.gz", "/skills/.tar.gz"]) {
    assert.equal(archivePathPattern.test(path), false, path);
  }
}));

test("an archive over the size limit fails instead of producing a truncated success", () => withSkills(async directory => {
  await assert.rejects(pipeline(createSkillArchive(directory, "sample-skill", 1_000), createWriteStream(join(directory, "limited.tar.gz"))), /size limit/);
}));
