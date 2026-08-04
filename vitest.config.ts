import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // .test.ts = Vitest (packages/sim); .spec.ts is reserved for Playwright
    // (apps/game/tests/) so the two runners never pick up each other's files.
    include: ["**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
