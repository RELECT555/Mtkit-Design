import { fileURLToPath } from "node:url";
import { build } from "esbuild";

await build({
  absWorkingDir: fileURLToPath(new URL("../", import.meta.url)),
  entryPoints: ["packages/mcp/server.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  loader: { ".md": "text" },
  outfile: "plugins/mtkit-design/dist/catalog.cjs",
  legalComments: "linked",
});
