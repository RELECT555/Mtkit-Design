# MTKit Design architecture

MTKit Design ships a static website, a Codex plugin, and an MCP catalog that can also run as a team service. The website and the MCP service build against the same catalog source. They can be deployed independently.

| Boundary | Owns |
| --- | --- |
| `packages/catalog` | Catalog types and entries, search and task recommendations, installation recipes, project bootstrap guidance for supported agent clients, and shared endpoint rules. It runs in both the browser and Node.js. |
| `apps/web` | Static React pages, UI state, and navigation. The site uses `@mtkit/ui` from Azure Artifacts. The hosted MCP address is optional build-time configuration used to display client-specific connection instructions. |
| `packages/mcp` | MCP tool and resource registration, stdio and HTTP transports, runtime configuration, and reading selected skill instructions. The server returns installation steps for the client to execute. |
| `scripts/install.mjs` and `plugins/mtkit-design` | Assembly and registration of the local Codex plugin. The plugin combines authored and pinned external skills, the catalog executable, and the other MCP server definitions. An explicit `--project` target also sets up that application's routing rules. |
| `scripts/setup-project.mjs` and `scripts/project-rules.mjs` | Local project rule setup. They merge the shared MTKit block into the explicitly selected application's instruction file and preserve surrounding content. |

Both the website and MCP depend on the public API of `packages/catalog`. The package generates configuration examples without reading credentials or writing to client configuration files. Keep React, the MCP SDK, and filesystem access in the consumers. Node-specific build scripts can check the source tree. Keep transport checks in the MCP package and Codex writes in the installer.

Each website route has its own static HTML entry for direct visits and browsers without JavaScript. Once React mounts, internal links share one layout and keep the current content visible until the destination module and styles are ready.

Project bootstrap content and client instruction-file mapping live in `packages/catalog/project-rules.json`; `packages/catalog/bootstrap.ts` exposes the pure plan. Both the local setup code and `bootstrap_project` use this shared definition. The MCP tool returns a managed block and merge guidance; it does not write to the caller's filesystem or certify installation. Local writes belong in the installer modules, and remote-only clients apply the plan using their own workspace tools and permissions. Initialization instructions request bootstrap during onboarding, but the MCP protocol does not force a client to execute it.

## Catalog changes

- Add external skills to `packages/catalog/external-skills.json` with their upstream revision and path. Add descriptions and categories in `packages/catalog/entries.ts`.
- Update `plugins/mtkit-design/.mcp.json` for bundled MCP servers. Keep catalog entries and the recipes in `packages/catalog/install.ts` aligned with that manifest.
- Use `queryCatalog` for listings. It returns the current page, the total number of matches, and the next offset. Site controls and MCP schemas own their own input and page-size limits.
- Use `recommendForTask` for natural-language tasks. The MCP tool and site example share the same recommendation rules. The client decides which available tools and skills to use for the requested work.
- Keep project rules concise and shared. Setup must be idempotent, preserve instructions outside the MTKit markers, and fail on ambiguous markers or unsafe filesystem targets. Never infer a consumer project from the catalog checkout or use bootstrap to alter client permissions, credentials or UI package versions.
- Recommendations use bounded, curated rules, not a language model. Keep RU/EN scenario coverage in `packages/catalog/recommend.test.mjs`, including constraints and unrelated requests. An empty result allows the agent to fall back to catalog search; it does not prove that no suitable skill exists.
- `get_skill` delivers the authored Markdown embedded in the MCP bundle, so remote clients do not need the server filesystem. External Markdown is fetched on demand from a fixed GitHub revision in `external-skills.json`, with path, timeout and size bounds. Local helper scripts and other MCP processes remain client responsibilities. Do not add filesystem or network access to the shared browser catalog.
- Use `npm run catalog:inventory` to check that catalog entries, bundled tools, install steps, revisions, and source paths agree. The installer checks this before registering the plugin. The Azure site build also runs this check.

## Build and release boundaries

The root lockfile covers the public dependencies required to build the MCP and install the plugin. The website has its own lockfile and private feed access. The installer generates the local marketplace manifest after preparation and verification. The generated manifest, downloaded skills, and catalog bundle are build artifacts.

| Change | Verification |
| --- | --- |
| Catalog or MCP | `npm run catalog:check`, `npm run catalog:test`, `npm run catalog:inventory`, `npm run catalog:build`, `npm run catalog:smoke` |
| Plugin assembly or project bootstrap writes | `npm run install:test`, then install in an isolated Codex profile or test setup against temporary project files as applicable |
| Website | `npm run web:build`, then verify affected routes and interactions in a browser |

See [web deployment](deploy-web.md) for Azure Static Web Apps and [MCP deployment](deploy-mcp.md) for the corporate server.

`npm run catalog:integrations` is an explicit network/browser check of Context7, shadcn and Playwright using temporary fixtures. `npm run catalog:agent-eval` uses authenticated Codex CLI in an ephemeral session to check natural-language planning, recommendations and instruction reads. Its optional `-- --with-browser` adds an agent-driven review and retains client permission restrictions. These opt-in checks are separate from deterministic CI tests and may use service quotas. See the [readiness report](mcp-readiness.md) for verified behavior and deployment gaps.
