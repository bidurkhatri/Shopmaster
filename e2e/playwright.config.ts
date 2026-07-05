import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

// Use the sandbox's pre-installed Chromium when present; otherwise fall back to Playwright's own
// bundled browser (e.g. in CI, where `playwright install chromium` provides it).
const CHROME = process.env.CHROME_BIN ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const useSystemChrome = existsSync(CHROME);

export default defineConfig({
  testDir: "./tests",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.WEB_URL ?? "http://localhost:3000",
    headless: true,
    viewport: { width: 1280, height: 900 },
    launchOptions: {
      ...(useSystemChrome ? { executablePath: CHROME } : {}),
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    },
  },
});
