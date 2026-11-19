export const catalogPort = 4387;
export const catalogPath = "/mcp";
export const catalogEndpoint = `http://127.0.0.1:${catalogPort}${catalogPath}`;

export const installClients = ["codex", "claude-code", "cursor", "vscode"] as const;
export type InstallClient = typeof installClients[number];
export type ProjectClient = Exclude<InstallClient, "codex">;

export const projectClients = ["claude-code", "cursor", "vscode"] as const satisfies readonly ProjectClient[];

export const clientLabels: Record<InstallClient, string> = {
  codex: "Codex",
  "claude-code": "Claude Code",
  cursor: "Cursor",
  vscode: "VS Code (Copilot)",
};

export const skillDirectories: Record<ProjectClient, string> = {
  "claude-code": ".claude/skills",
  cursor: ".cursor/skills",
  vscode: ".github/skills",
};

type McpConnection =
  | { type: "http"; url: string; headers?: Record<string, string> }
  | { type: "stdio"; command: string; args: readonly string[] };

export interface ProjectConfiguration {
  path: string;
  content: { mcpServers: Record<string, McpConnection & { tools?: readonly string[] }> };
}

export function projectMcpConfiguration(client: ProjectClient, name: string, connection: McpConnection): ProjectConfiguration {
  return {
    path: client === "cursor" ? ".cursor/mcp.json" : ".mcp.json",
    content: { mcpServers: { [name]: client === "vscode" ? { ...connection, tools: ["*"] } : connection } },
  };
}

export function catalogConnection(client: ProjectClient, hostedEndpoint?: string): ProjectConfiguration {
  const tokenReference = client === "cursor" ? "${env:MTKIT_MCP_TOKEN}" : "${MTKIT_MCP_TOKEN}";
  return projectMcpConfiguration(client, catalogServerName(Boolean(hostedEndpoint)), {
    type: "http",
    url: hostedEndpoint ?? catalogEndpoint,
    ...(hostedEndpoint && { headers: { Authorization: `Bearer ${tokenReference}` } }),
  });
}

/** Server name used in client configuration; prompts and tools are addressed through it. */
export function catalogServerName(hosted: boolean) {
  return hosted ? "mtkit_catalog_remote" : "mtkit_catalog";
}

/**
 * One-line Claude Code registration in the project's .mcp.json. Single quotes keep
 * ${MTKIT_MCP_TOKEN} literal in bash and PowerShell, so the file stores the reference, not the secret.
 */
export function claudeCodeCommand(hostedEndpoint?: string) {
  const name = catalogServerName(Boolean(hostedEndpoint));
  const auth = hostedEndpoint ? " --header 'Authorization: Bearer ${MTKIT_MCP_TOKEN}'" : "";
  return `claude mcp add --transport http --scope project ${name} ${hostedEndpoint ?? catalogEndpoint}${auth}`;
}

export const catalogPrompts = ["setup", "install", "update", "pick"] as const;
export type CatalogPrompt = typeof catalogPrompts[number];

/** How a user starts an MCP prompt in each client, or undefined when the client has no prompt command. */
export function promptCommand(client: InstallClient, prompt: CatalogPrompt, hosted: boolean) {
  const name = catalogServerName(hosted);
  if (client === "claude-code") return `/mcp__${name}__${prompt}`;
  if (client === "vscode") return `/mcp.${name}.${prompt}`;
  return undefined;
}

export function parseHostedEndpoint(value: string): URL {
  const message = `Expected an HTTPS URL ending in ${catalogPath}.`;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(message);
  }

  // The hostname is also used in the command copied from the website.
  const validHostname = /^[a-z0-9.-]+$/i.test(url.hostname) || url.hostname.startsWith("[");
  if (url.protocol !== "https:" || url.pathname !== catalogPath || url.href !== `${url.origin}${catalogPath}` || !validHostname) {
    throw new Error(message);
  }
  return url;
}
