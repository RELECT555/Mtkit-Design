import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

export function mount(page: ReactNode) {
  const root = document.getElementById("root");
  if (!root) throw new Error("Missing application root");
  const preview = root.querySelector("#page-loading");
  const active = document.activeElement;
  const focusedTarget = preview?.contains(active) ? previewFocusTarget(active) : undefined;
  const app = createRoot(root);
  // Replace the initial HTML atomically and restore focus on shared links.
  flushSync(() => app.render(page));
  if (focusedTarget) root.querySelector<HTMLElement>(focusedTarget)?.focus({ preventScroll: true });
  window.dispatchEvent(new Event("mtkit:mounted"));
}

function previewFocusTarget(active: Element | null) {
  if (active?.matches("main")) return "#main";
  if (active?.matches(".skip-link")) return ".skip-link";
  if (!(active instanceof HTMLAnchorElement)) return;
  const section = active.closest("section[id], .hero, .site-header");
  const scope = section?.id ? `#${CSS.escape(section.id)}` : section?.matches(".hero") ? ".hero" : ".site-header";
  return `${scope} a[href="${CSS.escape(active.getAttribute("href") ?? "")}"]`;
}
