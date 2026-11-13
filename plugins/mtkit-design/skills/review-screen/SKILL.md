---
name: review-screen
description: Review or test an existing Medipal web interface. Use for requests to inspect a route, compare a screen to a reference, verify desktop or mobile layout, check keyboard access, or test a user flow in a browser.
---

For a standalone review, use MTKit Catalog's `recommend_tools` when available with a short task summary. If project setup has not yet been checked in this session, request `bootstrap_project` for the current client and follow its guidance. Review-only tasks do not authorize writing project instruction files; keep setup guidance in-session. Read selected skills before applying them. Open the target route with an available browser tool such as Playwright MCP or `playwright-cli`. If the app is down, use the project's documented local start command when the task permits it. Record the route and reference, if provided. If you cannot open the screen, report the blocker and label any source-only findings as unverified in the browser.

- Check the primary action, long labels, layout, and horizontal overflow at the project's desktop and mobile widths. Use 1440 and 390 pixels when the project has no target sizes.
- Complete the primary flow with test data. Check keyboard navigation, focus order and visibility, and dialog dismissal when relevant. For async flows, check loading, error, and empty states. Check reduced motion when the change includes animation.
- Compare rendered colors, typography, and control states with the project's theme or mockup. For a canvas grid, pair a screenshot with an interaction check because the accessibility snapshot may omit rendered cells.

For a review-only request, report findings with reproduction steps and keep the project files untouched. If the user asks for fixes, rerun the affected checks after editing. Report browser evidence, automated checks, and anything you could not verify. Include screenshots or their paths when they help explain the result. Reply in the user's language.
