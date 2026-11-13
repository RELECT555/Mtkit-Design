import type { ComponentType } from "react";
import { pageForPath, type PageId } from "./navigation";

const loadPage = {
  home: () => import("../pages/HomePage").then((module) => module.HomePage),
  catalog: () => import("../pages/CatalogPage").then((module) => module.CatalogPage),
  guide: () => import("../pages/GuidePage").then((module) => module.GuidePage),
  shaders: () => import("../pages/ShadersPage").then((module) => module.ShadersPage),
  components: () => import("../pages/ComponentsPage").then((module) => module.ComponentsPage),
  logo: () => import("../pages/LogoPage").then((module) => module.LogoPage),
} satisfies Record<PageId, () => Promise<ComponentType>>;

function routeLink(event: Event) {
  const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
  if (!link || link.hasAttribute("download") || (link.target && link.target.toLowerCase() !== "_self")) return;
  const url = new URL(link.href);
  const page = url.origin === location.origin ? pageForPath(url.pathname) : undefined;
  if (page) return { url, page };
}

function hashTarget(hash: string) {
  if (!hash) return;
  try {
    return document.getElementById(decodeURIComponent(hash.slice(1)));
  } catch {
    return;
  }
}

function focusContent(root: HTMLElement, target?: HTMLElement | null) {
  if (root.querySelector("dialog[open]")) return;
  if (target) {
    if (target.tabIndex < 0 && !target.hasAttribute("tabindex")) target.tabIndex = -1;
    target.focus({ preventScroll: true });
  } else {
    root.querySelector<HTMLElement>("#main")?.focus({ preventScroll: true });
  }
}

export function installNavigation(
  root: HTMLElement,
  initialPage: PageId,
  InitialContent: ComponentType,
  render: (page: PageId, Content: ComponentType) => void,
) {
  const ready = new Map<PageId, ComponentType>([[initialPage, InitialContent]]);
  const loading = new Map<PageId, Promise<ComponentType>>();
  let currentPage = initialPage;
  let intent = 0;

  function prepare(page: PageId) {
    const pending = loading.get(page);
    if (pending) return pending;
    const request = loadPage[page]().then((Content) => {
      ready.set(page, Content);
      loading.delete(page);
      return Content;
    });
    // Keep failures so a click after a failed prefetch falls back to the static page.
    loading.set(page, request);
    return request;
  }

  function prefetch(event: Event) {
    const route = routeLink(event);
    if (route && !ready.has(route.page)) void prepare(route.page).catch(() => {});
  }

  function commit(page: PageId, Content: ComponentType, url: URL) {
    // pushState does not clear a native :target; discard that element when leaving its anchor.
    const replaceContent = page !== currentPage || url.search !== location.search || url.hash !== location.hash;
    if (url.href !== location.href) history.pushState(null, "", url);
    if (replaceContent) {
      currentPage = page;
      render(page, Content);
    }
    const target = hashTarget(url.hash);
    focusContent(root, target);
    if (target) target.scrollIntoView({ block: "start" });
    else window.scrollTo(0, 0);
  }

  root.addEventListener("focusin", prefetch);
  root.addEventListener("pointerover", prefetch);
  root.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const route = routeLink(event);
    if (!route) return;
    const { page, url } = route;
    const request = ++intent;
    // Leave links to anchors on the current page to the browser (including the skip link).
    if (url.hash && url.pathname === location.pathname && url.search === location.search) return;
    event.preventDefault();

    const Content = ready.get(page);
    if (Content) {
      commit(page, Content, url);
      return;
    }
    const from = location.href;
    // Keep the current page visible until the new component and its CSS are ready.
    void prepare(page).then((LoadedContent) => {
      if (intent === request && location.href === from) commit(page, LoadedContent, url);
    }, () => {
      if (intent === request && location.href === from) location.assign(url);
    });
  });

  window.addEventListener("popstate", () => {
    ++intent;
    const page = pageForPath(location.pathname);
    if (!page || page === currentPage) return;
    // Every route visited in this document is cached. Render synchronously so
    // the browser can restore the scroll position on the correct page.
    const Content = ready.get(page);
    if (!Content) return;
    currentPage = page;
    render(page, Content);
    focusContent(root, hashTarget(location.hash));
  }, { capture: true });
}
