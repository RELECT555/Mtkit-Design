import { navigation } from "../src/app/navigation.ts";
import { catalogPreview } from "./catalog-preview.ts";
import { componentsPreview } from "./components-preview.ts";
import { guidePreview } from "./guide-preview.ts";
import { homePreview } from "./home-preview.ts";
import { logoPreview } from "./logo-preview.ts";
import { shaderPreview } from "./shader-preview.ts";

const previews = { home: homePreview, catalog: catalogPreview, guide: guidePreview, shaders: shaderPreview, components: componentsPreview, logo: logoPreview };

// The route's first frame is HTML and uses the same styles as the mounted page.
export function loadingShell(path: string, hasHostedEndpoint: boolean) {
  const routes = Object.keys(navigation) as Array<keyof typeof navigation>;
  const page = routes.find((id) => navigation[id].href === path) ?? "home";
  const links = Object.entries(navigation).map(([id, { href, label, icon }]) => `<li><a href="${href}"${id === page ? ' aria-current="page"' : ""}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icon}"></path></svg><span>${label}</span></a></li>`).join("");
  return `<div id="page-loading" class="site-layout" data-loading-page="${page}">
    <a class="skip-link" href="#main">К содержанию</a>
    <header class="site-header"><div class="site-header-inner">
      <a class="wordmark" href="/" aria-label="MTKit Design, главная"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span><span>MTKit <strong>Design</strong></span></a>
      <nav class="site-navigation" aria-label="Основная навигация"><ul class="site-nav">${links}</ul></nav>
      <a class="site-connect" href="/#connect">Подключить <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"></path></svg></a>
    </div></header>
    <div class="site-content">
      <main id="main" data-page="${page}" tabindex="-1">${previews[page](hasHostedEndpoint)}</main>
      <footer class="footer"><div class="page-container footer-inner"><span>MTKit Design <span class="footer-divider">/</span> Medipal</span><a href="/catalog/">Открыть каталог <span aria-hidden="true">→</span></a></div></footer>
    </div>
  </div>`;
}

// Embedded in HTML so chunk/network errors cannot leave an endless skeleton.
export function installLoadingStatus() {
  const shell = document.getElementById("page-loading");
  if (!shell) return;
  if (shell.dataset.loadingPage === "shaders") {
    const selected = new URLSearchParams(location.search).get("shader");
    const detail = [...shell.querySelectorAll<HTMLTemplateElement>("template[data-shader-preview]")].find((template) => template.dataset.shaderPreview === selected);
    if (detail) {
      const gallery = shell.querySelector("[data-shader-gallery-preview]");
      gallery?.replaceWith(detail.content.cloneNode(true));
      const heading = shell.querySelector("#shader-title");
      if (heading) document.title = `${heading.textContent} · MTKit Design`;
    }
  }
  const routes = [...shell.querySelectorAll<HTMLAnchorElement>(".site-nav a:not(.site-connect)")].map((link) => new URL(link.href).pathname);
  // Register before the render snapshot, rather than waiting for React's bundle.
  window.addEventListener("pageswap", (event) => {
    void event.viewTransition?.ready.catch(() => {});
  });
  window.addEventListener("pagereveal", (event) => {
    const transition = event.viewTransition;
    if (!transition) return;
    // The browser may skip a transition after a navigation or motion change.
    void transition.ready.catch(() => {});
    const activation = (window as Window & { navigation?: { activation: NavigationActivation | null } }).navigation?.activation;
    if (!activation?.from?.url || !activation.entry.url) return;
    const { from, entry: to } = activation;
    const start = routes.indexOf(new URL(from.url!).pathname.replace(/\/?$/, "/"));
    const end = routes.indexOf(new URL(to.url!).pathname.replace(/\/?$/, "/"));
    const direction = activation.navigationType === "traverse" ? to.index - from.index : end - start;
    if (start < 0 || end < 0 || direction === 0) return;
    const root = document.documentElement;
    root.dataset.routeDirection = direction > 0 ? "forward" : "back";
    const clearDirection = () => { delete root.dataset.routeDirection; };
    void transition.finished.then(clearDirection, clearDirection);
  });
  const controller = new AbortController();
  const revealRetry = () => {
    const retry = shell.querySelector<HTMLElement>(".loading-retry");
    if (retry) retry.hidden = false;
  };
  const timer = window.setTimeout(revealRetry, 12000);
  window.addEventListener("error", (event) => {
    if (event.target instanceof HTMLScriptElement && event.target.type === "module") {
      const status = shell.querySelector('[role="status"]');
      if (status) status.textContent = shell.dataset.loadingPage === "home"
        ? "Не удалось загрузить варианты подключения."
        : "Не удалось загрузить страницу.";
      revealRetry();
    }
  }, { capture: true, signal: controller.signal });
  window.addEventListener("mtkit:mounted", () => {
    clearTimeout(timer);
    controller.abort();
  }, { once: true });
}
