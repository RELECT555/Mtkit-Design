export const featuredToolIds = ["design-screen", "context7", "playwright"] as const;

export const connectIntro = {
  title: "Подключите своего агента",
  description: "MTKit Catalog подбирает навыки и MCP по описанию задачи. В Codex весь набор можно поставить одним плагином. Для остальных агентов инструкции по установке есть в каждой карточке.",
} as const;

export const heroContent = {
  title: ["Навыки и MCP", "для фронтенда"],
  description: "Всё для проектирования, разработки и проверки интерфейсов на React, TypeScript и",
  actions: [
    { href: "#connect", label: "Подключить MCP", icon: "M8 3v10m-4-4 4 4 4-4", variant: "default", style: "primary" },
    { href: "/catalog/", label: "Открыть каталог", icon: "M3 8h10m-4-4 4 4-4 4", variant: "ghost", style: "outline" },
  ],
} as const;

export const workflowExample = {
  title: "Как работает MCP",
  task: "Проверь доступность React-экрана на телефоне и с клавиатуры",
  steps: [
    { id: "recommend", label: "Подбор", tool: "recommend_tools" },
    { id: "entry", label: "Карточка", tool: "get_entry" },
    { id: "install", label: "Подключение", tool: "plan_install" },
  ],
} as const;
