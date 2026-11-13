import { createHash, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { hostHeaderValidation, localhostHostValidation, localhostOriginValidation, toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler, type McpServerFactory } from "@modelcontextprotocol/server";
import { catalogPath, parseHostedEndpoint } from "@mtkit-design/catalog";

interface HostedConfig {
  publicUrl: URL;
  tokenDigest: Buffer;
}

export function readHostedConfig(env: NodeJS.ProcessEnv): HostedConfig {
  let publicUrl: URL;
  try {
    publicUrl = parseHostedEndpoint(env.MTKIT_PUBLIC_URL ?? "");
  } catch {
    throw new Error(`MTKIT_PUBLIC_URL must be the HTTPS URL of this server's ${catalogPath} endpoint.`);
  }

  const token = env.MTKIT_MCP_TOKEN ?? "";
  if (!/^[a-zA-Z0-9._~-]{32,256}$/.test(token)) {
    throw new Error("MTKIT_MCP_TOKEN must be a 32–256 character bearer secret using letters, numbers, dots, underscores, tildes or hyphens.");
  }
  return { publicUrl, tokenDigest: createHash("sha256").update(token).digest() };
}

function hasBearerToken(authorization: string | undefined, expectedDigest: Buffer) {
  const token = /^Bearer ([a-zA-Z0-9._~-]{32,256})$/i.exec(authorization ?? "")?.[1];
  return token !== undefined && timingSafeEqual(createHash("sha256").update(token).digest(), expectedDigest);
}

export function serveHttp(factory: McpServerFactory, port: number, hosted?: HostedConfig) {
  const host = hosted ? "0.0.0.0" : "127.0.0.1";
  const handler = createMcpHandler(factory);
  const handleRequest = toNodeHandler(handler, { maxRequestBodySize: 64 * 1024 });
  const validateHost = hosted ? hostHeaderValidation([hosted.publicUrl.hostname]) : localhostHostValidation();
  const validateLocalOrigin = localhostOriginValidation();

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

    if (path !== catalogPath) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
      return;
    }
    if (hosted && !hasBearerToken(request.headers.authorization, hosted.tokenDigest)) {
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
