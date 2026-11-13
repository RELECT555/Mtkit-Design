import "../styles.css";
import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

const routes = ["/", "/catalog/", "/shaders/", "/shaders/components/", "/logo/"];

function routePosition(url: string) {
  const path = new URL(url).pathname.replace(/\/?$/, "/");
  return routes.indexOf(path);
}

window.addEventListener("pagereveal", (event) => {
  const activation = (window as Window & { navigation?: { activation: NavigationActivation | null } }).navigation?.activation;
  if (!event.viewTransition || !activation) return;
  const { from, entry: to } = activation;
  if (!from?.url || !to?.url) return;

  const start = routePosition(from.url);
  const end = routePosition(to.url);
  const direction = activation.navigationType === "traverse" ? to.index - from.index : end - start;
  if (start < 0 || end < 0 || direction === 0) return;

  const root = document.documentElement;
  root.dataset.routeDirection = direction > 0 ? "forward" : "back";
  void event.viewTransition.finished.finally(() => { delete root.dataset.routeDirection; });
});

export function mount(page: ReactNode) {
  const root = document.getElementById("root");
  if (!root) throw new Error("Missing application root");
  const app = createRoot(root);
  // Commit the first view before the browser captures it for navigation.
  flushSync(() => app.render(page));
}
