import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { serveSharedData } from "../../tools/viteSharedData.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

export default defineConfig({
  // GitHub Pages serves the game at /cryptgrid/ (see docs/ARCHITECTURE.md CI/CD)
  base: process.env.CRYPTGRID_BASE ?? "/",
  server: { port: 5173 },
  plugins: [serveSharedData(REPO_ROOT)],
});
