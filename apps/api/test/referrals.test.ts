import { describe, expect, it } from "vitest";
import { grant, guardian, signIn, student, useHarness, userId } from "./harness.ts";

const ctx = useHarness();
const onboardStudent = (b: Awaited<ReturnType<typeof signIn>>["b"], extra: object = {}) =>
  b.post("/me/onboarding", {
    kind: "student",
    institution: "Rajuk College",
    classLevel: "HSC 1st year",
    subjects: ["math"],
    ...extra,
  });

describe("referrals (ICTSpark rules)", () => {
  it("a student gets a stable code and link; the public lookup shows only a first name", async () => {
    const a = await student(ctx, "Arif Hossain Chowdhury");
    const r1 = (await a.b.get("/me/referral")).json();
    expect(r1.code).toMatch(/^EDK-ARIF-[2-9A-HJKMNP-Z]{4}$/);
    expect(r1.link).toBe(`http://localhost:3200/?ref=${r1.code}`);
    expect(r1).toMatchObject({
      invited: 0,
      converted: 0,
      earnedMinor: 0,
      pendingMinor: 0,
      history: [],
    });
    expect((await a.b.get("/me/referral")).json().code).toBe(r1.code);

    const anon = await signIn(ctx, "Anon Visitor");
    expect((await anon.b.get(`/referrals/resolve/${r1.code.toLowerCase()}`)).json()).toEqual({
      valid: true,
      code: r1.code,
      name: "Arif",
    });
    expect((await anon.b.get("/referrals/resolve/EDK-NOPE-2222")).json()).toEqual({ valid: false });
  });

  it("a ?ref link (cookie) attributes a new student once; the referrer is notified", async () => {
    const a = await student(ctx, "Referrer Rina");
    const { code } = (await a.b.get("/me/referral")).json();
    const friend = await signIn(ctx, "Friend Farhan Ahmed");
    friend.b.cookies.set("ek_ref", code);
    expect((await onboardStudent(friend.b)).statusCode).toBe(200);

    const r = (await a.b.get("/me/referral")).json();
    expect(r.invited).toBe(1);
    expect(r.history).toEqual([
      expect.objectContaining({ name: "Friend", status: "joined", rewardMinor: 0 }),
    ]);
    const n = (await a.b.get("/me/notifications"))
      .json()
      .items.find((x: { type: string }) => x.type === "referral.joined");
    expect(n).toMatchObject({ link: "/student/referrals", data: { friend: "Friend" } });

    // Onboarding again (or later with another code) never changes the referrer.
    const b = await student(ctx, "Other Referrer");
    const other = (await b.b.get("/me/referral")).json().code;
    expect((await onboardStudent(friend.b, { referralCode: other })).statusCode).toBe(200);
    expect((await b.b.get("/me/referral")).json().invited).toBe(0);
    const row = (
      await ctx.db.query(
        "select source from referrals r join users u on u.id = r.referred_id where u.name = 'Friend Farhan Ahmed'",
      )
    ).rows;
    expect(row).toEqual([{ source: "link" }]);
  });

  it("a typed code beats an older link; no self-referral; unknown codes are ignored", async () => {
    const linkOwner = await student(ctx, "Link Owner");
    const typedOwner = await guardian(ctx, "Typed Owner");
    const linkCode = (await linkOwner.b.get("/me/referral")).json().code;
    const typedCode = (await typedOwner.b.get("/me/referral")).json().code;
    const f = await signIn(ctx, "Chooser");
    f.b.cookies.set("ek_ref", linkCode);
    expect(
      (await f.b.post("/me/onboarding", { kind: "guardian", referralCode: typedCode })).statusCode,
    ).toBe(200);
    expect((await typedOwner.b.get("/me/referral")).json().invited).toBe(1);
    expect((await linkOwner.b.get("/me/referral")).json().invited).toBe(0);
    // Guardians' notifications point to their own referral page.
    const n = (await typedOwner.b.get("/me/notifications"))
      .json()
      .items.find((x: { type: string }) => x.type === "referral.joined");
    expect(n.link).toBe("/guardian/referrals");

    const unknown = await signIn(ctx, "Unknown Code");
    expect((await onboardStudent(unknown.b, { referralCode: "EDK-NOBODY-9999" })).statusCode).toBe(
      200,
    );
    expect(
      (
        await ctx.db.query("select count(*) from referrals where referred_id = $1", [
          await userId(ctx, unknown.sub),
        ])
      ).rows[0].count,
    ).toBe("0");

    // Self-referral is impossible: a code exists only after onboarding, and attribution only
    // happens at the first onboarding — and the database refuses it anyway.
    await expect(
      ctx.db.query(
        "insert into referrals (referred_id, referrer_id, code, source) values ($1, $1, 'X', 'code')",
        [typedOwner.id],
      ),
    ).rejects.toThrow(/check/);
  });

  it("staff can't refer, and codes of suspended or staff users stop working", async () => {
    const staff = await student(ctx, "Staff Sumon");
    const code = (await staff.b.get("/me/referral")).json().code;
    await grant(ctx, staff.sub, "supporter");
    expect((await staff.b.get("/me/referral")).statusCode).toBe(403);
    const f1 = await signIn(ctx, "Staff Friend");
    f1.b.cookies.set("ek_ref", code);
    await onboardStudent(f1.b);
    expect(
      (await ctx.db.query("select count(*) from referrals where code = $1", [code])).rows[0].count,
    ).toBe("0");

    const sus = await student(ctx, "Suspended Sabbir");
    const susCode = (await sus.b.get("/me/referral")).json().code;
    await ctx.db.query("update users set status = 'suspended' where id = $1", [sus.id]);
    expect((await f1.b.get(`/referrals/resolve/${susCode}`)).json().valid).toBe(false);

    const admin = await signIn(ctx, "Ref Admin");
    await grant(ctx, admin.sub, "admin");
    const list = await admin.b.get("/admin/referrals");
    expect(list.statusCode).toBe(200);
    expect(list.json()[0]).toHaveProperty("referrer");
    expect((await staff.b.get("/admin/referrals")).statusCode).toBe(403);
  });
});
