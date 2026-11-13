import { catalogConnection, clientLabels, projectMcpConfiguration, skillDirectories, type InstallClient, type ProjectClient } from "./connection.js";
import { getEntry } from "./entries.js";
import type { CatalogEntry, CodexInstallPlan, InstallPlan, InstallStep } from "./types.js";

const checkout = "Корень репозитория MTKit Design";
const installPlugin: readonly InstallStep[] = [
  { command: "npm", args: ["ci"], cwd: checkout },
  { command: "node", args: ["scripts/install.mjs"], cwd: checkout },
];
type ToolConnection = Parameters<typeof projectMcpConfiguration>[2];
const mcpConnections: Partial<Record<string, ToolConnection>> = {
  context7: { type: "http", url: "https://mcp.context7.com/mcp" },
  "shadcn-mcp": { type: "stdio", command: "npx", args: ["--yes", "shadcn@4.23.0", "mcp"] },
  playwright: { type: "stdio", command: "npx", args: ["--yes", "@playwright/mcp@0.0.85", "--headless", "--isolated"] },
  "next-devtools": { type: "stdio", command: "npx", args: ["--yes", "next-devtools-mcp@0.4.0"] },
  "chrome-devtools": { type: "stdio", command: "npx", args: ["--yes", "chrome-devtools-mcp@1.13.0", "--headless", "--isolated"] },
};

export const startLocalCatalog: readonly InstallStep[] = [
  { command: "npm", args: ["ci"], cwd: checkout },
  { command: "npm", args: ["run", "catalog:build"], cwd: checkout },
  { command: "npm", args: ["run", "catalog:serve"], cwd: checkout },
];

function codexPlan(entry: CatalogEntry): CodexInstallPlan | undefined {
  const connection = mcpConnections[entry.id];
  const steps = entry.kind === "skill" || entry.id === "mtkit-catalog" ? installPlugin : connection && [{
    command: "codex",
    args: ["mcp", "add", entry.name, ...(connection.type === "http" ? ["--url", connection.url] : ["--", connection.command, ...connection.args])],
  }];
  const first = steps?.[0];
  if (!steps || !first) return undefined;
  return {
    entryId: entry.id,
    client: "codex",
    scope: "user",
    availability: entry.availability,
    ...first,
    steps,
    ...(entry.availability === "bundled" && steps !== installPlugin ? { bundledSteps: installPlugin } : {}),
    prerequisites: entry.kind === "skill"
      ? ["Локальная копия MTKit Design", "Codex CLI, Node.js 22.12+, npm и tar", ...entry.prerequisites]
      : ["Codex CLI", ...entry.prerequisites.filter(item => item !== "Codex CLI")],
    verification: entry.id === "mtkit-catalog"
      ? "Откройте новый чат Codex и попросите MTKit Catalog найти инструмент для TypeScript. Для отдельного локального HTTP-сервера запустите npm run catalog:serve."
      : entry.kind === "skill"
      ? `Откройте новый чат Codex и найдите ${entry.name} среди навыков плагина MTKit Design. Команда устанавливает весь комплект плагина.`
      : entry.availability === "bundled"
        ? `Если плагин MTKit Design уже установлен, сервер ${entry.name} доступен в новом чате Codex. После отдельного подключения проверьте его через codex mcp list.`
        : `Проверьте сервер ${entry.name} через codex mcp list и откройте новый чат Codex.`,
  };
}

function projectPlan(entry: CatalogEntry, client: ProjectClient): InstallPlan | undefined {
  const base = { entryId: entry.id, client, scope: "project" as const, availability: entry.availability };
  const label = clientLabels[client];
  if (entry.kind === "skill") {
    return {
      ...base,
      steps: entry.sourcePath ? [] : [{ command: "node", args: ["scripts/install.mjs", "--prepare-only"], cwd: checkout }],
      copySkill: { from: `plugins/mtkit-design/skills/${entry.name}/`, to: `${skillDirectories[client]}/${entry.name}/` },
      prerequisites: ["Локальная копия MTKit Design", ...(!entry.sourcePath ? ["Node.js 22.12+ и tar для подготовки навыков"] : []), ...entry.prerequisites],
      verification: `Откройте новый чат ${label} в проекте и проверьте, что агент видит навык ${entry.name}.`,
    };
  }
  const isCatalog = entry.id === "mtkit-catalog";
  const connection = mcpConnections[entry.id];
  const configuration = isCatalog
    ? catalogConnection(client)
    : connection && projectMcpConfiguration(client, entry.name, connection);
  if (!configuration) return undefined;
  return {
    ...base,
    configuration,
    steps: isCatalog ? startLocalCatalog : [],
    prerequisites: isCatalog ? ["Локальная копия MTKit Design", "Node.js 22.12+ и npm"] : entry.prerequisites,
    verification: `Откройте новый чат ${label} в проекте и проверьте, что доступны инструменты ${entry.name}.`,
  };
}

export function planInstall(id: string, client?: "codex"): CodexInstallPlan | undefined;
export function planInstall(id: string, client: InstallClient): InstallPlan | undefined;
export function planInstall(id: string, client: InstallClient = "codex"): InstallPlan | undefined {
  const entry = getEntry(id);
  if (!entry) return undefined;
  return client === "codex" ? codexPlan(entry) : projectPlan(entry, client);
}
