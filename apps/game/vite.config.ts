import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages serves the game at /cryptgrid/ (see docs/ARCHITECTURE.md CI/CD)
  base: process.env.CRYPTGRID_BASE ?? "/",
  server: { port: 5173 },
});
