import { test } from "@playwright/test";
import { expect } from "playwright-visual-cloud";

test("homepage looks right", async ({ page }) => {
  await page.goto("https://example.com");
  // Name defaults to the test title path if omitted.
  await expect(page).toMatchVisualSnapshot("homepage", { fullPage: true });
});

test("header component", async ({ page }) => {
  await page.goto("https://example.com");
  await expect(page.locator("h1")).toMatchVisualSnapshot("header", {
    // Same tolerance knobs as Playwright's toHaveScreenshot:
    maxDiffPixelRatio: 0.001,
    threshold: 0.2,
  });
});

test("dashboard with dynamic bits masked", async ({ page }) => {
  await page.goto("https://example.com");
  await expect(page).toMatchVisualSnapshot("dashboard", {
    mask: [page.locator(".timestamp"), page.locator(".avatar")],
  });
});
