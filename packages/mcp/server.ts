import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { catalogPort } from "@mtkit-design/catalog";
import { readHostedConfig, serveHttp } from "./http.js";
import { createCatalogServer } from "./tools.js";

const args = process.argv.slice(2);
const validPort = (value: string) => /^\d{1,5}$/.test(value) && Number(value) <= 65535;
if (args.length === 0) {
  serveStdio(createCatalogServer);
} else if (args.length === 1 && args[0] === "--http") {
  serveHttp(createCatalogServer, catalogPort);
} else if (args.length === 3 && args[0] === "--http" && args[1] === "--port" && validPort(args[2])) {
  serveHttp(createCatalogServer, Number(args[2]));
} else if (args.length === 1 && args[0] === "--hosted") {
  try {
    const port = process.env.PORT ?? "8080";
    if (!validPort(port)) throw new Error("PORT must be an integer from 0 to 65535.");
    serveHttp(createCatalogServer, Number(port), readHostedConfig(process.env));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Invalid hosted configuration.");
    process.exitCode = 1;
  }
} else {
  console.error("Usage: node catalog.cjs [--http [--port <0-65535>] | --hosted]");
  process.exitCode = 1;
}
