import { describe, expect, it } from "vitest";
import { guardian, student, useHarness } from "./harness.ts";
import { MAX_CHILDREN, MAX_FAILURES_PER_HOUR } from "../src/routes/guardians.ts";

const ctx = useHarness();
const emailOf = (sub: string) => `${sub.slice(0, 8)}@example.com`;
type S = Awaited<ReturnType<typeof student>>;

async function codeFor(s: S): Promise<string> {
  const r = await s.b.post("/me/guardian-code");
  expect(r.statusCode).toBe(200);
  return r.json().code as string;
}

describe("guardian linking (ICTSpark rules, hardened)", () => {
  it("links with the student's email + one-time code; both are notified; the code is used up", async () => {
    const st = await student(ctx, "Linked Student");
    const g = await guardian(ctx, "Linking Guardian");
    expect((await st.b.get("/me/guardian-code")).json().active).toBe(false);
    const code = await codeFor(st);
    expect(code).toMatch(/^[2-9A-HJKMNP-Z]{8}$/);
    expect((await st.b.get("/me/guardian-code")).json().active).toBe(true);

    // Codes are case- and space-insensitive; only the hash is stored.
    const typed = `${code.slice(0, 4).toLowerCase()} ${code.slice(4)}`;
    const r = await g.b.post("/guardian/children", {
      contact: emailOf(st.sub).toUpperCase(),
      code: typed,
    });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json()).toMatchObject({
      studentId: st.id,
      name: "Linked Student",
      institution: "Notre Dame College",
      classLevel: "HSC 2nd year",
      permissions: { viewOrders: true, viewPayments: true, payOnBehalf: false },
    });
    const stored = (await ctx.db.query("select code_hash from guardian_link_codes")).rows;
    expect(JSON.stringify(stored)).not.toContain(code);

    // One-time: the code is gone after use.
    expect((await st.b.get("/me/guardian-code")).json().active).toBe(false);
    const g2 = await guardian(ctx, "Second Guardian");
    expect(
      (await g2.b.post("/guardian/children", { contact: emailOf(st.sub), code })).statusCode,
    ).toBe(404);

    const types = async (b: S["b"]) =>
      (await b.get("/me/notifications"))
        .json()
        .items.map((n: { type: string; link: string }) => `${n.type} ${n.link}`);
    expect(await types(st.b)).toContain("guardian.linked /student/profile");
    expect(await types(g.b)).toContain("guardian.linked /guardian/children");
    expect((await g.b.get("/guardian/children")).json()).toHaveLength(1);
    expect((await st.b.get("/me/guardians")).json()[0]).toMatchObject({
      guardianId: g.id,
      name: "Linking Guardian",
    });
  });

  it("wrong email, wrong code and expired code give the same answer; regenerating revokes the old code", async () => {
    const st = await student(ctx, "Probe Student");
    const g = await guardian(ctx, "Probe Guardian");
    const old = await codeFor(st);
    const fresh = await codeFor(st);
    const answers = await Promise.all([
      g.b.post("/guardian/children", { contact: "nobody@example.com", code: fresh }),
      g.b.post("/guardian/children", { contact: emailOf(st.sub), code: "ZZZZ2222" }),
      g.b.post("/guardian/children", { contact: emailOf(st.sub), code: old }),
    ]);
    for (const a of answers) {
      expect(a.statusCode).toBe(404);
      expect(a.json().error.message).toBe("Email/phone or link code is not correct");
    }
    await ctx.db.query("update guardian_link_codes set expires_at = now() - interval '1 second'");
    const expired = await g.b.post("/guardian/children", { contact: emailOf(st.sub), code: fresh });
    expect(expired.statusCode).toBe(404);
    expect(expired.json().error.message).toBe(answers[0]!.json().error.message);
  });

  it("limits wrong guesses per guardian", async () => {
    const st = await student(ctx, "Guess Student");
    const g = await guardian(ctx, "Guessing Guardian");
    const code = await codeFor(st);
    for (let i = 0; i < MAX_FAILURES_PER_HOUR; i++)
      expect(
        (await g.b.post("/guardian/children", { contact: emailOf(st.sub), code: `WRONG${i}A2` }))
          .statusCode,
      ).toBe(404);
    // Even the right code is refused now.
    expect(
      (await g.b.post("/guardian/children", { contact: emailOf(st.sub), code })).statusCode,
    ).toBe(429);
    // ...and the student's code was not used up by the refusals.
    expect((await st.b.get("/me/guardian-code")).json().active).toBe(true);
  });

  it(`at most ${MAX_CHILDREN} children, no duplicates, even when linking concurrently`, async () => {
    const g = await guardian(ctx, "Busy Guardian");
    const kids = await Promise.all(
      Array.from({ length: MAX_CHILDREN + 2 }, (_, i) => student(ctx, `Kid ${i}`)),
    );
    const codes = await Promise.all(kids.map(codeFor));
    const results = await Promise.all(
      kids.map((k, i) =>
        g.b.post("/guardian/children", { contact: emailOf(k.sub), code: codes[i] }),
      ),
    );
    expect(results.filter((r) => r.statusCode === 201)).toHaveLength(MAX_CHILDREN);
    expect(results.filter((r) => r.statusCode === 400)).toHaveLength(2);
    expect((await g.b.get("/guardian/children")).json()).toHaveLength(MAX_CHILDREN);

    // Already linked → 409, and the new code survives (refusal rolled back).
    const again = await codeFor(kids[0]!);
    expect(
      (await g.b.post("/guardian/children", { contact: emailOf(kids[0]!.sub), code: again }))
        .statusCode,
    ).toBe(409);
    expect((await kids[0]!.b.get("/me/guardian-code")).json().active).toBe(true);
  });

  it("the student controls permissions and either side can unlink; roles are enforced", async () => {
    const st = await student(ctx, "Private Student");
    const g = await guardian(ctx, "Watched Guardian");
    await g.b.post("/guardian/children", { contact: emailOf(st.sub), code: await codeFor(st) });

    // Guardians can't change permissions or use student endpoints; students can't use guardian ones.
    expect(
      (
        await g.b.put(`/me/guardians/${g.id}`, {
          viewOrders: true,
          viewPayments: true,
          payOnBehalf: true,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (await st.b.post("/guardian/children", { contact: "x@example.com", code: "AAAA2222" }))
        .statusCode,
    ).toBe(403);
    expect((await g.b.post("/me/guardian-code")).statusCode).toBe(403);

    const put = await st.b.put(`/me/guardians/${g.id}`, {
      viewOrders: true,
      viewPayments: false,
      payOnBehalf: true,
    });
    expect(put.statusCode).toBe(200);
    expect((await g.b.get("/guardian/children")).json()[0].permissions).toEqual({
      viewOrders: true,
      viewPayments: false,
      payOnBehalf: true,
    });
    expect((await st.b.put(`/me/guardians/${g.id}`, { viewOrders: "yes" })).statusCode).toBe(400);
    expect(
      (
        await st.b.put("/me/guardians/not-a-uuid", {
          viewOrders: true,
          viewPayments: true,
          payOnBehalf: true,
        })
      ).statusCode,
    ).toBe(404);

    // Student unlinks → access gone immediately; the guardian is told.
    expect((await st.b.del(`/me/guardians/${g.id}`)).statusCode).toBe(200);
    expect((await g.b.get("/guardian/children")).json()).toHaveLength(0);
    const gTypes = (await g.b.get("/me/notifications"))
      .json()
      .items.map((n: { type: string }) => n.type);
    expect(gTypes).toContain("guardian.unlinked");
    expect((await st.b.del(`/me/guardians/${g.id}`)).statusCode).toBe(404);

    // Relink, then the guardian unlinks.
    await g.b.post("/guardian/children", { contact: emailOf(st.sub), code: await codeFor(st) });
    expect((await g.b.del(`/guardian/children/${st.id}`)).statusCode).toBe(200);
    expect((await st.b.get("/me/guardians")).json()).toHaveLength(0);
    const audit = (
      await ctx.db.query(
        "select action from audit_log where action like 'guardian.%' and actor_id = any($1) order by at",
        [[st.id, g.id]],
      )
    ).rows.map((r) => r.action);
    expect(audit).toEqual([
      "guardian.linked",
      "guardian.permissions",
      "guardian.unlinked",
      "guardian.linked",
      "guardian.unlinked",
    ]);
  });

  it("links by Bangladesh mobile number in any common format", async () => {
    const st = await student(ctx, "Phone Student");
    await ctx.db.query("update users set phone = '+8801712345678', email = null where id = $1", [
      st.id,
    ]);
    const g = await guardian(ctx, "Phone Guardian");
    const r = await g.b.post("/guardian/children", {
      contact: "০১৭১২-৩৪৫৬৭৮",
      code: await codeFor(st),
    });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json().contact).toBe("+8801712345678");
  });
});
