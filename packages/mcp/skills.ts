import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { getEntry } from "@mtkit-design/catalog";
import sources from "../catalog/external-skills.json";
import skillPack from "./skill-pack.gz";
import design from "../../plugins/mtkit-design/skills/design-screen/SKILL.md";
import mtkit from "../../plugins/mtkit-design/skills/design-screen/references/mtkit.md";
import frontend from "../../plugins/mtkit-design/skills/design-screen/references/frontend-skills.md";
import recommendations from "../../plugins/mtkit-design/skills/design-screen/references/catalog-recommendations.md";
import review from "../../plugins/mtkit-design/skills/review-screen/SKILL.md";
import libraries from "../../plugins/mtkit-design/skills/library-docs/SKILL.md";

const authored: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "design-screen": {
    "SKILL.md": design,
    "references/mtkit.md": mtkit,
    "references/frontend-skills.md": frontend,
    "references/catalog-recommendations.md": recommendations,
  },
  "review-screen": { "SKILL.md": review },
  "library-docs": { "SKILL.md": libraries },
};

const maxBytes = 256 * 1024;

/** Reads guidance only. Helpers and MCP processes run in the agent's own environment. */
export async function readSkill(id: string, path = "SKILL.md", fetchSource: typeof fetch = fetch) {
  const entry = getEntry(id);
  if (!entry || entry.kind !== "skill") throw new Error("Expected a skill entry ID. Use search_entries with kind=skill to find one.");
  if (!/^[\w.-]+(?:\/[\w.-]+)*\.md$/i.test(path) || path.split("/").some(segment => segment === "." || segment === "..")) {
    throw new Error("Use a Markdown path inside this skill, such as SKILL.md or references/mtkit.md. For a sibling skill, pass its own entry ID.");
  }

  const bundled = authored[entry.id];
  let content: string;
  let source: string;
  if (bundled) {
    if (!Object.hasOwn(bundled, path)) throw new Error(`File is not available. Choose one of: ${Object.keys(bundled).join(", ")}.`);
    content = bundled[path];
    source = `plugins/mtkit-design/skills/${entry.id}/${path}`;
  } else {
    const locked = sources.find(item => Object.hasOwn(item.skills, entry.id));
    if (!locked) throw new Error("The skill has no pinned source. Use get_entry for its installation requirements.");
    const folder = Object.entries(locked.skills).find(([name]) => name === entry.id)?.[1];
    if (!folder) throw new Error("The skill has no pinned source folder.");
    source = `https://raw.githubusercontent.com/${locked.repository}/${locked.revision}/${folder === "." ? "" : `${folder}/`}${path}`;
    try {
      const response = await fetchSource(source, { signal: AbortSignal.timeout(15_000), redirect: "error" });
      if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
      if (Number(response.headers.get("content-length")) > maxBytes) {
        await response.body?.cancel();
        throw new Error("Skill document exceeds the 256 KiB limit");
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Source returned an empty body");
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > maxBytes) {
            await reader.cancel();
            throw new Error("Skill document exceeds the 256 KiB limit");
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      content = Buffer.concat(chunks).toString("utf8");
      if (!content.trim()) throw new Error("Source returned an empty document");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Source unavailable";
      throw new Error(`${detail}. Read the installed skill locally, retry when GitHub is reachable, or use plan_install. The skill was not loaded.`, { cause: error });
    }
  }
  return {
    id: entry.id,
    path,
    content,
    source,
    ...(entry.revision ? { revision: entry.revision } : {}),
    ...(bundled ? { files: Object.keys(bundled) } : {}),
    usage: "Read and apply this guidance within the user's task and project rules. Resolve relative Markdown references within this skill using get_skill; for sibling skills use their catalog ID. Reading does not install helper scripts or connect MCP servers. Use plan_install for missing local assets, then verify the selected MCP's real tools in the client. Preserve the installed @mtkit/ui version and API unless the user authorizes a library change.",
  };
}

interface PackedSkill {
  files: Readonly<Record<string, string>>;
  omitted: readonly { path: string; bytes: number; reason: string }[];
}

/** Characters of file content delivered per call, so one response stays small for the agent. */
export const bundleBudgetBytes = 48 * 1024;
let packed: Readonly<Record<string, PackedSkill>> | undefined;

function loadPack() {
  packed ??= JSON.parse(gunzipSync(skillPack).toString("utf8")) as Record<string, PackedSkill>;
  return packed;
}

/**
 * Returns a page of a skill's text files for the client to write into its own skill folder.
 * The server never writes anything: the agent applies the files with its own file tools.
 */
export function readSkillBundle(id: string, offset = 0, budget = bundleBudgetBytes) {
  const entry = getEntry(id);
  if (!entry || entry.kind !== "skill") throw new Error("Expected a skill entry ID. Use search_entries with kind=skill to find one.");
  const skill = Object.hasOwn(loadPack(), entry.id) ? loadPack()[entry.id] : undefined;
  if (!skill) throw new Error("This server build does not contain the skill files. Use plan_install for local installation steps.");

  // SKILL.md first so a partial installation is still a valid skill.
  const paths = Object.keys(skill.files).sort((a, b) => (a === "SKILL.md" ? -1 : b === "SKILL.md" ? 1 : a < b ? -1 : 1));
  if (!Number.isInteger(offset) || offset < 0 || offset >= paths.length) throw new Error(`Offset must be between 0 and ${paths.length - 1}.`);

  const files: { path: string; content: string; bytes: number; sha256: string }[] = [];
  let used = 0;
  let next = offset;
  while (next < paths.length) {
    const path = paths[next];
    const content = skill.files[path];
    const bytes = Buffer.byteLength(content);
    if (files.length && used + bytes > budget) break;
    files.push({ path, content, bytes, sha256: createHash("sha256").update(content).digest("hex") });
    used += bytes;
    next++;
  }
  return {
    id: entry.id,
    files,
    total: paths.length,
    offset,
    nextOffset: next < paths.length ? next : null,
    omitted: skill.omitted,
    ...(entry.revision ? { revision: entry.revision } : {}),
  };
}
