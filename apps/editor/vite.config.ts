import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { serveSharedData } from "../../tools/viteSharedData.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

export default defineConfig({
  // GitHub Pages serves the editor at /cryptgrid/editor/ (see docs/ARCHITECTURE.md CI/CD)
  base: process.env.CRYPTGRID_BASE ?? "/",
  plugins: [react(), serveSharedData(REPO_ROOT)],
  server: { port: 5174 },
});
