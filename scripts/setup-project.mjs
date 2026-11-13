import { setupProjectRules } from "./project-rules.mjs";

const usage = "Usage: node scripts/setup-project.mjs --project <directory> [--client codex|claude-code|cursor|vscode] [--check]";

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--help") { console.log(usage); return; }
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === "--check" && options.check === undefined) options.check = true;
    else if ((flag === "--project" || flag === "--client") && options[flag.slice(2)] === undefined && args[index + 1] && !args[index + 1].startsWith("--")) options[flag.slice(2)] = args[++index];
    else throw new Error(usage);
  }
  if (!options.project) throw new Error(usage);
  const result = await setupProjectRules(options);
  console.log(JSON.stringify(result, null, 2));
  if (options.check && result.action !== "unchanged") process.exitCode = 1;
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
