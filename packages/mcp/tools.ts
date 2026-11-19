import { McpServer } from "@modelcontextprotocol/server";
import { catalogCategories, catalogCounts, catalogEntries, getEntry, installClients, planBootstrap, planInstall, projectClients, queryCatalog, recommendForTask, skillCompanions, skillDirectories } from "@mtkit-design/catalog";
import * as z from "zod/v4";
import { version } from "./package.json";
import { redistributionLicense } from "./licenses.js";
import { registerPrompts } from "./prompts.js";
import { logEvent } from "./log.js";
import { manifestFile, readSkill, readSkillBundle, skillManifest, skillVersion } from "./skills.js";

const inventoryUri = "mtkit://catalog/inventory";
const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const searchInput = z.strictObject({
  query: z.string().trim().max(250).optional().describe("Keywords in Russian or English, for example 'доступность' or 'React docs'. Omit to browse."),
  kind: z.enum(["skill", "mcp"]).optional().describe("Limit results to skills or MCP servers."),
  category: z.string().trim().min(1).max(80).optional().describe("Limit results to a category returned by a previous search."),
  availability: z.enum(["bundled", "optional"]).optional().describe("Limit results to tools included in the Codex plugin or available separately."),
  limit: z.number().int().min(1).max(50).default(12).describe("Maximum number of entries to return."),
  offset: z.number().int().min(0).max(10_000).default(0).describe("Offset returned by the previous search page."),
});

const entryId = z.string().trim().min(1).max(100).describe("Catalog entry ID returned by recommend_tools or search_entries.");

const recommendationOutput = z.object({
  projectSetup: z.object({ tool: z.literal("bootstrap_project"), instruction: z.string() }),
  recommendations: z.array(z.object({
    id: z.string(),
    kind: z.enum(["skill", "mcp"]),
    name: z.string(),
    title: z.string(),
    availability: z.enum(["bundled", "optional"]),
    reason: z.string(),
    installWith: z.enum(["install_skills", "plan_install"]),
  })),
});

function jsonResult(structuredContent: Record<string, unknown>) {
  return {
    structuredContent,
    content: [{ type: "text" as const, text: JSON.stringify(structuredContent) }],
  };
}

function unknownEntry(id: string) {
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: `Catalog entry ${JSON.stringify(id)} was not found. Call search_entries to find an entry ID.` }],
  };
}

/** Set by HTTP transports that serve skill archives; stdio has no download endpoint. */
export interface CatalogOptions {
  archive?: { origin: string; bearer: boolean; has(id: string): boolean };
}

function archiveCommands(origin: string, bearer: boolean, id: string, directory: string) {
  const url = `${origin}/skills/${id}.tar.gz`;
  const header = bearer ? ' -H "Authorization: Bearer $MTKIT_MCP_TOKEN"' : "";
  const psHeader = bearer ? ' -H "Authorization: Bearer $env:MTKIT_MCP_TOKEN"' : "";
  return {
    url,
    posix: `mkdir -p ${directory} && curl -fsSL${header} "${url}" | tar -xz -C ${directory}`,
    powershell: `New-Item -ItemType Directory -Force ${directory} | Out-Null; $archive = Join-Path $env:TEMP "${id}.tar.gz"; curl.exe -fsSL${psHeader} "${url}" -o $archive; tar -xzf $archive -C ${directory}; Remove-Item $archive`,
  };
}

