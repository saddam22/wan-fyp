#!/usr/bin/env node
/**
 * Checks EduKhata's environment before a build or deploy.
 *   node scripts/check-env.mjs web-build            (inside the image build: process env)
 *   node scripts/check-env.mjs staging .env.staging (a compose env file)
 * Exits 1 with every problem listed. Never prints secret values.
 */
import { readFileSync } from "node:fs";

const [mode = "staging", file] = process.argv.slice(2);
const env = { ...process.env };
if (file)
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }

const problems = [];
const need = (k, test = (v) => !!v, why = "is required") => {
  if (!test(env[k] ?? "")) problems.push(`${k} ${why}`);
};
const https = (v) => /^https:\/\/[^/]+$/.test(v.replace(/\/+$/, ""));
const secret = (v) => v.length >= 32 && !v.startsWith("dev-only") && !/change-me/i.test(v);

if (mode === "web-build") {
  need("NEXT_PUBLIC_SITE_URL", (v) => /^https?:\/\//.test(v), "must be the public web URL");
  need(
    "NEXT_PUBLIC_WAN_HUB_URL",
    (v) => /^https?:\/\//.test(v),
    "must be the WAN Identity Hub URL",
  );
  need("API_INTERNAL_URL", (v) => /^http:\/\//.test(v), "must be the API's internal URL");
} else {
  // API
  need("DATABASE_URL", (v) => /^postgres(ql)?:\/\//.test(v), "must be a postgres:// URL");
  need("WEB_URL", https, "must be the https origin of the web app");
  need("WAN_HUB_URL", https, "must be the https origin of the WAN Identity Hub");
  need("EDK_CLIENT_SECRET", secret, "must be a 32+ character random secret (same as the hub's)");
  need("CHAT_SECRET", secret, "must be a 32+ character random secret");
  if (env.CHAT_SECRET && env.CHAT_SECRET === env.EDK_CLIENT_SECRET)
    problems.push("CHAT_SECRET must differ from EDK_CLIENT_SECRET");
  need("TRUST_PROXY", (v) => !!v, "must list the reverse proxy / web container addresses");
  need("POSTGRES_PASSWORD", (v) => v.length >= 16, "must be 16+ characters");
  // Web
  need("NEXT_PUBLIC_SITE_URL", https, "must be the https origin of the web app");
  if (env.NEXT_PUBLIC_SITE_URL && env.WEB_URL && env.NEXT_PUBLIC_SITE_URL !== env.WEB_URL)
    problems.push("NEXT_PUBLIC_SITE_URL must equal WEB_URL");
  need("NEXT_PUBLIC_WAN_HUB_URL", https, "must be the https origin of the hub");
  if (mode === "production") {
    need("NEXT_PUBLIC_DEMO_MODE", (v) => v === "false", "must be false in production");
    if (!env.CALL_TURN_URLS)
      problems.push("CALL_TURN_URLS is not set: calls on mobile networks will fail");
  }
}

if (problems.length) {
  console.error(`Environment check (${mode}) failed:\n - ${problems.join("\n - ")}`);
  process.exit(1);
}
console.log(`Environment check (${mode}) passed.`);
