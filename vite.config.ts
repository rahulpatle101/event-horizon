import { fileURLToPath } from "node:url";
import { defineConfig, type Connect, type Plugin } from "vite";
import { wgslVitePlugin } from "@vgpu/wgsl/loader-vite";

const page = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/**
 * URL layout (mirrors vercel.json so dev, preview and production agree):
 *   /            → V1 (served from v1/index.html)
 *   /v1/         → redirects to /
 *   /v2/, /v3/   → the other variants
 *   /variants/   → index of all three
 */
const v1AtRoot = (): Plugin => {
  const route: Connect.NextHandleFunction = (req, res, next) => {
    const [path, query = ""] = (req.url ?? "/").split("?");
    if (path === "/" || path === "/index.html") {
      req.url = `/v1/index.html${query ? `?${query}` : ""}`;
    } else if (path === "/v1" || path === "/v1/" || path === "/v1/index.html") {
      res.statusCode = 307;
      res.setHeader("Location", `/${query ? `?${query}` : ""}`);
      res.end();
      return;
    }
    next();
  };
  return {
    name: "v1-at-root",
    configureServer: (server) => void server.middlewares.use(route),
    configurePreviewServer: (server) => void server.middlewares.use(route),
  };
};

export default defineConfig({
  base: "./",
  plugins: [wgslVitePlugin(), v1AtRoot()],
  build: {
    outDir: "dist",
    target: "es2022",
    rolldownOptions: {
      input: {
        v1: page("./v1/index.html"), // V1 — EVENT HORIZON, served at /
        v2: page("./v2/index.html"), // V2 — ARDENT, /v2/
        v3: page("./v3/index.html"), // V3 — DOCK, /v3/
        variants: page("./variants/index.html"), // index of all three, /variants/
      },
    },
  },
});
