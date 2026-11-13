import { navigation } from "../src/app/navigation.ts";

export function routeTransitionHead() {
  const routes = Object.values(navigation).map(({ href }) => href);
  // Chromium can check the incoming document's opt-in before its stylesheets load.
  return `<style>@media (prefers-reduced-motion: no-preference) { @view-transition { navigation: auto; } }</style>
    <script>(${installRouteTransitions.toString()})(${JSON.stringify(routes)});</script>`;
}

function installRouteTransitions(routes: string[]) {
  window.addEventListener("pageswap", (event) => {
    // The outgoing document's ready promise rejects after it hands off the snapshot.
    void event.viewTransition?.ready.catch(() => {});
  });
  window.addEventListener("pagereveal", (event) => {
    const transition = event.viewTransition;
    if (!transition) return;
    void transition.ready.catch(() => {});

    const activation = (window as Window & { navigation?: { activation: NavigationActivation | null } }).navigation?.activation;
    if (!activation) return;
    const { from, entry: to } = activation;
    if (!from?.url || !to?.url) return;
    const start = routes.indexOf(new URL(from.url).pathname.replace(/\/?$/, "/"));
    const end = routes.indexOf(new URL(to.url).pathname.replace(/\/?$/, "/"));
    if (start < 0 || end < 0) return;
    const direction = activation.navigationType === "traverse" ? to.index - from.index : end - start;
    if (direction === 0) return;

    const root = document.documentElement;
    root.dataset.routeDirection = direction > 0 ? "forward" : "back";
    const clearDirection = () => { delete root.dataset.routeDirection; };
    void transition.finished.then(clearDirection, clearDirection);
  });
}
