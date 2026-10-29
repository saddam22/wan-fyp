import { describe, expect, it } from "vitest";
import {
  Browser as B,
  grant as grantAs,
  signIn as signInAs,
  useHarness,
  userId as uid,
  WEB,
} from "./harness.ts";

const ctx = useHarness();
const signIn = (name?: string, next?: string) => signInAs(ctx, name, next);
class Browser extends B {
  constructor() {
    super(ctx);
  }
}

const userId = (sub: string) => uid(ctx, sub);
const grant = (sub: string, ...roles: string[]) => grantAs(ctx, sub, ...roles);

describe("WAN sign-in", () => {
  it("redirects to the hub with PKCE S256, state, nonce and the registered callback", async () => {
    const res = await new Browser().get("/auth/login?next=/student/orders");
    const u = new URL(String(res.headers.location));
    expect(u.origin + u.pathname).toBe(`${ctx.hub.issuer}/auth`);
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("redirect_uri")).toBe(`${WEB}/api/auth/callback`);
    expect(u.searchParams.get("scope")).toBe("openid profile email phone");
    const t = (
      await ctx.db.query("select next_path from auth_transactions where state = $1", [
        u.searchParams.get("state"),
      ])
    ).rows[0];
    expect(t.next_path).toBe("/student/orders");
  });

  it("drops unsafe next paths (open redirect)", async () => {
    for (const next of [
      "//evil.example",
      "https://evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
    ]) {
      const res = await new Browser().get(`/auth/login?next=${encodeURIComponent(next)}`);
      const state = new URL(String(res.headers.location)).searchParams.get("state");
      expect(
        (await ctx.db.query("select next_path from auth_transactions where state = $1", [state]))
          .rows[0].next_path,
      ).toBe("");
    }
  });

  it("first sign-in creates the person without any role and sends them to onboarding", async () => {
    const { b, cb, sub } = await signIn("Mahfuz Rahman");
    expect(cb.statusCode).toBe(302);
    expect(cb.headers.location).toBe("/onboarding");
    const setCookie = String(cb.headers["set-cookie"]);
    expect(setCookie).toMatch(/ek_sid=/);
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/SameSite=Lax/);
    const me = (await b.get("/me")).json();
    expect(me.user.name).toBe("Mahfuz Rahman");
    expect(me.roles).toEqual([]);
    expect(me.onboardingComplete).toBe(false);
    const stored = (
      await ctx.db.query("select token_hash from sessions where user_id = $1", [await userId(sub)])
    ).rows[0];
    expect(stored.token_hash).not.toBe(b.cookies.get("ek_sid"));
  });

  it("refuses a replayed or unknown state, a wrong nonce, and passes on hub refusals", async () => {
    const b = new Browser();
    const login = await b.get("/auth/login");
    const q = ctx.hub.authorize(String(login.headers.location), {
      sub: crypto.randomUUID(),
      name: "X",
    });
    expect((await b.get(`/auth/callback?${new URLSearchParams(q)}`)).headers.location).toBe(
      "/onboarding",
    );
    expect((await b.get(`/auth/callback?${new URLSearchParams(q)}`)).headers.location).toBe(
      "/login?error=expired",
    );
    expect(
      (await b.get(`/auth/callback?${new URLSearchParams({ ...q, state: "made-up" })}`)).headers
        .location,
    ).toBe("/login?error=expired");

    const b2 = new Browser();
    const login2 = await b2.get("/auth/login");
    const bad = ctx.hub.authorize(
      String(login2.headers.location),
      { sub: crypto.randomUUID(), name: "Y" },
      { nonce: "attacker" },
    );
    const res = await b2.get(`/auth/callback?${new URLSearchParams(bad)}`);
    expect(res.headers.location).toBe("/login?error=signin");
    expect(b2.cookies.has("ek_sid")).toBe(false);

    const denied = await new Browser().get("/auth/callback?error=access_denied&state=x");
    expect(denied.headers.location).toBe("/access-request?reason=denied");
  });

  it("returning users with a role go to `next` or their dashboard", async () => {
    const first = await signIn("Returning");
    await grant(first.sub, "mentor");
    const b = new Browser();
    const login = await b.get("/auth/login");
    const q = ctx.hub.authorize(String(login.headers.location), {
      sub: first.sub,
      name: "Returning",
    });
    expect((await b.get(`/auth/callback?${new URLSearchParams(q)}`)).headers.location).toBe(
      "/mentor",
    );
  });

  it("logout revokes the session", async () => {
    const { b } = await signIn();
    expect((await b.post("/auth/logout")).statusCode).toBe(200);
    expect(b.cookies.has("ek_sid")).toBe(false);
    expect((await ctx.app.inject({ url: "/me" })).statusCode).toBe(401);
  });
});

