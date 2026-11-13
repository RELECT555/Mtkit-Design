import type { EntryAvailability, EntryKind } from "@mtkit-design/catalog";

export const kindLabel: Record<EntryKind, string> = { skill: "Навык", mcp: "MCP-сервер" };
export const availabilityLabel: Record<EntryAvailability, string> = {
  bundled: "В плагине Codex",
  optional: "Отдельно",
};
