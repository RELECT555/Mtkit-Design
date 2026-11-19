import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";

// Skill files the MCP server can hand to an agent as text. Binary assets, fonts and large
// data files stay in the Codex plugin; they are listed as omitted so the agent can say so.
export const maxFileBytes = 48 * 1024;
const textExtensions = new Set([
  ".md", ".txt", ".py", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".sh", ".yaml", ".yml",
  ".toml", ".css", ".json", ".csv", ".html",
]);
const ignoredNames = new Set([".mtkit-source.json", ".git", ".github", "node_modules", ".DS_Store"]);
const safeSegment = /^[\w.-]+$/;
const decoder = new TextDecoder("utf-8", { fatal: true });

function extension(name) {
  const index = name.lastIndexOf(".");
  return index > 0 ? name.slice(index).toLowerCase() : "";
}

async function* walk(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (ignoredNames.has(entry.name)) continue;
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) yield* walk(join(directory, entry.name), path);
    else if (entry.isFile()) yield { path, file: join(directory, entry.name) };
  }
}

/** External skills without a recorded license are not redistributed by the server. */
export async function unlicensedSkills(lockFile) {
  const sources = JSON.parse(await readFile(lockFile, "utf8"));
  return new Set(sources.filter(({ license }) => typeof license !== "string").flatMap(({ skills }) => Object.keys(skills)));
}

/** Reads every skill folder that has a SKILL.md and splits files into deliverable text and omitted. */
export async function collectSkillPack(skillsDirectory, excluded = new Set()) {
  const pack = {};
  const folders = (await readdir(skillsDirectory, { withFileTypes: true })).filter(item => item.isDirectory());
  for (const folder of folders.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(folder.name) || excluded.has(folder.name)) continue;
    const root = join(skillsDirectory, folder.name);
    try {
      await stat(join(root, "SKILL.md"));
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    const files = {};
    const omitted = [];
    for await (const { path, file } of walk(root)) {
      if (!path.split("/").every(segment => safeSegment.test(segment))) {
        omitted.push({ path, bytes: (await stat(file)).size, reason: "unsupported path" });
        continue;
      }
      const bytes = (await stat(file)).size;
      if (!textExtensions.has(extension(path))) {
        omitted.push({ path, bytes, reason: "not a text file" });
      } else if (bytes > maxFileBytes) {
        omitted.push({ path, bytes, reason: "larger than 48 KiB" });
      } else {
        try {
          files[path] = decoder.decode(await readFile(file));
        } catch {
          omitted.push({ path, bytes, reason: "not valid UTF-8" });
        }
      }
    }
    if (!Object.hasOwn(files, "SKILL.md")) throw new Error(`Skill ${folder.name} must include a readable SKILL.md`);
    pack[folder.name] = { files, omitted };
  }
  return pack;
}

export async function writeSkillPack(skillsDirectory, output, lockFile = join(skillsDirectory, "..", "..", "..", "packages", "catalog", "external-skills.json")) {
  const pack = await collectSkillPack(skillsDirectory, await unlicensedSkills(lockFile));
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, gzipSync(JSON.stringify(pack), { level: 9 }));
  const files = Object.values(pack).reduce((sum, skill) => sum + Object.keys(skill.files).length, 0);
  return { skills: Object.keys(pack).length, files };
}