describe("onboarding gate and CSRF", () => {
  it("refuses state changes without the web origin", async () => {
    const { b } = await signIn();
    const noOrigin = await b.req("POST", "/me/onboarding", { kind: "guardian" }, { origin: "" });
    expect(noOrigin.statusCode).toBe(403);
    const evil = await b.req(
      "POST",
      "/me/onboarding",
      { kind: "guardian" },
      { origin: "https://evil.example" },
    );
    expect(evil.statusCode).toBe(403);
  });

  it("validates and grants only student or guardian", async () => {
    const { b } = await signIn();
    expect((await b.post("/me/onboarding", { kind: "student", institution: "X" })).statusCode).toBe(
      400,
    );
    expect((await b.post("/me/onboarding", { kind: "mentor" })).statusCode).toBe(400);
    expect((await b.post("/me/onboarding", { kind: "admin" })).statusCode).toBe(400);
    const ok = await b.post("/me/onboarding", {
      kind: "student",
      institution: "Notre Dame College",
      classLevel: "HSC 2nd year",
      board: "Dhaka",
      subjects: ["biology", "ict"],
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().roles).toEqual(["student"]);
    expect(ok.json().home).toBe("/student");
    expect(ok.json().studentProfile.subjects).toEqual(["biology", "ict"]);
  });

  it("unauthenticated and wrong-role requests are refused", async () => {
    expect((await new Browser().get("/admin/users")).statusCode).toBe(401);
    const { b } = await signIn();
    await b.post("/me/onboarding", { kind: "guardian" });
    expect((await b.get("/admin/users")).statusCode).toBe(403);
    expect((await b.get("/admin/audit")).statusCode).toBe(403);
  });
});

describe("roles and suspension (admin)", () => {
  it("super admin grants staff roles; admin manages only marketplace roles", async () => {
    const sup = await signIn("Super");
    await grant(sup.sub, "super_admin");
    const adm = await signIn("Admin");
    await grant(adm.sub, "admin");
    const target = await signIn("Target");
    const tid = await userId(target.sub);

    expect(
      (await adm.b.put(`/admin/users/${tid}/roles`, { roles: ["accountant"] })).statusCode,
    ).toBe(403);
    const m = await adm.b.put(`/admin/users/${tid}/roles`, { roles: ["mentor"] });
    expect(m.statusCode).toBe(200);
    expect(m.json().roles).toEqual(["mentor"]);
    const s = await sup.b.put(`/admin/users/${tid}/roles`, { roles: ["mentor", "accountant"] });
    expect(s.json().roles).toEqual(["accountant", "mentor"]);
    expect((await adm.b.put(`/admin/users/${tid}/roles`, { roles: ["mentor"] })).statusCode).toBe(
      403,
    );
    expect((await sup.b.put(`/admin/users/${tid}/roles`, { roles: ["root"] })).statusCode).toBe(
      400,
    );
    expect(
      (await sup.b.get("/admin/users?role=accountant")).json().map((u: { id: string }) => u.id),
    ).toContain(tid);

    // The target's next request sees the new role.
    expect((await target.b.get("/me")).json().roles).toEqual(["accountant", "mentor"]);
    const audit = (
      await ctx.db.query(
        "select details from audit_log where action = 'user.roles' and target = $1",
        [tid],
      )
    ).rows;
    expect(audit.length).toBe(2);
  });

  it("keeps at least one super admin and nobody demotes themselves", async () => {
    await ctx.db.query("delete from user_roles where role = 'super_admin'");
    const sup = await signIn("Only Super");
    await grant(sup.sub, "super_admin");
    const self = await userId(sup.sub);
    expect((await sup.b.put(`/admin/users/${self}/roles`, { roles: [] })).statusCode).toBe(409);
    const other = await signIn("Second Super");
    await grant(other.sub, "super_admin");
    const oid = await userId(other.sub);
    expect((await sup.b.put(`/admin/users/${oid}/roles`, { roles: [] })).statusCode).toBe(200);
  });

  it("concurrent removals can't remove the last two super admins", async () => {
    await ctx.db.query("delete from user_roles where role = 'super_admin'");
    const a = await signIn("Super A");
    const b = await signIn("Super B");
    await grant(a.sub, "super_admin");
    await grant(b.sub, "super_admin");
    const [ra, rb] = await Promise.all([
      a.b.put(`/admin/users/${await userId(b.sub)}/roles`, { roles: [] }),
      b.b.put(`/admin/users/${await userId(a.sub)}/roles`, { roles: [] }),
    ]);
    // The second request sees, under the lock, that its actor is no longer a super admin.
    expect([ra.statusCode, rb.statusCode].sort()).toEqual([200, 403]);
    expect(
      (await ctx.db.query("select count(*)::int as n from user_roles where role = 'super_admin'"))
        .rows[0].n,
    ).toBe(1);
  });

  it("suspension ends the user's sessions; admins can't suspend staff", async () => {
    const adm = await signIn("Admin 2");
    await grant(adm.sub, "admin");
    const victim = await signIn("Spammer");
    const vid = await userId(victim.sub);
    expect(
      (await adm.b.post(`/admin/users/${vid}/status`, { status: "suspended", reason: "spam" }))
        .statusCode,
    ).toBe(200);
    expect((await victim.b.get("/me")).statusCode).toBe(401);
    // Signing in again is refused while suspended.
    const b = new Browser();
    const login = await b.get("/auth/login");
    const q = ctx.hub.authorize(String(login.headers.location), {
      sub: victim.sub,
      name: "Spammer",
    });
    expect((await b.get(`/auth/callback?${new URLSearchParams(q)}`)).headers.location).toBe(
      "/access-request?reason=suspended",
    );

    const staff = await signIn("Accountant");
    await grant(staff.sub, "accountant");
    expect(
      (await adm.b.post(`/admin/users/${await userId(staff.sub)}/status`, { status: "suspended" }))
        .statusCode,
    ).toBe(403);
    expect(
      (await adm.b.post(`/admin/users/${await userId(adm.sub)}/status`, { status: "suspended" }))
        .statusCode,
    ).toBe(409);
  });
});

describe("hub entitlement", () => {
  it("a user the hub suspends for EduKhata loses the session at the next check", async () => {
    const { b, sub } = await signIn();
    expect((await b.get("/me")).statusCode).toBe(200);
    ctx.hub.entitlements.set(sub, "suspended");
    const res = await b.get("/me");
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("platform_access_denied");
    expect((await b.get("/me")).statusCode).toBe(401);
  });

  it("keeps working when the hub is unreachable", async () => {
    const { b } = await signIn();
    ctx.hub.down = true;
    expect((await b.get("/me")).statusCode).toBe(200);
  });

  it("admins list and decide hub access requests; decisions are audited", async () => {
    const adm = await signIn("Admin 3");
    await grant(adm.sub, "admin");
    ctx.hub.requests.push({
      id: "11111111-1111-4111-8111-111111111111",
      sub: crypto.randomUUID(),
      name: "Selina",
      username: "selina",
      roleId: "member",
      roleName: "Member",
      reason: "Guardian",
      status: "pending",
      createdAt: new Date().toISOString(),
      decidedAt: null,
      reviewerNote: null,
    });
    const list = (await adm.b.get("/admin/access-requests")).json();
    expect(list.map((r: { name: string }) => r.name)).toContain("Selina");
    const d = await adm.b.post(
      "/admin/access-requests/11111111-1111-4111-8111-111111111111/decision",
      { approve: true },
    );
    expect(d.statusCode).toBe(200);
    expect(
      (
        await adm.b.post("/admin/access-requests/11111111-1111-4111-8111-111111111111/decision", {
          approve: true,
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (await ctx.db.query("select 1 from audit_log where action = 'access_request.approve'"))
        .rowCount,
    ).toBe(1);
    ctx.hub.down = true;
    expect((await adm.b.get("/admin/access-requests")).statusCode).toBe(502);
  });
});

describe("sessions", () => {
  it("lists and revokes own sessions; idle sessions end", async () => {
    const { b, sub } = await signIn();
    const list = (await b.get("/me/sessions")).json();
    expect(list).toHaveLength(1);
    expect(list[0].current).toBe(true);
    await ctx.db.query(
      "update sessions set last_seen_at = now() - interval '13 hours' where user_id = $1",
      [await userId(sub)],
    );
    expect((await b.get("/me")).statusCode).toBe(401);
  });
});
