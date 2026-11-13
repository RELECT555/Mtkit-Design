---
name: design-screen
description: Design, build, or redesign Medipal web interfaces with @mtkit/ui. Use for requests to create a screen, form, dashboard, or small CRM from a brief, an existing app shell, or a mockup.
---

When MTKit Catalog is available, call `recommend_tools` with a short task summary to select supporting skills and tools. Follow the [catalog recommendation workflow](references/catalog-recommendations.md) for availability and setup. Build the screen around the user's primary task. Inspect the project instructions, the app shell, nearby screens, design tokens, and installed UI components before editing. Use the supplied mockup for layout. With only a shell to work from, derive navigation, density, and action placement from the existing app. Preserve the app's localization and report in the user's language.

For a new app, start with the team's template if available. If the request includes scaffolding and no template is available, start with React 19 and use the [MTKit integration guide](references/mtkit.md).

1. Identify the main action, the information needed to make a decision, and the states that affect the flow. For an overdue requests screen, put the deadline beside the status, make overdue requests easy to find, and let the manager assign an owner from the row. Show alternative layouts when the choice changes how the user works.
2. Use the installed MTKit and project components. Check their exported types and examples before writing imports or props. If MTKit is missing or the screen needs `@mtkit/data-grid-table`, read the [MTKit integration guide](references/mtkit.md). Start with the project's regular table for a simple list. Consider the canvas grid for features such as formulas or Excel import/export.
3. When a project has `components.json`, use shadcn MCP to find composition examples or missing blocks. Look up public dependency APIs through the [Context7 workflow](../library-docs/SKILL.md) when the implementation depends on them.
4. Follow the [browser review workflow](../review-screen/SKILL.md). Show the screen at desktop and mobile widths and verify the primary action and the states that affect it.
