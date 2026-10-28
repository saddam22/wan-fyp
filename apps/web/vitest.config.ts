import { defineConfig } from "vitest/config";

export default defineConfig({
  cacheDir: "node_modules/.vite",
  // e2e/ is Playwright, run with `pnpm e2e`.
  test: {
    environment: "node",
    exclude: ["e2e/**", "e2e-wan/**", "node_modules/**"],
    passWithNoTests: true,
  },
});
