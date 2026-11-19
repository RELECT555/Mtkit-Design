import { createHash, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { pipeline } from "node:stream";
import { hostHeaderValidation, localhostHostValidation, localhostOriginValidation, toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler, type McpServerFactory } from "@modelcontextprotocol/server";
import { catalogPath, getEntry, parseHostedEndpoint } from "@mtkit-design/catalog";
import { archivePathPattern, createSkillArchive, hasSkillFolder, type ExtraFile } from "./archive.js";
import { redistributionLicense } from "./licenses.js";
import { logEvent } from "./log.js";

interface HostedConfig {
  publicUrl: URL;
  tokenDigests: readonly Buffer[];
  /** Requests per minute for each token; 0 disables the limit. */
  rateLimit: number;
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
  const rateLimit = env.MTKIT_RATE_LIMIT === undefined || env.MTKIT_RATE_LIMIT === "" ? 600 : Number(env.MTKIT_RATE_LIMIT);
  if (!Number.isInteger(rateLimit) || rateLimit < 0 || rateLimit > 1_000_000) {
    throw new Error("MTKIT_RATE_LIMIT must be the number of requests per minute for each token (0 disables the limit).");
  }
  return { publicUrl, tokenDigests: tokens.map(token => createHash("sha256").update(token).digest()), rateLimit };
}

/** Index of the matching configured token, or -1. Logs carry the index, never the token. */
function bearerTokenIndex(authorization: string | undefined, expectedDigests: readonly Buffer[]) {
  const token = /^Bearer ([a-zA-Z0-9._~-]{32,256})$/i.exec(authorization ?? "")?.[1];
  if (token === undefined) return -1;
  const digest = createHash("sha256").update(token).digest();
  // Compare against every configured token so timing does not reveal which one matched.
  return expectedDigests.reduce((matched, expected, index) => (timingSafeEqual(digest, expected) ? index : matched), -1);
}

export interface HttpOptions {
  /** Folder with one subfolder per skill. Enables GET /skills/<id>.tar.gz when set. */
  skillsDirectory?: string;
  /** Generated files added to a skill archive, such as the install manifest. */
  archiveExtras?: (id: string) => readonly ExtraFile[];
  /** Reported by /healthz so operators can see which build is running. */
  health?: Record<string, unknown>;
  /** Called once the listening address is known, with the origin clients can reach. */
  onListening?: (origin: string) => void;
}

const maxConcurrentArchives = 4;
// An archive costs as much of the rate limit as this many MCP requests.
const archiveCost = 10;

/** Fixed one-minute windows per token. Small and in memory: one container, few tokens. */
function createRateLimiter(limit: number) {
  const windows = new Map<number, { start: number; used: number }>();
  return (key: number, cost: number) => {
    if (limit === 0) return 0;
    const now = Date.now();
    const current = windows.get(key);
    const window = current && now - current.start < 60_000 ? current : { start: now, used: 0 };
    windows.set(key, window);
    if (window.used + cost > limit) return Math.ceil((window.start + 60_000 - now) / 1000);
    window.used += cost;
    return 0;
  };
}

export function serveHttp(factory: McpServerFactory, port: number, hosted?: HostedConfig, options: HttpOptions = {}) {
  const host = hosted ? "0.0.0.0" : "127.0.0.1";
  const handler = createMcpHandler(factory);
  const handleRequest = toNodeHandler(handler, { maxRequestBodySize: 64 * 1024 });
  const validateHost = hosted ? hostHeaderValidation([hosted.publicUrl.hostname]) : localhostHostValidation();
  const validateLocalOrigin = localhostOriginValidation();
  const limited = createRateLimiter(hosted?.rateLimit ?? 0);
  const health = JSON.stringify({ status: "ok", ...options.health });

  let activeArchives = 0;

  const http = createServer({ headersTimeout: 10_000, requestTimeout: 20_000 }, (request, response) => {
    const started = performance.now();
    const path = request.url?.split("?", 1)[0];
    if (path === "/healthz" && (request.method === "GET" || request.method === "HEAD")) {
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(`${health}\n`);
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
    const isArchive = archiveId !== undefined && options.skillsDirectory !== undefined && (request.method === "GET" || request.method === "HEAD");
    if (!isArchive && path !== catalogPath) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
      return;
    }

    const token = hosted ? bearerTokenIndex(request.headers.authorization, hosted.tokenDigests) : 0;
    if (token < 0) {
      logEvent({ event: "unauthorized", path: isArchive ? "/skills" : catalogPath });
      response.writeHead(401, { "WWW-Authenticate": 'Bearer realm="MTKit Catalog"', "Cache-Control": "no-store" }).end();
      return;
    }
    const retryAfter = limited(token, isArchive ? archiveCost : 1);
    if (retryAfter > 0) {
      logEvent({ event: "rate_limited", token, path: isArchive ? "/skills" : catalogPath });
      response.writeHead(429, { "Retry-After": String(retryAfter), "Cache-Control": "no-store" }).end();
      return;
    }

    if (isArchive && archiveId !== undefined && options.skillsDirectory !== undefined) {
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
      const archive = createSkillArchive(options.skillsDirectory, archiveId, undefined, options.archiveExtras?.(archiveId) ?? []);
      let bytes = 0;
      archive.on("data", (chunk: Buffer) => { bytes += chunk.length; });
      pipeline(archive, response, (error) => {
        activeArchives--;
        logEvent({ event: "archive", skill: archiveId, token, bytes, ms: Math.round(performance.now() - started), ok: !error });
      });
      return;
    }

    if (hosted) response.setHeader("Cache-Control", "no-store");
    response.once("finish", () => {
      logEvent({ event: "request", token, method: request.method, status: response.statusCode, ms: Math.round(performance.now() - started) });
    });
    void handleRequest(request, response).catch((error: unknown) => {
      logEvent({ event: "request_failed", token, error: error instanceof Error ? error.name : "unknown" });
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
