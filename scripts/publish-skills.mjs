import { mkdir, rename, rmdir } from "node:fs/promises";
import { join } from "node:path";

export class SkillRollbackError extends AggregateError {}

export async function withInstallLock(lock, install) {
  try {
    await mkdir(lock);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    throw new Error(`Installer lock exists at ${lock}. If no installer is running, remove this empty directory and retry.`, { cause: error });
  }

  try {
    return await install();
  } finally {
    await rmdir(lock);
  }
}

export async function publishSkills(skillsDirectory, stage, replacements, retired) {
  const stagedSkills = join(stage, "skills");
  const backup = join(stage, "backup");
  const undo = [];
  await mkdir(backup);

  async function move(from, to) {
    await rename(from, to);
    undo.push([to, from]);
  }

  try {
    for (const { name, replaceExisting } of replacements) {
      const target = join(skillsDirectory, name);
      if (replaceExisting) await move(target, join(backup, name));
      await move(join(stagedSkills, name), target);
    }
    for (const name of retired) {
      await move(join(skillsDirectory, name), join(backup, name));
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const [from, to] of undo.reverse()) {
      try {
        await rename(from, to);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length) {
      throw new SkillRollbackError(
        [error, ...rollbackErrors],
        `Could not restore all skills. Recovery files were preserved at ${stage}.`,
      );
    }
    throw error;
  }
}
