import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { publishSkills, SkillRollbackError, withInstallLock } from "./publish-skills.mjs";
import { planProjectRules, setupProjectRules } from "./project-rules.mjs";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const plugin = join(root, "plugins", "mtkit-design");
const skillsDirectory = join(plugin, "skills");
const sourceMarker = ".mtkit-source.json";
const lock = join(root, ".mtkit-install-lock");

async function removeStage(parent, directory) {
  const path = relative(await realpath(parent), await realpath(directory));
  if (!path || path === ".." || path.startsWith(`..${sep}`) || isAbsolute(path)) {
    throw new Error(`Refusing to remove a directory outside the staging area: ${directory}`);
  }
  await rm(directory, { recursive: true, force: true });
}

function validSegment(segment) {
  return /^[\w.-]+$/.test(segment) && segment !== "." && segment !== "..";
}

function validateSources(sources) {
  const names = new Set();
  for (const { repository, revision, skills } of sources) {
    const segments = repository.split("/");
    if (segments.length !== 2 || !segments.every(validSegment) || !/^[\da-f]{40}$/i.test(revision)) {
      throw new Error(`Expected a GitHub repository and a commit SHA in the skill lock: ${repository}`);
    }
    for (const [name, path] of Object.entries(skills)) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || names.has(name)) {
        throw new Error(`Invalid or duplicate skill name in the skill lock: ${name}`);
      }
      if (path !== "." && !path.split("/").every(validSegment)) {
        throw new Error(`Expected a repository-relative path for skill ${name}`);
      }
      names.add(name);
    }
  }
  return names;
}

async function readIfPresent(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function prepareSource(source, entries, stage) {
  const { repository, revision } = source;
  const folder = await mkdtemp(join(stage, "source-"));
  try {
    const response = await fetch(
      `https://codeload.github.com/${repository}/tar.gz/${revision}`,
      { signal: AbortSignal.timeout(120_000) },
    );
    if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}`);

    const archive = join(folder, "source.tar.gz");
    await writeFile(archive, Buffer.from(await response.arrayBuffer()));
    const archiveRoot = `${repository.split("/")[1]}-${revision}`;
    const paths = [...new Set(entries.map(({ path }) => (
      path === "." ? archiveRoot : `${archiveRoot}/${path}`
    )))];
    await exec("tar", ["-xzf", archive, "-C", folder, ...paths], { timeout: 120_000 });

    for (const { name, path, marker } of entries) {
      const from = join(folder, archiveRoot, path);
      const to = join(stage, "skills", name);
      const skill = await readFile(join(from, "SKILL.md"), "utf8");
      const actualName = /^name:[ \t]*([a-z0-9-]+)[ \t]*\r?$/m.exec(skill)?.[1];
      if (actualName !== name) throw new Error(`Expected skill ${name}, found ${actualName}`);

      await cp(from, to, {
        recursive: true,
        filter: file => file !== join(from, ".github") && file !== join(from, ".git"),
      });
      await writeFile(join(to, sourceMarker), marker);
    }
  } catch (error) {
    throw new Error(`${repository}: ${error.message}`, { cause: error });
  } finally {
    await removeStage(stage, folder);
  }
}

async function prepareSkills() {
  const sources = JSON.parse(await readFile(join(root, "packages", "catalog", "external-skills.json"), "utf8"));
  const declared = validateSources(sources);
  const folders = await readdir(skillsDirectory, { withFileTypes: true });
  const existing = new Map(folders.map(folder => [folder.name, folder]));
  const retired = [];
  for (const folder of folders) {
    if (!folder.isDirectory() || declared.has(folder.name)) continue;
    const marker = await readIfPresent(join(skillsDirectory, folder.name, sourceMarker));
    if (marker !== null) retired.push(folder.name);
  }
  const needed = [];
  for (const source of sources) {
    const entries = [];
    for (const [name, path] of Object.entries(source.skills)) {
      const target = join(skillsDirectory, name);
      const marker = JSON.stringify({ repository: source.repository, revision: source.revision, path });
      const folder = existing.get(name);
      if (folder) {
        if (!folder.isDirectory()) throw new Error(`Expected a skill directory: ${target}`);
        const installed = await readIfPresent(join(target, sourceMarker));
        if (installed === null) throw new Error(`Skill folder already exists: ${target}`);
        if (installed === marker && await readIfPresent(join(target, "SKILL.md"))) continue;
      }
      entries.push({ name, path, marker, replaceExisting: Boolean(folder) });
    }
    if (entries.length) needed.push({ source, entries });
  }
  if (!needed.length && !retired.length) {
    console.log("External skills are ready.");
    return;
  }

  const stage = await mkdtemp(join(root, ".mtkit-skills-stage-"));
  let keepStage = false;
  try {
    await mkdir(join(stage, "skills"));
    for (let offset = 0; offset < needed.length; offset += 4) {
      const results = await Promise.allSettled(
        needed.slice(offset, offset + 4).map(({ source, entries }) => prepareSource(source, entries, stage)),
      );
      const errors = results.filter(result => result.status === "rejected");
      if (errors.length) throw new Error(errors.map(result => result.reason.message).join("\n"));
    }
    const replacements = needed.flatMap(({ entries }) => entries);
    await publishSkills(skillsDirectory, stage, replacements, retired);
    if (replacements.length) console.log(`Prepared ${replacements.length} external skills.`);
    if (retired.length) console.log(`Removed ${retired.length} retired external skills.`);
  } catch (error) {
    keepStage = error instanceof SkillRollbackError;
    throw error;
  } finally {
    if (!keepStage) await removeStage(root, stage);
  }
}

async function publishMarketplace() {
  const directory = join(root, ".agents", "plugins");
  const temporary = join(lock, "marketplace.json");
  try {
    await mkdir(directory, { recursive: true });
    const template = await readFile(join(root, "scripts", "marketplace.json"));
    await writeFile(temporary, template);
    await rename(temporary, join(directory, "marketplace.json"));
  } finally {
    await rm(temporary, { force: true });
  }
}

async function main() {
  const args = process.argv.slice(2);
  const usage = "Usage: node scripts/install.mjs [--prepare-only | --project <directory>]";
  let project;
  let prepareOnly = false;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--prepare-only" && !prepareOnly) prepareOnly = true;
    else if (args[index] === "--project" && project === undefined && args[index + 1] && !args[index + 1].startsWith("--")) project = args[++index];
    else throw new Error(usage);
  }
  if (prepareOnly && project !== undefined) throw new Error(usage);
  // Validate the target before downloads or client registration make changes.
  if (project !== undefined) await planProjectRules({ project, client: "codex" });
  await withInstallLock(lock, async () => {
    await prepareSkills();
    if (prepareOnly) return;
    for (const script of ["packages/catalog/check-inventory.mjs", "scripts/build-catalog.mjs"]) {
      const { stdout } = await exec(process.execPath, [join(root, script)], { cwd: root, timeout: 120_000 });
      if (stdout.trim()) console.log(stdout.trim());
    }
    await publishMarketplace();

    for (const command of [["plugin", "marketplace", "add", "."], ["plugin", "add", "mtkit-design@medipal"]]) {
      const { stdout } = await exec("codex", command, { cwd: root, timeout: 120_000 });
      if (stdout.trim()) console.log(stdout.trim());
    }
    if (project !== undefined) {
      console.log(JSON.stringify(await setupProjectRules({ project, client: "codex" }), null, 2));
    }
  });
}

main().catch(error => {
  console.error(error.stderr || error.message);
  process.exitCode = 1;
});
