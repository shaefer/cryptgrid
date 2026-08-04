import { expect, test } from "@playwright/test";

test("vault01 loads and renders with no console errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await page.goto("/");

  // main.ts sets this once the first frame has rendered — the render loop's
  // own signal that there's something on screen, not just that the page loaded.
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true", { timeout: 15_000 });

  // HUD text confirms the level actually parsed/validated and the party spawned
  // at the authored start tile, not just that the canvas exists.
  await expect(page.locator("#hud")).toContainText("The Outer Vault", { timeout: 5_000 });
  await expect(page.locator("#hud")).toContainText("(2,2)");

  await page.screenshot({ path: "test-results/vault01-smoke.png" });

  expect(consoleErrors, `console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
});
