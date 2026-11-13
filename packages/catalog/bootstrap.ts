import type { InstallClient } from "./connection.js";
import rules from "./project-rules.json";

/** A client-side setup plan. Contains no filesystem access or project data. */
export function planBootstrap(client: InstallClient) {
  return {
    client,
    instructionFile: rules.instructionFiles[client],
    markerStart: rules.markerStart,
    markerEnd: rules.markerEnd,
    content: `${rules.markerStart}\n${rules.content.trimEnd()}\n${rules.markerEnd}\n`,
    mergePolicy: "append-or-replace-managed-block",
    instructions: [
      "Resolve the open application's project root from the client workspace. Do not guess it from the MCP server's working directory. Read existing project instructions before editing.",
      "When configuring MTKit for this project and workspace writes are permitted, create the instruction file or append this block. If exactly one matching marker pair exists, replace only that managed block. Preserve all content outside it and the existing newline style. Do not duplicate the block. If it already matches, leave the file unchanged.",
      "If markers are malformed or duplicated, the target is a symlink, or project rules conflict, stop the automatic file edit and report the specific conflict. Do not overwrite unrelated instructions or follow links outside the project.",
      "For a review-only task, a read-only workspace, or a client with no file tools, follow these rules in the current session and state that project setup was not persisted. Do not bypass approvals. Do not re-run setup after it has already been checked in this project during the session.",
      "After a write, reread the file to verify one complete managed block and preserved existing instructions. Report the actual file changed. Returning this plan alone does not mean setup was applied.",
    ],
    checks: [
      "Confirm MTKit Catalog is available by calling list_categories. Then recommend_tools selects guidance for the user's actual task.",
      "Read selected skill instructions through get_skill or the local installed skill. Discover the recommended MCP's tools in this client before using them.",
      "For UI implementation, inspect the installed @mtkit/ui types and locked version. Check feed access only when package installation is needed. Do not change UI package versions as part of setup.",
      "Check helper runtimes only for the chosen skills (for example Python 3 for UI UX Pro Max) and a running app/browser for rendered checks. Use plan_install for necessary missing tools within authorized scope.",
    ],
  } as const;
}
