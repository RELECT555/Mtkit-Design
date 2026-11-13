export const catalogPort = 4387;
export const catalogPath = "/mcp";
export const catalogEndpoint = `http://127.0.0.1:${catalogPort}${catalogPath}`;

export const installClients = ["codex", "claude-code", "cursor", "vscode"] as const;
export type InstallClient = typeof installClients[number];
export type ProjectClient = Exclude<InstallClient, "codex">;

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
  return projectMcpConfiguration(client, hostedEndpoint ? "mtkit_catalog_remote" : "mtkit_catalog", {
    type: "http",
    url: hostedEndpoint ?? catalogEndpoint,
    ...(hostedEndpoint && { headers: { Authorization: `Bearer ${tokenReference}` } }),
  });
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
