import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { withInstallLock } from "./publish-skills.mjs";

async function statIfPresent(path) {
  try { return await lstat(path); }
  catch (error) { if (error.code === "ENOENT") return undefined; throw error; }
}

function within(root, path) {
  const part = relative(root, path);
  return part !== "" && part !== ".." && !part.startsWith(`..${sep}`) && !isAbsolute(part);
}

async function validateTarget(root, target) {
  if (!within(root, target)) throw new Error("Instruction file must be inside the selected project.");
  let path = root;
  for (const part of relative(root, target).split(sep)) {
    path = join(path, part);
    const stat = await statIfPresent(path);
    if (!stat) continue;
    if (stat.isSymbolicLink()) throw new Error(`Refusing to write through a symbolic link: ${path}`);
    if (path === target ? !stat.isFile() : !stat.isDirectory()) {
      throw new Error(`Expected ${path === target ? "an instruction file" : "a directory"}: ${path}`);
    }
  }
}

function markerPositions(text, marker) {
  const positions = [];
  for (let position = text.indexOf(marker); position >= 0; position = text.indexOf(marker, position + marker.length)) positions.push(position);
  return positions;
}

function standaloneMarker(text, marker, at) {
  const end = at + marker.length;
  return (at === 0 || (at === 1 && text.charCodeAt(0) === 0xFEFF) || text[at - 1] === "\n") && (end === text.length || text[end] === "\n" || text.slice(end, end + 2) === "\r\n");
}

export function mergeProjectRules(original, definition) {
  const { markerStart, markerEnd, content } = definition;
  const starts = markerPositions(original, markerStart);
  const ends = markerPositions(original, markerEnd);
  if (starts.length !== ends.length || starts.length > 1 || (starts.length && (starts[0] >= ends[0] || !standaloneMarker(original, markerStart, starts[0]) || !standaloneMarker(original, markerEnd, ends[0])))) {
    throw new Error("MTKit rule markers are malformed or duplicated. Preserve the project text and repair the marked block before retrying.");
  }
  const newline = original.match(/\r?\n/)?.[0] ?? "\n";
  const block = `${markerStart}${newline}${content.trim().replace(/\r?\n/g, newline)}${newline}${markerEnd}`;
  if (starts.length) return original.slice(0, starts[0]) + block + original.slice(ends[0] + markerEnd.length);
  const separator = original === "" ? "" : original.endsWith(`${newline}${newline}`) ? "" : original.endsWith(newline) ? newline : `${newline}${newline}`;
  return original + separator + block + newline;
}

export async function planProjectRules({ project, client = "codex" }) {
  if (typeof project !== "string" || !project.trim()) throw new Error("An explicit --project directory is required.");
  const definition = JSON.parse(await readFile(new URL("../packages/catalog/project-rules.json", import.meta.url), "utf8"));
  if (!Object.hasOwn(definition.instructionFiles, client)) throw new Error(`Unsupported client: ${client}`);
  const requested = resolve(project);
  const projectStat = await lstat(requested);
  if (projectStat.isSymbolicLink() || !projectStat.isDirectory()) throw new Error("Select an existing project directory, not a symbolic link.");
  const root = await realpath(requested);
  const instructionFile = definition.instructionFiles[client];
  const target = resolve(root, instructionFile);
  await validateTarget(root, target);
  const stat = await statIfPresent(target);
  const bytes = stat ? await readFile(target) : undefined;
  const original = bytes ? new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes) : "";
  const content = mergeProjectRules(original, definition);
  return { root, client, instructionFile, target, original, content, exists: Boolean(stat), mode: stat?.mode, action: !stat ? "create" : content === original ? "unchanged" : "update" };
}

export async function setupProjectRules({ project, client = "codex", check = false }) {
  let plan = await planProjectRules({ project, client });
  const report = () => ({ project: plan.root, client, instructionFile: plan.instructionFile, target: plan.target, action: plan.action, changed: !check && plan.action !== "unchanged", check });
  if (check || plan.action === "unchanged") return report();
  return withInstallLock(join(plan.root, ".mtkit-project-rules-lock"), async () => {
    plan = await planProjectRules({ project, client });
    if (plan.action === "unchanged") return report();
    await mkdir(dirname(plan.target), { recursive: true });
    await validateTarget(plan.root, plan.target);
    const temporary = join(dirname(plan.target), `.mtkit-rules-${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, plan.content, { encoding: "utf8", flag: "wx", ...(plan.mode !== undefined && { mode: plan.mode }) });
      await validateTarget(plan.root, plan.target);
      const current = await statIfPresent(plan.target);
      const currentContent = current ? await readFile(plan.target, "utf8") : undefined;
      if (Boolean(current) !== plan.exists || (current && currentContent !== plan.original)) {
        throw new Error("The instruction file changed during setup. No project rules were replaced; retry against the updated file.");
      }
      await rename(temporary, plan.target);
    } finally {
      await rm(temporary, { force: true });
    }
    return report();
  });
}