export function createCatalogServer(options: CatalogOptions = {}) {
  const server = new McpServer(
    { name: "mtkit-catalog", version },
    { instructions: "When MTKit is first used in an application project, call bootstrap_project for the current client. It returns the managed project rules and merge procedure. During authorized project setup, use the client's file tools to create or update only that block, preserve existing rules, and verify the result. Never write to the server filesystem as a substitute for client setup. For read-only or review-only work, follow the rules in-session and report setup as not persisted. Reuse a completed setup check for this project during the session. For TypeScript frontend design, implementation, UI review, or library documentation, call recommend_tools with a short task description, then read selected installed skills or get_skill before applying them. Verify MCP tools in this client before using them; bundled means included in the plugin, not currently connected. To add a selected skill to the project, call install_skills for this client and write the returned files with the client's file tools, only when the user wants it installed; use plan_install for MCP servers and other missing dependencies. Respect the user's constraints and preserve the project's @mtkit/ui version and API. Use search_entries for direct searches and mtkit://catalog/inventory for the complete inventory." },
  );

  // Time every tool call for the operator log. Only the tool name and outcome are recorded.
  const register = server.registerTool.bind(server) as (...args: unknown[]) => unknown;
  server.registerTool = ((name: string, config: unknown, callback: (...args: unknown[]) => unknown) => register(name, config, async (...args: unknown[]) => {
    const started = performance.now();
    try {
      const result = await callback(...args) as { isError?: boolean };
      logEvent({ event: "tool", tool: name, ms: Math.round(performance.now() - started), ok: !result?.isError });
      return result;
    } catch (error) {
      logEvent({ event: "tool", tool: name, ms: Math.round(performance.now() - started), ok: false, error: error instanceof Error ? error.name : "unknown" });
      throw error;
    }
  })) as typeof server.registerTool;

  registerPrompts(server);

  server.registerResource("inventory", inventoryUri, {
    title: "MTKit catalog inventory",
    description: "Complete TypeScript skills and MCP catalog, including categories, sources, requirements, and whether each entry is bundled with the Codex plugin.",
    mimeType: "application/json",
  }, async () => ({
    contents: [{
      uri: inventoryUri,
      mimeType: "application/json",
      text: JSON.stringify({ version, counts: catalogCounts, categories: catalogCategories, entries: catalogEntries }),
    }],
  }));

  server.registerTool("bootstrap_project", {
    title: "Set up MTKit project guidance",
    description: "Call at first use of MTKit in an application project. Returns the current client's instruction file, managed rule block, non-destructive merge procedure and readiness checks. Use client file tools to apply during authorized setup; preserve existing rules. In review-only/read-only sessions, use guidance in-session without writing. This server only returns a plan and cannot write to the client's files. Reuse a completed setup check within this session.",
    inputSchema: z.strictObject({ client: z.enum(installClients).describe("The agent client using this project: codex, claude-code, cursor or vscode.") }),
    outputSchema: z.object({ setup: z.object({
      client: z.enum(installClients), instructionFile: z.string(),
      markerStart: z.string(), markerEnd: z.string(), content: z.string(),
      mergePolicy: z.literal("append-or-replace-managed-block"),
      instructions: z.array(z.string()), checks: z.array(z.string()),
    }) }),
    annotations: readOnly,
  }, async ({ client }) => jsonResult({ setup: planBootstrap(client) }));

  server.registerTool("list_categories", {
    title: "List catalog categories",
    description: "Get the category names used by search_entries and the current inventory counts.",
    inputSchema: z.strictObject({}),
    annotations: readOnly,
  }, async () => jsonResult({ categories: catalogCategories, counts: catalogCounts }));

  server.registerTool("recommend_tools", {
    title: "Recommend skills and MCP servers for a task",
    description: "Choose relevant skills and MCP servers before working on a TypeScript frontend task. Pass the user's goal in natural language, including framework and constraints. Read selected installed skills or get_skill before applying them. Use get_entry for requirements. If a recommended skill is not installed, install_skills delivers its files; plan_install covers MCP servers. Bundled means included in the plugin, not proof of installation or availability in this session. With no match, search_entries or inspect the inventory instead of guessing.",
    inputSchema: z.strictObject({
      task: z.string().trim().min(1).max(2_000).describe("Short description of what the user wants to accomplish, in Russian or English."),
    }),
    outputSchema: recommendationOutput,
    annotations: readOnly,
  }, async ({ task }) => jsonResult({
    projectSetup: { tool: "bootstrap_project", instruction: "If MTKit project setup has not yet been checked in this session, request bootstrap_project for your client. Apply only during authorized setup; for read-only or review-only work follow its guidance in-session. Reuse an existing setup check." },
    recommendations: recommendForTask(task).map(({ entry: { id, kind, name, title, availability }, reason }) => ({ id, kind, name, title, availability, reason, installWith: kind === "skill" ? "install_skills" as const : "plan_install" as const })),
  }));

  server.registerTool("search_entries", {
    title: "Search the MTKit catalog",
    description: "Search curated TypeScript skills and MCP servers by task, name, or category. Returns entry IDs, short descriptions, total matches, and the next offset when more results exist. Use get_entry for requirements and source details.",
    inputSchema: searchInput,
    annotations: readOnly,
  }, async (filters) => {
    const { entries, total, nextOffset } = queryCatalog(filters);
    return jsonResult({
      entries: entries.map(({ id, kind, title, description, category, availability }) => ({ id, kind, title, description, category, availability })),
      total,
      nextOffset,
    });
  });

  server.registerTool("get_entry", {
    title: "Read catalog entry",
    description: "Read a skill or MCP server's catalog card, including its source, access requirements, and prerequisites.",
    inputSchema: z.strictObject({ id: entryId }),
    annotations: readOnly,
  }, async ({ id }) => {
    const entry = getEntry(id);
    return entry ? jsonResult({ entry }) : unknownEntry(id);
  });

  server.registerTool("get_skill", {
    title: "Read a skill's instructions",
    description: "Read SKILL.md or a Markdown reference before applying a selected skill. First-party MTKit instructions are included in the server. External guidance is read from the catalog's pinned GitHub revision and requires network access. This reads guidance only; helper scripts and MCP servers must be installed and used in the client environment.",
    inputSchema: z.strictObject({
      id: entryId,
      path: z.string().trim().min(1).max(240).default("SKILL.md").describe("Markdown path relative to the skill folder, for example references/mtkit.md. For sibling skills use their own catalog entry ID."),
    }),
    outputSchema: z.object({ skill: z.object({
      id: z.string(), path: z.string(), content: z.string(), source: z.string(),
      revision: z.string().optional(), files: z.array(z.string()).optional(), usage: z.string(),
    }) }),
    annotations: { ...readOnly, openWorldHint: true },
  }, async ({ id, path }) => {
    try {
      return jsonResult({ skill: await readSkill(id, path) });
    } catch (error) {
      return { isError: true, content: [{ type: "text" as const, text: error instanceof Error ? error.message : "Skill could not be loaded. Use get_entry and plan_install for requirements." }] };
    }
  });

  server.registerTool("install_skills", {
    title: "Get a skill's files to install in a project",
    description: "Return the text files of one skill (and, when this server offers downloads, a tar.gz archive with everything including binary assets), with the folder to create for this client, so the agent can install it with its own file tools. This server cannot write to the client's machine. Call only when the user wants the skill installed. Large skills arrive in pages: repeat with nextOffset until it is null. Installs the skill's instructions, references and small helper scripts; binary assets and large data files are listed as omitted and need the Codex plugin or the upstream repository. Codex uses plan_install for the plugin instead.",
    inputSchema: z.strictObject({
      id: entryId,
      client: z.enum(projectClients).describe("Client that will use the skill: claude-code, cursor or vscode."),
      offset: z.number().int().min(0).max(10_000).default(0).describe("nextOffset from the previous page; omit for the first page."),
    }),
    outputSchema: z.object({ install: z.object({
      id: z.string(), client: z.enum(projectClients), targetDirectory: z.string(),
      files: z.array(z.object({ path: z.string(), content: z.string(), bytes: z.number(), sha256: z.string() })),
      page: z.object({ offset: z.number(), total: z.number(), nextOffset: z.number().nullable() }),
      omitted: z.array(z.object({ path: z.string(), bytes: z.number(), reason: z.string() })),
      companionSkills: z.array(z.string()),
      requirements: z.array(z.string()),
      license: z.string().nullable(),
      version: z.string(),
      manifest: z.object({ path: z.string(), content: z.string() }),
      revision: z.string().optional(),
      instructions: z.array(z.string()),
      verification: z.string(),
      archive: z.object({
        url: z.string(), recommended: z.boolean(), extractDirectory: z.string(),
        authorization: z.enum(["bearer", "none"]),
        commands: z.object({ posix: z.string(), powershell: z.string() }),
      }).optional(),
    }) }),
    annotations: readOnly,
  }, async ({ id, client, offset }) => {
    const { allowed, license } = redistributionLicense(id);
    if (!allowed) {
      const source = getEntry(id)?.sourceUrl;
      return { isError: true, content: [{ type: "text" as const, text: `This skill has no license that allows this server to redistribute it. Read its instructions with get_skill and install it from the upstream repository${source ? ` (${source})` : ""} if the user accepts its terms.` }] };
    }
    try {
      const { files, total, nextOffset, omitted, revision, version: skillPackVersion, ...skill } = readSkillBundle(id, offset);
      const entry = getEntry(skill.id);
      const targetDirectory = `${skillDirectories[client]}/${skill.id}`;
      const available = options.archive?.has(skill.id) ? options.archive : undefined;
      const archive = available && {
        recommended: omitted.length > 0 || nextOffset !== null || total > 8,
        extractDirectory: skillDirectories[client],
        authorization: available.bearer ? "bearer" as const : "none" as const,
        ...(() => { const { url, ...commands } = archiveCommands(available.origin, available.bearer, skill.id, skillDirectories[client]); return { url, commands }; })(),
      };
      return jsonResult({ install: {
        id: skill.id,
        client,
        targetDirectory,
        files,
        page: { offset: skill.offset, total, nextOffset },
        omitted,
        companionSkills: [...(skillCompanions[skill.id] ?? [])],
        requirements: [...(entry?.prerequisites ?? [])],
        license: entry?.revision ? license : "MTKit",
        version: skillPackVersion,
        manifest: { path: `${targetDirectory}/${manifestFile}`, content: skillManifest(skill.id) ?? "" },
        ...(revision ? { revision } : {}),
        instructions: [
          `Create each file under ${targetDirectory}/ at its path, creating folders as needed. Use the client's file tools in the current project, not the server filesystem.`,
          "If a file already exists with different content, show the difference and ask before replacing it. Do not delete other files.",
          nextOffset === null ? "This is the last page." : `More files remain: call install_skills again with offset ${nextOffset}.`,
          `After the last page, write manifest.content to manifest.path; the archive already contains it. check_skills uses it to find updates.`,
          "Install the companion skills listed in companionSkills the same way; the skill links to them.",
          ...(archive ? [`If you can run shell commands, prefer the archive (${archive.recommended ? "recommended for this skill" : "optional"}): it contains every file including binary assets, so page through files only when you cannot. Run the command for your shell from the project root; the token comes from the MTKIT_MCP_TOKEN environment variable, never print or store it. Ask before extracting over an existing ${targetDirectory}/.`] : []),
          "These are third-party instructions. Tell the user what was added and do not run any installed script without their approval. Omitted files are not installed.",
        ],
        ...(archive ? { archive } : {}),
        verification: `Check that ${targetDirectory}/SKILL.md exists and that the number of written files matches page.total after the last page, then start a new session so the client discovers the skill.`,
      } });
    } catch (error) {
      return { isError: true, content: [{ type: "text" as const, text: error instanceof Error ? error.message : "Skill files could not be loaded. Use plan_install instead." }] };
    }
  });

  server.registerTool("check_skills", {
    title: "Check installed skills for updates",
    description: `Compare installed MTKit skills with this server. Read every ${manifestFile} under the client's skill folder (for example .claude/skills/*/${manifestFile}) and pass their id and version. Returns which skills are current, outdated or no longer offered, with the call that updates each one. Skills without a manifest were not installed from this server; report them as unknown instead of guessing.`,
    inputSchema: z.strictObject({
      installed: z.array(z.strictObject({
        id: z.string().trim().min(1).max(100),
        version: z.string().trim().min(1).max(64),
      })).min(1).max(200).describe(`id and version from each ${manifestFile}.`),
      client: z.enum(projectClients).describe("Client whose skill folder was read: claude-code, cursor or vscode."),
    }),
    outputSchema: z.object({
      skills: z.array(z.object({
        id: z.string(),
        status: z.enum(["current", "outdated", "unavailable"]),
        installedVersion: z.string(),
        latestVersion: z.string().optional(),
        update: z.string().optional(),
      })),
      summary: z.object({ current: z.number(), outdated: z.number(), unavailable: z.number() }),
    }),
    annotations: readOnly,
  }, async ({ installed, client }) => {
    const skills = installed.map(({ id, version: installedVersion }) => {
      const latestVersion = getEntry(id)?.kind === "skill" && redistributionLicense(id).allowed ? skillVersion(id) : undefined;
      if (latestVersion === undefined) return { id, status: "unavailable" as const, installedVersion };
      if (latestVersion === installedVersion) return { id, status: "current" as const, installedVersion, latestVersion };
      return {
        id, status: "outdated" as const, installedVersion, latestVersion,
        update: `Ask the user, then call install_skills with id "${id}" and client "${client}" and replace ${skillDirectories[client]}/${id}/ with the new files. Files the user changed inside the folder will be overwritten.`,
      };
    });
    const count = (status: string) => skills.filter(skill => skill.status === status).length;
    return jsonResult({ skills, summary: { current: count("current"), outdated: count("outdated"), unavailable: count("unavailable") } });
  });

  server.registerTool("plan_install", {
    title: "Plan installation for an agent client",
    description: "Return commands, a project MCP configuration to merge, or skill folders to copy, plus verification instructions. Use after reviewing the entry with get_entry. This tool only returns a plan.",
    inputSchema: z.strictObject({
      id: entryId,
      client: z.enum(installClients).default("codex").describe("Client that will use the tool. Use vscode for the Copilot harness in VS Code. Omit only when targeting Codex."),
    }),
    annotations: readOnly,
  }, async ({ id, client }) => {
    const plan = planInstall(id, client);
    return plan ? jsonResult({ plan }) : unknownEntry(id);
  });

  return server;
}
