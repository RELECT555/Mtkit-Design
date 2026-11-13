import "../styles.css";
import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

export function mount(page: ReactNode) {
  const root = document.getElementById("root");
  if (!root) throw new Error("Missing application root");
  const homePreview = root.querySelector('[data-loading-page="home"]');
  const active = document.activeElement;
  const focusedTarget = homePreview?.contains(active) ? homeFocusTarget(active) : undefined;
  const app = createRoot(root);
  // Replace the initial HTML atomically and restore keyboard focus on the homepage.
  flushSync(() => app.render(page));
  if (focusedTarget) root.querySelector<HTMLElement>(focusedTarget)?.focus({ preventScroll: true });
  window.dispatchEvent(new Event("mtkit:mounted"));
}

function homeFocusTarget(active: Element | null) {
  if (active?.matches("main, .loading-skip")) return "#main";
  if (!(active instanceof HTMLAnchorElement)) return;
  const section = active.closest("section[id], .hero, .site-header");
  const scope = section?.id ? `#${CSS.escape(section.id)}` : section?.matches(".hero") ? ".hero" : ".site-header";
  return `${scope} a[href="${CSS.escape(active.getAttribute("href") ?? "")}"]`;
}
