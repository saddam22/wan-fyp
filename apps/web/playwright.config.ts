import { defineConfig, devices } from "@playwright/test";

/**
 * Runs against a production build: `pnpm build && pnpm e2e` (starts `next start` on 3200).
 * Uses the preinstalled Chromium when CHROMIUM_PATH is set.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  workers: 2,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3200",
    ...(process.env.CHROMIUM_PATH && {
      launchOptions: { executablePath: process.env.CHROMIUM_PATH },
    }),
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm start",
        url: "http://localhost:3200",
        reuseExistingServer: true,
        timeout: 60_000,
      },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    // Small phones: only the layout check runs here.
    {
      name: "small",
      use: { ...devices["Pixel 7"], viewport: { width: 360, height: 740 } },
      testMatch: /pages\.spec\.ts/,
    },
  ],
});
