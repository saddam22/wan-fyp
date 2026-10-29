import { describe, expect, it } from "vitest";
import { grant, signIn, student, useHarness } from "./harness.ts";

const ctx = useHarness();

async function mentor(name: string) {
  const s = await student(ctx, name);
  await grant(ctx, s.sub, "mentor");
  return s;
}

describe("catalog, business rules and mentor profiles", () => {
  it("the public catalog has the seeded subjects, categories, prices and rules", async () => {
    const anon = await signIn(ctx, "Catalog Visitor");
    const c = (await anon.b.get("/catalog")).json();
    expect(c.subjects.map((s: { id: string }) => s.id)).toContain("biology");
    expect(c.categories.map((x: { slug: string }) => x.slug)).toContain("practical-khata");
    expect(c.priceList.practical_khata).toEqual({ amountMinor: 5000, currency: "BDT" });
    expect(c.rules).toEqual({ freeRevisions: 2, courierFeeMinor: 12000, minDeadlineHours: 24 });
    expect(c).not.toHaveProperty("commission");
  });

  it("admins edit the catalog and prices; only super admins change business rules; all audited", async () => {
    const admin = await signIn(ctx, "Catalog Admin");
    await grant(ctx, admin.sub, "admin");
    const s = await student(ctx, "Catalog Student");
    const body = {
      name: "Statistics",
      nameBn: "পরিসংখ্যান",
      levels: ["hsc", "university"],
      active: true,
      sort: 20,
    };
    expect((await s.b.put("/admin/catalog/subjects/statistics", body)).statusCode).toBe(403);
    const r = await admin.b.put("/admin/catalog/subjects/statistics", body);
    expect(r.statusCode, r.body).toBe(200);
    expect((await admin.b.put("/admin/catalog/subjects/Bad Id", body)).statusCode).toBe(400);
    await admin.b.put("/admin/catalog/subjects/statistics", { ...body, active: false });
    expect(
      (await s.b.get("/catalog")).json().subjects.map((x: { id: string }) => x.id),
    ).not.toContain("statistics");

    expect(
      (await admin.b.put("/admin/price-list/diagram", { perPageMinor: 18000 })).json().priceList
        .diagram.amountMinor,
    ).toBe(18000);
    expect(
      (await admin.b.put("/admin/price-list/poetry", { perPageMinor: 18000 })).statusCode,
    ).toBe(400);

    // Commission and other rules: super admin only, validated ranges.
    expect((await admin.b.put("/admin/settings", { commission_rate: 0.25 })).statusCode).toBe(403);
    const sup = await signIn(ctx, "Rules Super");
    await grant(ctx, sup.sub, "super_admin");
    expect((await sup.b.get("/admin/settings")).json().commission_rate).toBe(0.2);
    expect((await sup.b.put("/admin/settings", { commission_rate: 0.9 })).statusCode).toBe(400);
    expect((await sup.b.put("/admin/settings", { unknown_key: 1 })).statusCode).toBe(400);
    const ok = await sup.b.put("/admin/settings", { free_revisions: 3 });
    expect(ok.json().free_revisions).toBe(3);
    await sup.b.put("/admin/settings", { free_revisions: 2 });
    const actions = (
      await ctx.db.query(
        "select action from audit_log where action like 'catalog.%' or action like 'settings.%' or action like 'price_list.%'",
      )
    ).rows.map((x) => x.action);
    expect(actions).toEqual(
      expect.arrayContaining(["catalog.subject", "price_list.update", "settings.update"]),
    );
  });

  it("mentors manage their profile; validation; the public directory hides capacity and contact data", async () => {
    const s = await student(ctx, "Not A Mentor");
    expect((await s.b.get("/mentor/profile")).statusCode).toBe(403);
    const m = await mentor("Profile Mentor");
    const base = {
      headline: "Biology drawings",
      bio: "",
      institution: "Dhaka College",
      education: "BSc",
      subjects: ["biology"],
      workTypes: ["biology_drawing"],
      levels: ["hsc"],
      available: true,
      capacity: 2,
    };
    expect(
      (await m.b.put("/mentor/profile", { ...base, subjects: ["astrology"] })).statusCode,
    ).toBe(400);
    expect((await m.b.put("/mentor/profile", { ...base, subjects: [] })).statusCode).toBe(400);
    const r = await m.b.put("/mentor/profile", base);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ available: true, capacity: 2, activeOrders: 0 });

    const list = (await s.b.get("/mentors?subject=biology")).json();
    const me = list.find((x: { id: string }) => x.id === m.id);
    expect(me).toMatchObject({ name: "Profile Mentor", headline: "Biology drawings" });
    expect(me).not.toHaveProperty("capacity");
    expect(JSON.stringify(list)).not.toContain("@example.com");
    expect(
      (await s.b.get("/mentors?subject=math")).json().find((x: { id: string }) => x.id === m.id),
    ).toBeUndefined();
  });
});
