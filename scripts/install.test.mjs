import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { publishSkills, withInstallLock } from "./publish-skills.mjs";

async function temporaryDirectory(t) {
  const parent = await realpath(tmpdir());
  const directory = await mkdtemp(join(parent, "mtkit-installer-test-"));
  t.after(async () => {
    assert.equal(dirname(await realpath(directory)), parent);
    await rm(directory, { recursive: true, force: true });
  });
  return directory;
}

async function writeSkill(directory, name, body) {
  await mkdir(join(directory, name), { recursive: true });
  await writeFile(join(directory, name, "SKILL.md"), body);
}

test("a failed skill publication restores earlier replacements and retirements", async (t) => {
  const directory = await temporaryDirectory(t);
  const skills = join(directory, "installed");
  const stage = join(directory, "stage");
  const stagedSkills = join(stage, "skills");
  await writeSkill(skills, "existing", "original skill");
  await writeSkill(skills, "retired", "retiring skill");
  await writeSkill(stagedSkills, "existing", "updated skill");
  await writeSkill(stagedSkills, "new", "new skill");

  await assert.rejects(
    publishSkills(skills, stage, [
      { name: "existing", replaceExisting: true },
      { name: "new", replaceExisting: false },
    ], ["retired", "missing"]),
    { code: "ENOENT" },
  );
  assert.equal(await readFile(join(skills, "existing", "SKILL.md"), "utf8"), "original skill");
  assert.equal(await readFile(join(skills, "retired", "SKILL.md"), "utf8"), "retiring skill");
  await assert.rejects(readFile(join(skills, "new", "SKILL.md"), "utf8"), { code: "ENOENT" });
  assert.equal(await readFile(join(stagedSkills, "new", "SKILL.md"), "utf8"), "new skill");
});

test("the installer refuses simultaneous updates and releases its lock after errors", async (t) => {
  const directory = await temporaryDirectory(t);
  const lock = join(directory, "installer.lock");
  await assert.rejects(
    withInstallLock(lock, async () => {
      await assert.rejects(
        withInstallLock(lock, () => assert.fail("second update ran")),
        /Installer lock exists/,
      );
      throw new Error("installation failed");
    }),
    /installation failed/,
  );
  assert.equal(await withInstallLock(lock, () => "retry worked"), "retry worked");
});
