import { cpSync, existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const MIME = { ".json": "application/json", ".png": "image/png" };

/**
 * levels/ and assets/ live at the repo root as the shared contract between
 * game, editor, and (later) server (docs/ARCHITECTURE.md "Level pipeline").
 * Serves them at /levels/* and /assets/* in both dev (middleware) and the
 * production build (copied into dist/) for whichever app's vite.config.ts
 * uses it — shared so apps/game and apps/editor don't duplicate this.
 */
export function serveSharedData(repoRoot) {
  const roots = {
    "/levels/": path.join(repoRoot, "levels"),
    "/assets/": path.join(repoRoot, "assets"),
  };

  return {
    name: "cryptgrid-serve-shared-data",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        for (const [prefix, root] of Object.entries(roots)) {
          if (!url.startsWith(prefix)) continue;
          const rel = decodeURIComponent(url.slice(prefix.length).split("?")[0] ?? "");
          const filePath = path.join(root, rel);
          if (!filePath.startsWith(root)) break; // path traversal guard
          if (existsSync(filePath) && statSync(filePath).isFile()) {
            const ext = path.extname(filePath);
            res.setHeader("Content-Type", MIME[ext] ?? "application/octet-stream");
            res.end(readFileSync(filePath));
            return;
          }
        }
        next();
      });
    },
    writeBundle(options) {
      const outDir = options.dir ?? "dist";
      cpSync(path.join(repoRoot, "levels"), path.join(outDir, "levels"), { recursive: true });
      cpSync(path.join(repoRoot, "assets"), path.join(outDir, "assets"), {
        recursive: true,
        // _preview/ is a QA artifact (tiling check), not something players need to download.
        filter: (src) => !src.split(path.sep).includes("_preview"),
      });
    },
  };
}
