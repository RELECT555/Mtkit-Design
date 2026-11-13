# MTKit Design architecture

MTKit Design ships a static website, a Codex plugin, and an MCP catalog that can also run as a team service. The website and the MCP service build against the same catalog source. They can be deployed independently.

| Boundary | Owns |
| --- | --- |
| `packages/catalog` | Catalog types and entries, search and task recommendations, installation recipes for supported agent clients, and shared endpoint rules. It runs in both the browser and Node.js. |
| `apps/web` | Static React pages, UI state, and navigation. The site uses `@mtkit/ui` from Azure Artifacts. The hosted MCP address is optional build-time configuration used to display client-specific connection instructions. |
| `packages/mcp` | MCP tool and resource registration, stdio and HTTP transports, and runtime configuration. The server returns installation steps for the client to execute. |
| `scripts/install.mjs` and `plugins/mtkit-design` | Assembly and registration of the local Codex plugin. The plugin combines authored and pinned external skills, the catalog executable, and the other MCP server definitions. |

Both the website and MCP depend on the public API of `packages/catalog`. The package generates configuration examples without reading credentials or writing to client configuration files. Keep React, the MCP SDK, and filesystem access in the consumers. Node-specific build scripts can check the source tree. Keep transport checks in the MCP package and Codex writes in the installer.

## Catalog changes

- Add external skills to `packages/catalog/external-skills.json` with their upstream revision and path. Add descriptions and categories in `packages/catalog/entries.ts`.
- Update `plugins/mtkit-design/.mcp.json` for bundled MCP servers. Keep catalog entries and the recipes in `packages/catalog/install.ts` aligned with that manifest.
- Use `queryCatalog` for listings. It returns the current page, the total number of matches, and the next offset. Site controls and MCP schemas own their own input and page-size limits.
- Use `recommendForTask` for natural-language tasks. The MCP tool and site example share the same recommendation rules. The client decides which available tools and skills to use for the requested work.
- Use `npm run catalog:inventory` to check that catalog entries, bundled tools, install steps, revisions, and source paths agree. The installer checks this before registering the plugin. The Azure site build also runs this check.

## Build and release boundaries

The root lockfile covers the public dependencies required to build the MCP and install the plugin. The website has its own lockfile and private feed access. The installer generates the local marketplace manifest after preparation and verification. The generated manifest, downloaded skills, and catalog bundle are build artifacts.

| Change | Verification |
| --- | --- |
| Catalog or MCP | `npm run catalog:check`, `npm run catalog:inventory`, `npm run catalog:build`, `npm run catalog:smoke` |
| Plugin assembly | `npm run install:test`, then install in an isolated Codex profile |
| Website | `npm run web:build`, then verify affected routes and interactions in a browser |

See [web deployment](deploy-web.md) for Azure Static Web Apps and [MCP deployment](deploy-mcp.md) for the corporate server.
