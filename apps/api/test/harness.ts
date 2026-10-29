/**
 * Shared API test setup: fresh schema in the *test* database, a stand-in WAN hub,
 * and browser-like clients that sign in through the real OIDC flow.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, expect } from "vitest";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { buildApp, type AppOptions } from "../src/app.ts";
import { loadConfig, type Config } from "../src/config.ts";
import { createDb, migrate, type Db } from "../src/db.ts";
import { createHub } from "../src/lib/hub.ts";
import { startFakeHub, type FakeHub } from "./fakeHub.ts";

export const TEST_DB =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/edukhata_test";
export const WEB = "http://localhost:3200";

export interface Ctx {
  db: Db;
  hub: FakeHub;
  config: Config;
  app: FastifyInstance;
}

/** Registers beforeAll/afterAll hooks; the returned object is filled before tests run. */
export function useHarness(extra: Partial<AppOptions> = {}): Ctx {
  const ctx = {} as Ctx;
  beforeAll(async () => {
    if (!/test/.test(new URL(TEST_DB).pathname))
      throw new Error("TEST_DATABASE_URL must point at a *test* database");
    ctx.db = createDb(TEST_DB);
    await ctx.db.query(
      "drop schema public cascade; create schema public; drop schema if exists drizzle cascade;",
    );
    await migrate(ctx.db);
    const secret = "test-secret-0123456789-0123456789-abc";
    ctx.hub = await startFakeHub("edukhata", secret);
    ctx.config = loadConfig({
      DATABASE_URL: TEST_DB,
      WEB_URL: WEB,
      WAN_HUB_URL: ctx.hub.url,
      EDK_CLIENT_SECRET: secret,
      HUB_CHECK_INTERVAL_SEC: "0",
      CHAT_UPLOAD_DIR: mkdtempSync(join(tmpdir(), "edk-chat-")),
      ORDER_FILES_DIR: mkdtempSync(join(tmpdir(), "edk-orders-")),
    } as NodeJS.ProcessEnv);
    ctx.app = await buildApp({
      db: ctx.db,
      config: ctx.config,
      hub: createHub(ctx.config),
      ...extra,
    });
    await ctx.app.ready();
  });
  afterAll(async () => {
    await ctx.app?.close();
    await ctx.hub?.close();
    await ctx.db?.end();
  });
  beforeEach(() => {
    if (ctx.hub) ctx.hub.down = false;
  });
  return ctx;
}

/** A browser talking to the API through the web origin (cookies kept, Origin sent on writes). */
let browsers = 0;
export class Browser {
  cookies = new Map<string, string>();
  /** Each browser has its own address (rate limits are per client, as in real use). */
  readonly ip: string;
  constructor(private ctx: Ctx) {
    const n = ++browsers;
    this.ip = `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`;
  }
  async req(
    method: string,
    url: string,
    body?: object,
    headers: Record<string, string> = {},
  ): Promise<LightMyRequestResponse> {
    const res = await this.ctx.app.inject({
      method: method as "GET",
      url,
      remoteAddress: this.ip,
      headers: {
        cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "),
        ...(method !== "GET" ? { origin: WEB } : {}),
        ...headers,
      },
      ...(body ? { payload: body } : {}),
    });
    for (const c of ([] as string[]).concat(res.headers["set-cookie"] ?? [])) {
      const [pair] = c.split(";");
      const [k, ...v] = pair!.split("=");
      if (v.join("=") === "" || /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c))
        this.cookies.delete(k!);
      else this.cookies.set(k!, v.join("="));
    }
    return res;
  }
  get = (u: string) => this.req("GET", u);
  post = (u: string, b?: object) => this.req("POST", u, b ?? {});
  put = (u: string, b: object) => this.req("PUT", u, b);
  del = (u: string) => this.req("DELETE", u);
}

let n = 0;
/** Full WAN sign-in through the API and the (fake) hub. */
export async function signIn(ctx: Ctx, name = `User ${++n}`, next?: string) {
  const b = new Browser(ctx);
  const sub = crypto.randomUUID();
  const login = await b.get(`/auth/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  expect(login.statusCode).toBe(302);
  const q = ctx.hub.authorize(String(login.headers.location), {
    sub,
    name,
    email: `${sub.slice(0, 8)}@example.com`,
  });
  const cb = await b.get(`/auth/callback?${new URLSearchParams(q)}`);
  return { b, sub, cb };
}

export async function userId(ctx: Ctx, sub: string) {
  return (await ctx.db.query("select id from users where wan_sub = $1", [sub])).rows[0]
    .id as string;
}

export async function grant(ctx: Ctx, sub: string, ...roles: string[]) {
  for (const r of roles)
    await ctx.db.query(
      "insert into user_roles (user_id, role) values ($1, $2) on conflict do nothing",
      [await userId(ctx, sub), r],
    );
}

/** Signs in and completes onboarding as a student (or guardian). */
export async function student(ctx: Ctx, name?: string) {
  const s = await signIn(ctx, name);
  const r = await s.b.post("/me/onboarding", {
    kind: "student",
    institution: "Notre Dame College",
    classLevel: "HSC 2nd year",
    subjects: ["biology"],
  });
  expect(r.statusCode).toBe(200);
  return { ...s, id: await userId(ctx, s.sub) };
}
export async function guardian(ctx: Ctx, name?: string) {
  const s = await signIn(ctx, name);
  expect((await s.b.post("/me/onboarding", { kind: "guardian" })).statusCode).toBe(200);
  return { ...s, id: await userId(ctx, s.sub) };
}
