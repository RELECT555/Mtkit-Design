# MTKit MCP verification — 2026-11-13

The local catalog works across stdio and Streamable HTTP, can recommend skills from a task, and can deliver their instructions. The checks below establish specific behavior; they do not guarantee perfect selection for every prompt or certify a production deployment.

## Verified behavior

| Check | Evidence |
| --- | --- |
| Types, inventory, builds | `catalog:check`, `catalog:inventory`, `catalog:build`, and `web:build` pass. Catalog contains 78 skills and 6 MCP entries: 82 bundled entries and 2 optional MCPs. |
| Task selection, bootstrap and instruction retrieval | `catalog:test`: 67 passing checks covering supported instruction files, setup plans, Russian/English tasks, review-only and library constraints, design helpers, unrelated requests, authored references, pinned external reads and actionable source failures. |
| MCP protocol | `catalog:smoke` passes stdio, loopback HTTP and hosted HTTP with a bearer token. Includes tool discovery, initialization instructions, inventory, search, pagination, recommendations, skill contents, install plans, malformed/oversized requests, Host/Origin guards and concurrent requests. |
| Standalone executable | Smoke copies only `catalog.cjs` into a fresh temporary directory and verifies tools and authored references without project sources or node_modules. |
| Clean plugin install | Fresh isolated checkout/profile downloaded 75 external skills from 21 pinned GitHub sources and registered the plugin. All 78 SKILL.md files exist. Reinstallation refreshes cached skill contents at the same plugin version. |
| Installer regressions | `install:test`: 13 passing tests for rollback, concurrent-install locking, project skill recipes, automatic rule creation/update, existing text/BOM/CRLF preservation, read-only check mode, malformed markers and directory junctions. Two platform-specific checks are skipped on this Windows machine: file symlink creation lacks privilege and POSIX file modes do not apply. |
| Automatic project setup | Actual `install.mjs --project` registered the plugin in an isolated Codex profile and added the managed block to an existing consumer AGENTS.md. A second install reported unchanged; original rules and CRLF remained intact, with exactly one managed block. The cached server includes bootstrap_project. |
| Agent bootstrap | A new read-only planning session called bootstrap_project automatically before recommend_tools, read skill guidance and left the fixture's files unchanged. Local evidence: mtkit-agent-evaluation-Mn3zda. |
| External MCPs | `catalog:integrations`: Context7 resolves React and reads useEffect cleanup docs; shadcn reads a temporary registry and button metadata; Playwright launches, opens a local fixture, clicks and verifies the changed state. |
| Agent planning | An ephemeral Codex CLI session received a natural-language supplier CRM planning request without tool/skill names. It called `recommend_tools`, read `design-screen`, `ui-ux-pro-max`, and the workflow reference through `get_skill`, and produced a plan. Its shell inspection was denied, and it correctly marked local package details unverified. |
| Catalog installation UI | The design-screen card shows companion folders for Claude Code, Cursor and Copilot. Checked at 1440 and 390 px without horizontal overflow. |
| Private UI access | `npm view @mtkit/ui@1.1.1 version` returns 1.1.1. The UI package and its version were not changed. |

## Corrections made

- Recommendations handle ordinary creation/polish/review phrases and explicit exclusions such as “без GSAP”, “не используй shadcn” and review-only tasks. New screens receive a relevant UX helper, polish receives baseline-ui, and supplied references receive build-design, within the six-item limit.
- `get_skill` exposes first-party skill Markdown and references embedded in the executable. External Markdown is fetched only from the catalog's pinned GitHub paths with a 15-second timeout, 256 KiB limit and no arbitrary URL or filesystem access. It does not install or execute helpers.
- Project installation of design-screen includes library-docs and review-screen, preserving relative links.
- Automatic project setup uses one shared rule definition in the server and local installer. Remote bootstrap returns the native client instruction path and merge plan; local setup writes the managed block while preserving existing instructions. A client with read-only task scope applies the guidance in-session.
- Docker includes the authored Markdown at build time, and deterministic catalog tests run in both the Docker build and Azure website pipeline.

## Conditions still required

1. **Client setup and routing.** Install the plugin with `node scripts/install.mjs --project <application-path>` to create or update its project rules automatically, then start a new session. For an existing connection, `scripts/setup-project.mjs` manages those rules separately. The remote MCP now provides `bootstrap_project` and asks the client agent to apply its managed rule block during authorized onboarding. A follow-up ephemeral Codex session called bootstrap_project on its own before recommendations, used the guidance and preserved read-only scope. Clients still decide which tools to invoke and allow; see [automatic project setup](agent-project-rules.md). The earlier review session that skipped the catalog remains evidence that a bare URL cannot enforce model behavior.
2. **Tool permissions.** In the noninteractive read-only Codex review evaluation, Playwright navigation was denied with `MCP tool call requires approval, but approval policy is never`. That agent-driven browser review is not certified. The direct Playwright integration check succeeded independently. Configure tool permissions through the normal client settings; the evaluation does not bypass approvals.
3. **Helper runtimes.** On this machine `python` and `python3` are Windows Store aliases that exit 9009, and `py` is absent. UI UX Pro Max's Python search helper therefore needs a real Python 3 executable. Its instructions remain readable. Design Taste's Node helper starts successfully. All helper workflows across all 78 skills were not executed.
4. **External services.** The client needs network access for Context7, npm packages and registries. The server needs `raw.githubusercontent.com` only when reading external skill Markdown through `get_skill`; authored instructions and catalog queries work offline. Next.js DevTools and Chrome DevTools are optional and were not executed in this audit.
5. **Project prerequisites.** UI implementation needs actual installed @mtkit/ui types, compatible React, feed credentials if installation is required, and a running app for browser review. Reading guidance does not establish these conditions.
6. **Deployment.** Docker daemon was unavailable locally. An actual image build, corporate TLS/proxy/VPN path and production client permissions remain to be checked using the [deployment runbook](deploy-mcp.md). Local hosted-mode smoke is not a production deployment test.

## Repeat the checks

Run from the repository root after dependency installation:

```sh
npm run catalog:check
npm run catalog:test
npm run catalog:inventory
npm run install:test
npm run catalog:build
npm run catalog:smoke
npm run web:build
```

Explicit network checks:

```sh
npm run catalog:integrations
```

Authenticated agent planning evaluation (uses Codex quota and retains text evidence in a temporary directory):

```sh
npm run catalog:agent-eval
```

The optional `npm run catalog:agent-eval -- --with-browser` also attempts an agent-driven review. It may fail if the agent skips the catalog or client permissions reject browser tools. Those are actionable results, not successful checks. Global skills remain visible to Codex in this evaluation; user config is ignored and client settings are not changed.

The 2026-11-13 planning trace is in the local temporary folder `mtkit-agent-evaluation-cTLoX5`; the denied review trace is in `mtkit-agent-evaluation-alzZuD`. They are local evidence, not release artifacts. No production deployment or real user client reconfiguration was performed by this audit.
