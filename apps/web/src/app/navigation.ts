export const navigation = {
  home: { href: "/", label: "О плагине", icon: "M3 10.5 12 3l9 7.5V21H3z M9 21v-7h6v7" },
  catalog: { href: "/catalog/", label: "Каталог", icon: "M4 5h16v4H4z M4 11h16v4H4z M4 17h16v3H4z" },
  guide: { href: "/guide/", label: "Как работать", icon: "M5 3.5h11A2 2 0 0 1 18 5.5V21H7a3 3 0 0 1 0-6h11M5 3.5V16M8 7h7M8 10h5" },
  shaders: { href: "/shaders/", label: "Шейдеры", icon: "M3 7c3-5 6-5 9 0s6 5 9 0 M3 12c3-5 6-5 9 0s6 5 9 0 M3 17c3-5 6-5 9 0s6 5 9 0" },
  components: { href: "/shaders/components/", label: "Компоненты", icon: "M8 3l5 5-5 5-5-5z M15 4h5v5h-5z M4 15h5v5H4z M13 13h7v7h-7z" },
  logo: { href: "/logo/", label: "Логотип", icon: "M12 3 3.5 7.5v9L12 21l8.5-4.5v-9L12 3Z M3.5 7.5 12 12l8.5-4.5 M12 12v9" },
} as const;

export type PageId = keyof typeof navigation;

const pagesByPath = new Map<string, PageId>(
  (Object.keys(navigation) as PageId[]).map((page) => [navigation[page].href, page]),
);

export function pageForPath(path: string) {
  return pagesByPath.get(path.replace(/\/index\.html$/, "/").replace(/\/?$/, "/"));
}

export function pageTitle(page: PageId) {
  return page === "home" ? "MTKit Design · Навыки и MCP для фронтенда" : `${navigation[page].label} · MTKit Design`;
}
