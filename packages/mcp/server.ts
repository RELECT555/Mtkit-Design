import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { catalogPort } from "@mtkit-design/catalog";
import { hasSkillFolder } from "./archive.js";
import { redistributionLicense } from "./licenses.js";
import { readHostedConfig, serveHttp } from "./http.js";
import { createCatalogServer, type CatalogOptions } from "./tools.js";

const args = process.argv.slice(2);
const validPort = (value: string) => /^\d{1,5}$/.test(value) && Number(value) <= 65535;

/** Skill folders next to the bundle (container) or in the plugin layout (dist/ beside skills/). */
function findSkillsDirectory(env: NodeJS.ProcessEnv) {
  const candidates = [env.MTKIT_SKILLS_DIR, join(__dirname, "skills"), join(__dirname, "..", "skills")];
  return candidates.find((path): path is string => Boolean(path) && existsSync(path as string) && statSync(path as string).isDirectory());
}

/** Starts an HTTP transport that also serves skill archives when the skill folders are present. */
function start(port: number, hosted?: ReturnType<typeof readHostedConfig>) {
  const skillsDirectory = findSkillsDirectory(process.env);
  const options: CatalogOptions = {};
  const enable = (origin: string) => {
    if (skillsDirectory) options.archive = { origin, bearer: hosted !== undefined, has: id => redistributionLicense(id).allowed && hasSkillFolder(skillsDirectory, id) };
  };
  if (hosted) enable(hosted.publicUrl.origin);
  serveHttp(() => createCatalogServer(options), port, hosted, {
    ...(skillsDirectory && { skillsDirectory }),
    onListening: origin => { if (!hosted) enable(origin); },
  });
}

if (args.length === 0) {
  serveStdio(() => createCatalogServer());
} else if (args.length === 1 && args[0] === "--http") {
  start(catalogPort);
} else if (args.length === 3 && args[0] === "--http" && args[1] === "--port" && validPort(args[2])) {
  start(Number(args[2]));
} else if (args.length === 1 && args[0] === "--hosted") {
  try {
    const port = process.env.PORT ?? "8080";
    if (!validPort(port)) throw new Error("PORT must be an integer from 0 to 65535.");
    start(Number(port), readHostedConfig(process.env));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Invalid hosted configuration.");
    process.exitCode = 1;
  }
} else {
  console.error("Usage: node catalog.cjs [--http [--port <0-65535>] | --hosted]");
  process.exitCode = 1;
}
