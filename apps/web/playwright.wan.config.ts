import { defineConfig, devices } from "@playwright/test";

/**
 * Real WAN sign-in end to end: WAN Identity Hub (sibling checkout, see HUB_DIR) +
 * EduKhata API + this web app in AUTH_MODE=wan. Needs PostgreSQL with the databases
 * wan_identity_e2e and edukhata_e2e, and a production build of the web app (`pnpm build`).
 *   pnpm --filter @edukhata/web e2e:wan
 */
const HUB_DIR = process.env.HUB_DIR ?? "../../../wan-identity-hub/server";
const PG = process.env.E2E_PG ?? "postgresql://postgres:postgres@localhost:5432";

export default defineConfig({
  testDir: "e2e-wan",
  timeout: 120_000,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3200",
    ...devices["Desktop Chrome"],
    viewport: { width: 1366, height: 900 },
    // Calls: Chromium's fake camera/microphone, no permission prompts.
    permissions: ["camera", "microphone"],
    launchOptions: {
      args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
      ...(process.env.CHROMIUM_PATH && { executablePath: process.env.CHROMIUM_PATH }),
    },
  },
  webServer: [
    {
      command: `cd ${HUB_DIR} && DATABASE_URL=${PG}/wan_identity_e2e npm run migrate && DATABASE_URL=${PG}/wan_identity_e2e PORT=4100 npm start`,
      url: "http://localhost:4100/health",
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `cd ../api && DATABASE_URL=${PG}/edukhata_e2e PORT=4200 HUB_CHECK_INTERVAL_SEC=0 pnpm start`,
      url: "http://127.0.0.1:4200/health",
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "AUTH_MODE=wan pnpm start",
      url: "http://localhost:3200/",
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
