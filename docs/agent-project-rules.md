# Automatic project setup

MTKit creates a small managed instruction block during project setup. Users can then describe frontend tasks normally; the agent is instructed to ask the catalog for relevant skills, read the selected guidance and verify the tools it uses.

## Install the Codex plugin and configure an application

From the MTKit Design checkout, pass the application root explicitly:

```sh
npm ci
node scripts/install.mjs --project "C:/work/my-app"
```

The installer registers the plugin and sets up the application's `AGENTS.md`. Use the path to the application being developed. The installer does not infer the application from the MTKit checkout. Without `--project`, it installs the plugin only. `--prepare-only` prepares downloaded skills and cannot be combined with project setup.

## Configure a project with an existing MCP connection

Run from the MTKit Design checkout:

```sh
node scripts/setup-project.mjs --project "C:/work/my-app" --client codex
```

Choose the client used in that application:

| Client | Instruction file relative to the application root |
| --- | --- |
| `codex` | `AGENTS.md` |
| `claude-code` | `CLAUDE.md` |
| `cursor` | `AGENTS.md` |
| `vscode` | `.github/copilot-instructions.md` |

The command creates the instruction file if needed or updates the managed block in an existing file. It preserves content outside `<!-- mtkit-design:start -->` and `<!-- mtkit-design:end -->`. Repeating setup does not create duplicate blocks. Ambiguous or damaged markers must be resolved before updating. Rules inside the managed block come from MTKit and are refreshed by setup; keep project-specific additions outside it.

To inspect whether the rules are current without writing:

```sh
node scripts/setup-project.mjs --project "C:/work/my-app" --client codex --check
```

Check mode exits with code `0` when the block is current and `1` when it is absent or outdated. It leaves project files unchanged.

This setup command manages project instructions. MCP registration, tokens, permissions and package installation keep their existing client workflows. It does not change `@mtkit/ui` or install every optional catalog entry. Start a new agent session when the client requires it to reload instructions.

## Setup through a remote MCP

The server's initialization guidance asks the agent to call `bootstrap_project` for its client during onboarding. The tool returns the appropriate instruction-file path, managed content and merge guidance. The agent checks the active project and existing instructions, then applies the block through its own workspace tools when writing is allowed. If the file is already current, no update is needed.

The HTTP server cannot directly modify the employee's local files. A client also decides whether to follow initialization guidance, so a bare MCP URL cannot guarantee an automatic write for every agent. The local setup command above provides the predictable setup path if the client skips onboarding.

For review-only or read-only sessions, the agent follows the returned guidance in the current session and reports that persistent setup was not applied. It must preserve the user's task scope and client approval policy. Successful bootstrap-tool output confirms receipt of instructions; successful file inspection confirms persistent setup.

The shared definition lives in [project-rules.json](../packages/catalog/project-rules.json). It covers catalog selection, reading skills, checking actual tool availability, using the installed MTKit components and distinguishing verified results from blocked checks.
