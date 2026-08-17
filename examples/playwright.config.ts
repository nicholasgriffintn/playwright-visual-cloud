import { defineConfig, devices } from "@playwright/test";
// Optional: configure in code instead of env vars.
// import { configureVisualCloud } from 'playwright-visual-cloud';
// configureVisualCloud({ failOnDiff: true });

export default defineConfig({
  testDir: "./tests",
  reporter: [
    ["list"],
    ["playwright-visual-cloud/reporter"], // prints summary + review URL, finalizes the build
  ],
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 14"] } },
  ],
});
