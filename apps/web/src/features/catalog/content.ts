export const catalogIntro = {
  title: "Навыки и MCP",
  description: "Найдите инструмент для TypeScript и React. Откройте карточку, чтобы проверить требования, перейти к источнику и получить инструкцию для вашего агента.",
  searchPlaceholder: "Например, доступность или Playwright",
};

export const catalogPageSize = 12;
export const catalogKinds = [
  { value: "", label: "Все инструменты" },
  { value: "skill", label: "Навыки" },
  { value: "mcp", label: "MCP-серверы" },
] as const;

export const catalogSummaryRows = [
  ["Навыки в каталоге", "skills"],
  ["MCP в плагине Codex", "bundledMcp"],
  ["MCP с отдельным подключением", "optional"],
] as const;
