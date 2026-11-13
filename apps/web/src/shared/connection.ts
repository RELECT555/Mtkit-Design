import { catalogEndpoint } from "@mtkit-design/catalog";

export const hostedEndpoint: string | undefined = import.meta.env.VITE_MTKIT_MCP_URL || undefined;

export function codexCommand(mode: "local" | "hosted") {
  const endpoint = mode === "hosted" ? hostedEndpoint : catalogEndpoint;
  if (!endpoint) throw new Error("Hosted endpoint is missing.");
  const auth = mode === "hosted" ? " --bearer-token-env-var MTKIT_MCP_TOKEN" : "";
  const name = mode === "hosted" ? "mtkit_catalog_remote" : "mtkit_catalog";
  const url = mode === "hosted" ? `"${endpoint}"` : endpoint;
  return `codex mcp add ${name} --url ${url}${auth}`;
}
