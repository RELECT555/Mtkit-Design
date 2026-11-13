import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = new URL("../../", import.meta.url);
const plugin = new URL("plugins/mtkit-design/", root);
const manifest = JSON.parse(await readFile(new URL(".mcp.json", plugin), "utf8")).mcpServers;
const lock = JSON.parse(await readFile(new URL("./external-skills.json", import.meta.url), "utf8"));
const result = await build({
  entryPoints: [fileURLToPath(new URL("./index.ts", import.meta.url))],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const { catalogCounts, catalogEntries, planInstall, queryCatalog } = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}`
);

const pluginMcp = catalogEntries.filter(({ kind, availability }) => kind === "mcp" && availability === "bundled");
assert.deepEqual(pluginMcp.map(({ name }) => name).sort(), Object.keys(manifest).sort());

const lockedSkills = lock.flatMap(({ skills }) => Object.keys(skills));
const authorSkills = (await readdir(new URL("skills/", plugin), { withFileTypes: true }))
  .filter((directory) => directory.isDirectory() && !lockedSkills.includes(directory.name))
  .map((directory) => directory.name);
const skillEntries = catalogEntries.filter(({ kind }) => kind === "skill");
assert.deepEqual(skillEntries.map(({ name }) => name).sort(), [...lockedSkills, ...authorSkills].sort());
assert(skillEntries.every(({ availability }) => availability === "bundled"));

for (const entry of catalogEntries) {
  const plan = planInstall(entry.id);
  assert.equal(plan?.availability, entry.availability, entry.id);
  if (entry.sourcePath) await access(new URL(entry.sourcePath, root));
  if (entry.kind !== "mcp") continue;

  const config = manifest[entry.name];
  if (config?.url) {
    assert.deepEqual(plan.steps[0].args.slice(3), ["--url", config.url], entry.id);
  } else if (config?.command === "npx") {
    assert.deepEqual(plan.steps[0].args.slice(3), ["--", config.command, ...config.args], entry.id);
    assert(entry.revision && config.args.some((arg) => arg.endsWith(`@${entry.revision}`)), entry.id);
  } else if (!config) {
    assert.equal(entry.availability, "optional", entry.id);
    assert.equal(plan.bundledSteps, undefined, entry.id);
    assert(plan.steps[0].args.some((arg) => arg.endsWith(`@${entry.revision}`)), entry.id);
  }
}

assert.equal(new Set(catalogEntries.map(({ id }) => id)).size, catalogCounts.total);
assert.equal(catalogCounts.bundledMcp, Object.keys(manifest).length);
assert.equal(queryCatalog({ availability: "optional" }).total, catalogCounts.optional);
console.log(`Catalog inventory matches the plugin: ${catalogCounts.bundled} bundled, ${catalogCounts.optional} optional.`);
