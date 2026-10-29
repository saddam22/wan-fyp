import { defineConfig } from "vitest/config";

export default defineConfig({
  cacheDir: "node_modules/.vite",
  // One shared test database: run files one after another.
  test: { environment: "node", fileParallelism: false, testTimeout: 20_000 },
});
