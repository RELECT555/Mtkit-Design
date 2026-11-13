# Frontend skill guide

Follow the user's request and the target project's `AGENTS.md`, design system, and component conventions. Use the app's existing patterns and installed MTKit API for product UI. External skills supplement those decisions. Keep changes within the requested screen or flow, including when a design skill suggests app-wide styles, a new theme, or shadcn initialization.

## Choose guidance by task

| Task | Skills |
| --- | --- |
| Structure a product screen | `ui-ux-pro-max` for an unresolved layout or UX question, `design-system` for changes to tokens or shared components |
| Establish a new visual direction | `design-taste-frontend` for a new marketing surface, `hallmark` for a new page within its scope or an explicit Hallmark redesign, or one art-direction skill if the user asks to explore styles |
| Refine an existing design | `impeccable` for project context and visual QA, or `emil-design-eng` for interaction details |
| Implement a mockup or compare layouts | `build-design` for a reference image, `prototype` or `variant` for alternatives |
| Compose shadcn/Tailwind UI | `shadcn` or `ui-styling` when the project uses those primitives |
| Change React implementation or component APIs | `vercel-react-best-practices` or `vercel-composition-patterns` |
| Review layout or harden edge states | `better-interface` for a broad review, `break-ui` for long labels, missing values, or extreme counts |
| Review web quality | `web-quality-audit` for a broad audit, or `accessibility`, `performance`, or `core-web-vitals` for a targeted check |
| Fix UI details | `fixing-accessibility` for keyboard and focus issues, `baseline-ui` or `make-interfaces-feel-better` for polish, `improve-ui` for a review and plan |
| Change color, mobile behavior, or metadata | `color-expert`, `mobile-native`, `seo`, or `fixing-metadata` as appropriate |
| Implement motion | Select the matching GSAP skill by API or integration. For review, choose `review-animations`, `improve-animations`, `find-animation-opportunities`, or `fixing-motion-performance` by the question being asked. |
| Choose a library or deploy to Vercel | `pick-ui-library` or `deploy-to-vercel` when requested |

Resolve helper paths relative to the installed skill. For example, use `scripts/search.py` next to the UI UX Pro Max skill with Python 3. Some examples use Claude-specific environment variables. Check the selected skill's runtime requirements before running its helpers.

Use the [browser review workflow](../../review-screen/SKILL.md) for rendered checks and [Context7](../../library-docs/SKILL.md) for version-sensitive public APIs. Apply the target project's changelog rules when they exist.

`unlazy`, `antivibe`, `improve`, Finding Unknowns, and file-based review support their own workflows. A Claude Code reviewer can use the [matching protocol](https://github.com/Serg2000Mr/dual-review-file-based/tree/633f07629f30379566f7da7e13be32ab9eff35ec/claude-code).
