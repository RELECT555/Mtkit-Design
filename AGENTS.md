# MTKit Design

Read [docs/architecture.md](docs/architecture.md) before changing package boundaries, catalog data, or release tooling. It describes where code belongs and which checks apply.

- Share catalog data, search, and install recipes through `@mtkit-design/catalog`. Keep browser state in `apps/web`, transport code in `packages/mcp`, and local plugin writes in `scripts/install.mjs` and its installer modules.
- Build UI with the existing `@mtkit/ui` components. Verify affected routes and interactions in a browser at desktop and mobile widths.
- Keep the site independently buildable as static files. Run the inventory check when changing entries, bundled tools, or installation recipes.
