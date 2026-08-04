import { defineConfig, devices } from "@playwright/test";

// Smoke-tests the *built* game (ARCHITECTURE.md CI/CD: "launch built game"),
// not the dev server — `pnpm build` must run first. `pnpm preview` serves
// apps/game/dist as-is, base="/", same as CI's own build step.
export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm preview",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
