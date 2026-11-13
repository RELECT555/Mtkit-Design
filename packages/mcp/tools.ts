import { McpServer } from "@modelcontextprotocol/server";
import { catalogCategories, catalogCounts, catalogEntries, getEntry, installClients, planInstall, queryCatalog } from "@mtkit-design/catalog";
import * as z from "zod/v4";
import { version } from "./package.json";

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

const entryId = z.string().trim().min(1).max(100).describe("Catalog entry ID returned by search_entries.");

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
    { instructions: "Browse the complete catalog at mtkit://catalog/inventory or find a curated TypeScript tool with search_entries. Review its source and requirements with get_entry, then request installation steps for your client with plan_install." },
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

  server.registerTool("list_categories", {
    title: "List catalog categories",
    description: "Get the category names used by search_entries and the current inventory counts.",
    inputSchema: z.strictObject({}),
    annotations: readOnly,
  }, async () => jsonResult({ categories: catalogCategories, counts: catalogCounts }));

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
