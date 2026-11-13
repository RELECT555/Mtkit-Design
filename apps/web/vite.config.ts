import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
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
      name: "render-blocking-page-entry",
      apply: "build",
      transformIndexHtml: {
        order: "post",
        // Vite replaces the source entry tag, dropping the attribute used for page snapshots.
        handler(html) {
          return html.replace('<script type="module" crossorigin src=', '<script type="module" crossorigin blocking="render" src=');
        },
      },
    }],
    build: {
      rolldownOptions: {
        input: {
          home: fileURLToPath(new URL("./index.html", import.meta.url)),
          catalog: fileURLToPath(new URL("./catalog/index.html", import.meta.url)),
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
