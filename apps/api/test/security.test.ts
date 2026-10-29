import { describe, expect, it } from "vitest";
import { grant, signIn, student, useHarness, WEB, type Browser } from "./harness.ts";
import { accountant, mentor } from "./market.ts";

const ctx = useHarness();

/** Routes anyone may call without signing in (signed upload URLs carry their own signature). */
const PUBLIC = new Set([
  "GET /health",
  "GET /auth/login",
  "GET /auth/callback",
  "POST /auth/logout",
  "GET /push/config",
  "GET /referrals/resolve/:code",
  "GET /chat/config",
  "GET /catalog",
  "GET /mentors",
  "GET /mentors/featured",
  "GET /mentors/:id/reviews",
  "GET /mentors/:id/badges",
  "POST /orders/quote",
  "GET /content/posts",
  "GET /content/:kind/:slug",
  "GET /content/banners",
  "GET /leaderboard",
  "GET /home",
  "POST /contact",
  // Jobs board (marketplace-jobs module): published jobs and employers are public.
  "GET /local/config",
  "GET /local/jobs",
  "GET /local/jobs/:id",
  "GET /local/jobs/employers/:id",
  "GET /local/storage/files/*",
]);
const SIGNED = new Set([
  "PUT /chat-files/*",
  "PUT /order-files/*",
  "PUT /payment-files/*",
  "PUT /verification-files/*",
  "PUT /local/storage/upload",
  "PUT /local/storage/private/upload",
]);
/** The module's other features are turned off; their catch-all stubs answer FEATURE_DISABLED. */
const DISABLED = /^\/local\/(admin\/)?(services|map|events|emergency|marketplace)(\/|$)/;

const ID = "00000000-0000-4000-8000-000000000000";
const fill = (url: string) =>
  url
    .replace(/:kind/, "posts")
    .replace(/:emoji/, "%F0%9F%91%8D")
    .replace(/:[A-Za-z]+/g, ID)
    .replace(/\*$/, `x/${ID}`);

const routes = () => [
  ...new Map(
    ctx.app.edkRoutes
      .filter((r) => r.method !== "HEAD" && !DISABLED.test(r.url))
      .map((r) => [`${r.method} ${r.url}`, r]),
  ).values(),
];

async function call(
  b: Browser | null,
  method: string,
  url: string,
  headers: Record<string, string> = {},
) {
  if (b)
    return b.req(
      method,
      fill(url),
      method === "GET" || method === "DELETE" ? undefined : {},
      headers,
    );
  return ctx.app.inject({
    method: method as "GET",
    url: fill(url),
    remoteAddress: `10.250.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
    headers: { ...(method !== "GET" ? { origin: WEB } : {}), ...headers },
    ...(method !== "GET" && method !== "DELETE" ? { payload: {} } : {}),
  });
}

describe("access sweep over every API route", () => {
  it("the route inventory is complete", () => {
    expect(routes().length).toBeGreaterThan(150);
  });

  it("without a session every non-public route refuses (401/403), never answers or crashes", async () => {
    const bad: string[] = [];
    for (const r of routes()) {
      const key = `${r.method} ${r.url}`;
      if (PUBLIC.has(key)) continue;
      const res = await call(null, r.method, r.url);
      // Signed uploads: refused without a valid signature (or, before that, the body type).
      const ok = SIGNED.has(key)
        ? [403, 415].includes(res.statusCode)
        : [401, 403].includes(res.statusCode);
      if (!ok) bad.push(`${key} → ${res.statusCode}`);
    }
    expect(bad).toEqual([]);
  });

  it("a student gets nothing from staff and mentor routes", async () => {
    const s = await student(ctx, "Sweep Student");
    const bad: string[] = [];
    for (const r of routes()) {
      if (!/^\/(local\/)?(admin|accountant|mentor)\//.test(r.url)) continue;
      const res = await call(s.b, r.method, r.url);
      if (![403, 404].includes(res.statusCode))
        bad.push(`${r.method} ${r.url} → ${res.statusCode}`);
    }
    expect(bad).toEqual([]);
  });

  it("a mentor gets nothing from admin and accountant routes; an accountant nothing from admin routes", async () => {
    const m = await mentor(ctx, "Sweep Mentor");
    const acc = await accountant(ctx, "Sweep Accountant");
    const bad: string[] = [];
    for (const r of routes()) {
      if (/^\/(local\/)?(admin|accountant)\//.test(r.url)) {
        const res = await call(m.b, r.method, r.url);
        if (![403, 404].includes(res.statusCode))
          bad.push(`mentor ${r.method} ${r.url} → ${res.statusCode}`);
      }
      if (/^\/(local\/)?admin\//.test(r.url)) {
        const res = await call(acc.b, r.method, r.url);
        if (![403, 404].includes(res.statusCode))
          bad.push(`accountant ${r.method} ${r.url} → ${res.statusCode}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("an admin can't use super-admin settings or money routes", async () => {
    const a = await signIn(ctx, "Sweep Admin");
    await grant(ctx, a.sub, "admin");
    expect((await a.b.put("/admin/settings", { commission_rate: 0.5 })).statusCode).toBe(403);
    for (const r of routes().filter((x) => x.url.startsWith("/accountant/"))) {
      const res = await call(a.b, r.method, r.url);
      expect([403, 404], `${r.method} ${r.url}`).toContain(res.statusCode);
    }
  });

  it("every write refuses another origin, even with a valid session", async () => {
    const su = await signIn(ctx, "Sweep Super");
    await grant(ctx, su.sub, "super_admin");
    const bad: string[] = [];
    for (const r of routes()) {
      if (r.method === "GET") continue;
      const res = await call(su.b, r.method, r.url, { origin: "https://evil.example" });
      if (res.statusCode !== 403) bad.push(`${r.method} ${r.url} → ${res.statusCode}`);
    }
    expect(bad).toEqual([]);
  });

  it("unknown ids and empty bodies never cause a server error, even for a super admin", async () => {
    const su = await signIn(ctx, "Sweep Super 2");
    await grant(ctx, su.sub, "super_admin", "accountant", "mentor");
    const bad: string[] = [];
    for (const r of routes()) {
      if (r.url === "/auth/logout") continue;
      const res = await call(su.b, r.method, r.url);
      if (res.statusCode >= 500)
        bad.push(`${r.method} ${r.url} → ${res.statusCode} ${res.body.slice(0, 120)}`);
    }
    expect(bad).toEqual([]);
  });
});

describe("rate limits", () => {
  it("payment submissions are limited per session", async () => {
    const s = await student(ctx, "Rapid Submitter");
    const codes: number[] = [];
    for (let i = 0; i < 25; i++)
      codes.push((await s.b.post(`/payments/${ID}/submit`, {})).statusCode);
    expect(codes).toContain(429);
  });

  it("sign-in is limited per address", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 40; i++)
      codes.push(
        (await ctx.app.inject({ method: "GET", url: "/auth/login", remoteAddress: "10.251.0.1" }))
          .statusCode,
      );
    expect(codes).toContain(429);
  });
});
