import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.ts";

const base = { DATABASE_URL: "postgresql://x/y" } as NodeJS.ProcessEnv;

describe("configuration", () => {
  it("takes the hub base URL with or without a pasted /oidc suffix", () => {
    for (const url of ["https://id.wanbd.online", "https://id.wanbd.online/", "https://id.wanbd.online/oidc", "https://id.wanbd.online/oidc/"]) {
      expect(loadConfig({ ...base, WAN_HUB_URL: url }).hubUrl).toBe("https://id.wanbd.online");
    }
  });
});
