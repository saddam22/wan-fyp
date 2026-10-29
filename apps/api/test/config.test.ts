import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.ts";

const prod = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://edk:pw@db:5432/edukhata",
  WEB_URL: "https://edukhata.example",
  WAN_HUB_URL: "https://id.example",
  EDK_CLIENT_SECRET: "a".repeat(40),
  CHAT_SECRET: "b".repeat(40),
};

describe("configuration", () => {
  it("development works with defaults; production needs real values", () => {
    expect(loadConfig({ DATABASE_URL: "postgres://localhost/x" }).production).toBe(false);
    expect(loadConfig(prod)).toMatchObject({ production: true, cookieSecure: true, port: 4200 });
  });

  it("refuses unsafe production settings", () => {
    const bad = (patch: Record<string, string | undefined>) => () =>
      loadConfig({ ...prod, ...patch });
    expect(bad({ EDK_CLIENT_SECRET: undefined })).toThrow(/EDK_CLIENT_SECRET/);
    expect(bad({ CHAT_SECRET: "" })).toThrow(/CHAT_SECRET/);
    expect(bad({ CHAT_SECRET: "a".repeat(40) })).toThrow(/different/);
    expect(bad({ EDK_CLIENT_SECRET: "dev-only-edukhata-secret-change-me-0123" })).toThrow(
      /Development secrets/,
    );
    expect(bad({ WEB_URL: "http://edukhata.example" })).toThrow(/https/);
    expect(bad({ DATABASE_URL: "mysql://x" })).toThrow(/postgres/);
    expect(bad({ PORT: "99999" })).toThrow(/PORT/);
    expect(bad({ DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
  });
});
