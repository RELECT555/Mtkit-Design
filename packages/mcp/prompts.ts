import { completable, type McpServer } from "@modelcontextprotocol/server";
import { catalogEntries, getEntry, installClients, skillCompanions } from "@mtkit-design/catalog";
import * as z from "zod/v4";

// Prompts are explicit user-started workflows (slash commands in Claude Code), so setup does not
// depend on the model deciding to call the tools on its own. Prompt arguments are strings.
const client = z.enum(installClients).optional().describe("Agent client: claude-code (default), cursor, vscode or codex.");

function message(text: string) {
  return { messages: [{ role: "user" as const, content: { type: "text" as const, text } }] };
}

const installSteps = (target: string) => [
  `For every skill to install, call install_skills with client "${target}". If the result has an archive and you can run shell commands, run the command for this shell from the project root; otherwise write the returned files and repeat with nextOffset until it is null. Install companionSkills the same way.`,
  "Ask before replacing an existing skill folder or file with different content.",
  `For every MCP server, call plan_install with client "${target}" and merge its configuration into the named file without removing other servers. Do not put secrets into the file; keep the environment variable references.`,
  "Do not run scripts from installed skills without the user's approval.",
].join("\n");

export function registerPrompts(server: McpServer) {
  server.registerPrompt("setup", {
    title: "Set up MTKit in this project",
    description: "Add MTKit project rules, pick skills and MCP servers for a task, and install them after confirmation.",
    argsSchema: z.object({
      client,
      task: z.string().max(2_000).optional().describe("What the team builds in this project, for example 'CRM screens on React with @mtkit/ui'."),
    }),
  }, ({ client: chosen, task }) => {
    const target = chosen ?? "claude-code";
    return message([
      `Set up MTKit Design in the current project for ${target}.`,
      `1. Call bootstrap_project with client "${target}". Apply its managed block to the instruction file it names, preserving existing content, and verify with its checks.`,
      task
        ? `2. Call recommend_tools with this task: ${JSON.stringify(task)}.`
        : "2. Ask me in one question what this project is for, then call recommend_tools with my answer.",
      "3. Show the recommendations as a short list (name, skill or MCP, reason) and ask which ones to install. Install nothing before I answer.",
      `4. Install what I choose:\n${installSteps(target)}`,
      "5. Report what was added and where, what was skipped or omitted and why, and tell me to start a new session so the client loads the new skills and servers.",
    ].join("\n"));
  });

  server.registerPrompt("install", {
    title: "Install an MTKit skill or MCP server",
    description: "Install one catalog entry, with its companion skills, into the current project.",
    argsSchema: z.object({
      // Clients that support completion suggest catalog IDs while the user types.
      id: completable(z.string().trim().min(1).max(100).describe("Catalog entry ID, for example design-screen or playwright."), value => {
        const query = value.trim().toLowerCase();
        return catalogEntries
          .filter(({ id, name, title }) => !query || id.includes(query) || name.toLowerCase().includes(query) || title.toLowerCase().includes(query))
          .sort((a, b) => Number(!a.id.startsWith(query)) - Number(!b.id.startsWith(query)) || a.id.localeCompare(b.id))
          .slice(0, 100)
          .map(({ id }) => id);
      }),
      client,
    }),
  }, ({ id, client: chosen }) => {
    const target = chosen ?? "claude-code";
    const entry = getEntry(id);
    if (!entry) return message(`The catalog has no entry ${JSON.stringify(id)}. Call search_entries with this text, show me the closest matches and ask which one to install.`);
    const companions = skillCompanions[entry.id] ?? [];
    return message([
      `Install ${entry.kind === "skill" ? "the skill" : "the MCP server"} ${entry.id} (${entry.title}) into the current project for ${target}.`,
      `Call get_entry for ${entry.id} first and tell me its prerequisites and access requirements.`,
      companions.length ? `It needs the companion skills ${companions.join(", ")}; install them too.` : "",
      installSteps(target),
      "Then verify the installation as the tool result describes and report what changed.",
    ].filter(Boolean).join("\n"));
  });

  server.registerPrompt("update", {
    title: "Update installed MTKit skills",
    description: "Find MTKit skills installed in this project, check them against the server and update outdated ones after confirmation.",
    argsSchema: z.object({ client }),
  }, ({ client: chosen }) => {
    const target = chosen && chosen !== "codex" ? chosen : "claude-code";
    return message([
      `Check the MTKit skills installed in the current project for ${target}.`,
      "1. Find every .mtkit-skill.json inside the client's skill folder and read id and version from each.",
      `2. Call check_skills with these entries and client "${target}". Skill folders without a manifest were not installed by MTKit; list them separately and leave them alone.`,
      "3. Show which skills are current, outdated or no longer offered, and ask which outdated ones to update. Warn that local edits inside an updated skill folder are overwritten.",
      `4. Update the chosen skills with install_skills, as its result describes, including the new manifest.
${installSteps(target)}`,
      "5. Report what was updated and tell me to start a new session.",
    ].join("\n"));
  });

  server.registerPrompt("pick", {
    title: "Pick MTKit tools for a task",
    description: "Recommend skills and MCP servers for a task without installing anything.",
    argsSchema: z.object({ task: z.string().trim().min(1).max(2_000).describe("The task in Russian or English.") }),
  }, ({ task }) => message([
    `Call recommend_tools with this task: ${JSON.stringify(task)}.`,
    "For each recommendation, say in one line why it fits and whether it is already available in this session (check the client's skills and MCP tools; do not assume).",
    "If nothing fits, use search_entries before concluding. Do not install anything; offer the install prompt for the ones I may want.",
  ].join("\n")));
}
