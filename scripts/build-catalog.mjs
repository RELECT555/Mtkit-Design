import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { writeSkillPack } from "./skill-pack.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

// Everything in plugins/mtkit-design/skills becomes installable through the MCP server.
const pack = await writeSkillPack(
  fileURLToPath(new URL("../plugins/mtkit-design/skills", import.meta.url)),
  fileURLToPath(new URL("../packages/mcp/skill-pack.gz", import.meta.url)),
);
console.log(`Skill pack: ${pack.skills} skills, ${pack.files} text files.`);

await build({
  absWorkingDir: root,
  entryPoints: ["packages/mcp/server.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  loader: { ".md": "text", ".gz": "binary" },
  outfile: "plugins/mtkit-design/dist/catalog.cjs",
  legalComments: "linked",
});
