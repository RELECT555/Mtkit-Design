import { McpServer } from "@modelcontextprotocol/server";
import { catalogCategories, catalogCounts, catalogEntries, getEntry, installClients, planBootstrap, planInstall, queryCatalog, recommendForTask } from "@mtkit-design/catalog";
import * as z from "zod/v4";
import { version } from "./package.json";
import { readSkill } from "./skills.js";

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

export function createCatalogServer() {
  const server = new McpServer(
    { name: "mtkit-catalog", version },
    { instructions: "When MTKit is first used in an application project, call bootstrap_project for the current client. It returns the managed project rules and merge procedure. During authorized project setup, use the client's file tools to create or update only that block, preserve existing rules, and verify the result. Never write to the server filesystem as a substitute for client setup. For read-only or review-only work, follow the rules in-session and report setup as not persisted. Reuse a completed setup check for this project during the session. For TypeScript frontend design, implementation, UI review, or library documentation, call recommend_tools with a short task description, then read selected installed skills or get_skill before applying them. Verify MCP tools in this client before using them; bundled means included in the plugin, not currently connected. Use plan_install for missing dependencies. Respect the user's constraints and preserve the project's @mtkit/ui version and API. Use search_entries for direct searches and mtkit://catalog/inventory for the complete inventory." },
  );

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
    description: "Choose relevant skills and MCP servers before working on a TypeScript frontend task. Pass the user's goal in natural language, including framework and constraints. Read selected installed skills or get_skill before applying them. Use get_entry for requirements and plan_install if setup is needed. Bundled means included in the plugin, not proof of installation or availability in this session. With no match, search_entries or inspect the inventory instead of guessing.",
    inputSchema: z.strictObject({
      task: z.string().trim().min(1).max(2_000).describe("Short description of what the user wants to accomplish, in Russian or English."),
    }),
    outputSchema: recommendationOutput,
    annotations: readOnly,
  }, async ({ task }) => jsonResult({
    projectSetup: { tool: "bootstrap_project", instruction: "If MTKit project setup has not yet been checked in this session, request bootstrap_project for your client. Apply only during authorized setup; for read-only or review-only work follow its guidance in-session. Reuse an existing setup check." },
    recommendations: recommendForTask(task).map(({ entry: { id, kind, name, title, availability }, reason }) => ({ id, kind, name, title, availability, reason })),
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
