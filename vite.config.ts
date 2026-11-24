import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { wgslVitePlugin } from "@vgpu/wgsl/loader-vite";

const page = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  base: "./",
  plugins: [wgslVitePlugin()],
  build: {
    outDir: "dist",
    target: "es2022",
    rolldownOptions: {
      input: {
        index: page("./index.html"), // variant index (links to /v1/, /v2/, /v3/)
        v1: page("./v1/index.html"), // V1 — EVENT HORIZON
        v2: page("./v2/index.html"), // V2 — ARDENT
        v3: page("./v3/index.html"), // V3 — DOCK
      },
    },
  },
});
