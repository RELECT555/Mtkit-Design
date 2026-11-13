import { navigation } from "../src/app/navigation.ts";
import { homePreview } from "./home-preview.ts";

// Plain HTML is intentional: this view must work before React or the UI kit loads.
// All inputs are authored constants, never URL/query content.
export function loadingShell(path: string) {
  const page = Object.entries(navigation).find(([, route]) => route.href === path)?.[0] ?? "home";
  const title = navigation[page as keyof typeof navigation].label;
  const bar = (size = "") => `<div class="loading-block loading-line ${size}"></div>`;
  const cards = Array.from({ length: 6 }, () => `<div class="loading-card"><div class="loading-block loading-preview"></div><div class="loading-caption">${bar("loading-medium")}${bar("loading-short")}</div></div>`).join("");
  const filters = `<aside class="loading-filters" aria-hidden="true">${bar("loading-medium")}<div class="loading-block loading-input"></div><div class="loading-options">${Array.from({ length: 5 }, () => bar()).join("")}</div></aside>`;
  const links = Object.entries(navigation).map(([id, { href, label, icon }]) => `<li><a href="${href}"${id === page ? ' aria-current="page"' : ""}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icon}"></path></svg><span>${label}</span></a></li>`).join("");
  return `<div id="page-loading" class="page-loading" data-loading-page="${page}">
    <a class="loading-skip" href="#loading-main">К содержанию</a>
    <header class="site-header"><div class="site-header-inner">
      <a class="wordmark" href="/" aria-label="MTKit Design, главная"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span><span>MTKit <strong>Design</strong></span></a>
      <nav class="site-navigation" aria-label="Основная навигация"><ul class="site-nav">${links}</ul></nav>
      <a class="site-connect" href="/#connect">Подключить <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"></path></svg></a>
    </div></header>
    ${page === "home" ? `<main id="loading-main" tabindex="-1">${homePreview()}</main>` : `<main id="loading-main" class="loading-main" tabindex="-1">
      <div class="loading-heading"><h1>${title}</h1><p>${page === "shaders" ? "WebGL-фоны и интерактивные эффекты для React и TypeScript." : "Готовим страницу — скоро всё появится."}</p></div>
      ${page === "shaders" ? filters : ""}
      <section class="loading-content" aria-label="Содержимое страницы">
        <div class="loading-toolbar"><p role="status">Загружаем ${page === "shaders" ? "галерею" : "страницу"}…</p><div aria-hidden="true">${bar()}</div></div>
        <p class="loading-retry" hidden>Загрузка занимает больше времени, чем обычно. <a href="">Попробовать снова</a></p>
        <noscript>Для работы страницы включите JavaScript.</noscript>
        <div class="loading-grid" aria-hidden="true" aria-busy="true">${page === "logo" ? '<div class="loading-block loading-stage"></div>' : cards}</div>
      </section>
    </main>`}
  </div>`;
}

// Embedded in HTML so chunk/network errors cannot leave an endless skeleton.
export function installLoadingStatus() {
  const shell = document.getElementById("page-loading");
  if (!shell) return;
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
