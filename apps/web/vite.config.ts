import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { defineConfig, loadEnv } from "vite";
import { installLoadingStatus, loadingShell } from "./build/loading-shell.ts";
import { pageForPath, pageTitle } from "./src/app/navigation.ts";
import { catalogPath, parseHostedEndpoint } from "../../packages/catalog/connection.ts";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL(".", import.meta.url)), "VITE_");
  let hostedEndpoint = "";
  if (env.VITE_MTKIT_MCP_URL) {
    try {
      hostedEndpoint = parseHostedEndpoint(env.VITE_MTKIT_MCP_URL).href;
    } catch {
      throw new Error(`VITE_MTKIT_MCP_URL must be an HTTPS URL ending in ${catalogPath}.`);
    }
  }

  return {
    define: {
      "import.meta.env.VITE_MTKIT_MCP_URL": JSON.stringify(hostedEndpoint),
    },
    plugins: [{
      name: "static-loading-shell",
      transformIndexHtml: {
        order: "pre",
        handler(html, context) {
          const page = pageForPath(context.path) ?? "home";
          const css = readFileSync(new URL("./src/app/loading-shell.css", import.meta.url), "utf8");
          return html.replace("</head>", () => `<title>${pageTitle(page)}</title><link rel="stylesheet" href="/src/styles.css"><link rel="stylesheet" href="/src/app/site-navigation.css"><style>${css}</style></head>`)
            .replace('<div id="root"></div>', () => `<div id="root">${loadingShell(page, Boolean(hostedEndpoint))}</div><script>(${installLoadingStatus.toString()})();</script>`);
        },
      },
      generateBundle: { order: "post", handler(_, bundle) {
        // The HTML asset pass rewrites image sources but leaves download links alone.
        const assets = Object.values(bundle).filter((file) => file.type === "asset");
        for (const file of assets) {
          if (!file.fileName.endsWith(".html") || typeof file.source !== "string") continue;
          file.source = file.source.replace(/href="\/src\/([^\"]+)" data-preview-asset/g, (_, source: string) => {
            const asset = assets.find((item) => item.originalFileNames.includes(`src/${source}`));
            if (!asset) throw new Error(`Missing preview asset: ${source}`);
            return `href="/${asset.fileName}"`;
          });
        }
      } },
    }],
    build: {
      rolldownOptions: {
        input: {
          home: fileURLToPath(new URL("./index.html", import.meta.url)),
          catalog: fileURLToPath(new URL("./catalog/index.html", import.meta.url)),
          guide: fileURLToPath(new URL("./guide/index.html", import.meta.url)),
          shaders: fileURLToPath(new URL("./shaders/index.html", import.meta.url)),
          components: fileURLToPath(new URL("./shaders/components/index.html", import.meta.url)),
          logo: fileURLToPath(new URL("./logo/index.html", import.meta.url)),
        },
      },
    },
    server: {
      fs: {
        allow: [".", "../../packages/catalog"]
          .map((path) => fileURLToPath(new URL(path, import.meta.url))),
      },
    },
  };
});
