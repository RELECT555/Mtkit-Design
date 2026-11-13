import type { ComponentType } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { Layout } from "./Layout";
import { installNavigation } from "./route-navigation";
import { pageTitle, type PageId } from "./navigation";

export function mount(initialPage: PageId, InitialContent: ComponentType) {
  const root = document.getElementById("root");
  if (!root) throw new Error("Missing application root");
  const preview = root.querySelector("#page-loading");
  const active = document.activeElement;
  const focusedTarget = preview?.contains(active) ? previewFocusTarget(active) : undefined;
  const app = createRoot(root);
  let visit = 0;
  function render(page: PageId, Content: ComponentType) {
    document.title = pageTitle(page);
    flushSync(() => app.render(<Layout page={page}><Content key={visit++} /></Layout>));
  }
  // Replace the initial HTML atomically and restore focus on shared links.
  render(initialPage, InitialContent);
  if (focusedTarget) root.querySelector<HTMLElement>(focusedTarget)?.focus({ preventScroll: true });
  installNavigation(root, initialPage, InitialContent, render);
  window.dispatchEvent(new Event("mtkit:mounted"));
}

function previewFocusTarget(active: Element | null) {
  if (active?.matches("main")) return "#main";
  if (active?.matches(".skip-link")) return ".skip-link";
  if (!(active instanceof HTMLAnchorElement)) return;
  if (active.matches(".tool-detail-link")) {
    return `.tool-actions button[aria-label="${CSS.escape(active.getAttribute("aria-label") ?? "")}"]`;
  }
  const section = active.closest("section[id], .hero, .site-header");
  const scope = section?.id ? `#${CSS.escape(section.id)}` : section?.matches(".hero") ? ".hero" : section?.matches(".site-header") ? ".site-header" : ".site-content";
  return `${scope} a[href="${CSS.escape(active.getAttribute("href") ?? "")}"]`;
}
