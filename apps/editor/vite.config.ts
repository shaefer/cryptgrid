import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages serves the editor at /cryptgrid/editor/ (see docs/ARCHITECTURE.md CI/CD)
  base: process.env.CRYPTGRID_BASE ?? "/",
  plugins: [react()],
  server: { port: 5174 },
});
