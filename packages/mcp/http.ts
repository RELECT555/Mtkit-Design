import { createHash, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { pipeline } from "node:stream";
import { hostHeaderValidation, localhostHostValidation, localhostOriginValidation, toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler, type McpServerFactory } from "@modelcontextprotocol/server";
import { catalogPath, getEntry, parseHostedEndpoint } from "@mtkit-design/catalog";
import { archivePathPattern, createSkillArchive, hasSkillFolder } from "./archive.js";
import { redistributionLicense } from "./licenses.js";

interface HostedConfig {
  publicUrl: URL;
  tokenDigests: readonly Buffer[];
}

export function readHostedConfig(env: NodeJS.ProcessEnv): HostedConfig {
  let publicUrl: URL;
  try {
    publicUrl = parseHostedEndpoint(env.MTKIT_PUBLIC_URL ?? "");
  } catch {
    throw new Error(`MTKIT_PUBLIC_URL must be the HTTPS URL of this server's ${catalogPath} endpoint.`);
  }

  // Several comma-separated tokens let operators rotate the secret without downtime: add the new
  // token, move clients over, then remove the old one.
  const tokens = (env.MTKIT_MCP_TOKEN ?? "").split(",").map(token => token.trim());
  if (tokens.length > 8 || !tokens.every(token => /^[a-zA-Z0-9._~-]{32,256}$/.test(token))) {
    throw new Error("MTKIT_MCP_TOKEN must be one to eight comma-separated 32–256 character bearer secrets using letters, numbers, dots, underscores, tildes or hyphens.");
  }
  return { publicUrl, tokenDigests: tokens.map(token => createHash("sha256").update(token).digest()) };
}

function hasBearerToken(authorization: string | undefined, expectedDigests: readonly Buffer[]) {
  const token = /^Bearer ([a-zA-Z0-9._~-]{32,256})$/i.exec(authorization ?? "")?.[1];
  if (token === undefined) return false;
  const digest = createHash("sha256").update(token).digest();
  // Compare against every configured token so timing does not reveal which one matched.
  return expectedDigests.reduce((matched, expected) => timingSafeEqual(digest, expected) || matched, false);
}

export interface HttpOptions {
  /** Folder with one subfolder per skill. Enables GET /skills/<id>.tar.gz when set. */
  skillsDirectory?: string;
  /** Called once the listening address is known, with the origin clients can reach. */
  onListening?: (origin: string) => void;
}

const maxConcurrentArchives = 4;

export function serveHttp(factory: McpServerFactory, port: number, hosted?: HostedConfig, options: HttpOptions = {}) {
  const host = hosted ? "0.0.0.0" : "127.0.0.1";
  const handler = createMcpHandler(factory);
  const handleRequest = toNodeHandler(handler, { maxRequestBodySize: 64 * 1024 });
  const validateHost = hosted ? hostHeaderValidation([hosted.publicUrl.hostname]) : localhostHostValidation();
  const validateLocalOrigin = localhostOriginValidation();

  let activeArchives = 0;

  const http = createServer({ headersTimeout: 10_000, requestTimeout: 20_000 }, (request, response) => {
    const path = request.url?.split("?", 1)[0];
    if (path === "/healthz" && (request.method === "GET" || request.method === "HEAD")) {
      response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }).end("ok\n");
      return;
    }
    if (!validateHost(request, response)) return;
    if (hosted) {
      const origin = request.headers.origin;
      if (origin !== undefined && origin !== hosted.publicUrl.origin) {
        response.writeHead(403).end();
        return;
      }
    } else if (!validateLocalOrigin(request, response)) return;

    const archiveId = path === undefined ? undefined : archivePathPattern.exec(path)?.[1];
    if (archiveId !== undefined && options.skillsDirectory !== undefined && (request.method === "GET" || request.method === "HEAD")) {
      if (hosted && !hasBearerToken(request.headers.authorization, hosted.tokenDigests)) {
        response.writeHead(401, { "WWW-Authenticate": 'Bearer realm="MTKit Catalog"', "Cache-Control": "no-store" }).end();
        return;
      }
      if (getEntry(archiveId)?.kind !== "skill" || !redistributionLicense(archiveId).allowed || !hasSkillFolder(options.skillsDirectory, archiveId)) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
        return;
      }
      if (activeArchives >= maxConcurrentArchives) {
        response.writeHead(503, { "Retry-After": "5", "Cache-Control": "no-store" }).end();
        return;
      }
      response.writeHead(200, {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="${archiveId}.tar.gz"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      if (request.method === "HEAD") {
        response.end();
        return;
      }
      activeArchives++;
      pipeline(createSkillArchive(options.skillsDirectory, archiveId), response, (error) => {
        activeArchives--;
        if (error) console.error("MTKit Catalog could not finish a skill archive.", error.name);
      });
      return;
    }

    if (path !== catalogPath) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
      return;
    }
    if (hosted && !hasBearerToken(request.headers.authorization, hosted.tokenDigests)) {
      response.writeHead(401, { "WWW-Authenticate": 'Bearer realm="MTKit Catalog"', "Cache-Control": "no-store" }).end();
      return;
    }
    if (hosted) response.setHeader("Cache-Control", "no-store");
    void handleRequest(request, response).catch((error: unknown) => {
      console.error("MTKit Catalog could not handle the request.", error instanceof Error ? error.name : "");
      if (response.headersSent) response.destroy();
      else response.writeHead(500).end();
    });
  });

  http.on("error", (error) => {
    console.error(`MTKit Catalog could not start at http://${host}:${port}${catalogPath}: ${error.message}`);
    process.exitCode = 1;
    void handler.close();
  });
  http.listen(port, host, () => {
    const address = http.address();
    if (address && typeof address === "object") {
      console.error(`MTKit Catalog is listening at http://${host}:${address.port}${catalogPath}`);
      options.onListening?.(`http://127.0.0.1:${address.port}`);
    }
  });

  function stop() {
    http.close();
    void handler.close();
    setTimeout(() => http.closeAllConnections(), 5_000).unref();
  }
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
