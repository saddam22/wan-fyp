import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { grant, guardian, signIn, student, useHarness } from "./harness.ts";
import { inDays, mentor, PDF, placeOrder, upload } from "./market.ts";

const ctx = useHarness();

describe("orders and order files", () => {
  it("the server prices the order from the price list (client numbers are ignored)", async () => {
    const s = await student(ctx, "Pricing Student");
    const q = (
      await s.b.post("/orders/quote", {
        workType: "practical_khata",
        pages: 10,
        deliveryMethod: "courier",
      })
    ).json();
    expect(q).toMatchObject({
      baseMinor: 50000,
      courierMinor: 12000,
      totalMinor: 62000,
      freeRevisions: 2,
    });
    const o = await placeOrder(s, {
      price: { amountMinor: 1 },
      deliveryMethod: "courier",
      deliveryAddress: "House 5, Road 2, Dhanmondi",
    });
    expect(o.price.amountMinor).toBe(62000);
    expect(o.status).toBe("awaiting_payment");
    const full = (await s.b.get(`/orders/${o.id}`)).json();
    expect(full).toMatchObject({
      commissionRate: 0.2,
      freeRevisions: 2,
      deliveryAddress: "House 5, Road 2, Dhanmondi",
    });
    expect(full).not.toHaveProperty("payout");
    expect(full.timeline).toEqual([
      expect.objectContaining({
        kind: "created",
        status: "awaiting_payment",
        actor: "Pricing Student",
      }),
    ]);
    expect(o.code).toMatch(/^EK-\d+$/);
  });

  it("validates the order", async () => {
    const s = await student(ctx, "Validating Student");
    const bad = async (extra: Record<string, unknown>) =>
      (
        await s.b.post("/orders", {
          categorySlug: "practical-khata",
          subjectId: "biology",
          level: "hsc",
          workType: "practical_khata",
          pages: 10,
          deliveryMethod: "digital",
          title: "Biology practical khata",
          instructions: "x".repeat(40),
          deadline: inDays(3),
          ...extra,
        })
      ).statusCode;
    expect(await bad({ deadline: new Date(Date.now() + 3600_000).toISOString() })).toBe(400);
    expect(await bad({ subjectId: "astrology" })).toBe(400);
    expect(await bad({ subjectId: "accounting", level: "ssc" })).toBe(400);
    expect(await bad({ pages: 0 })).toBe(400);
    expect(await bad({ deliveryMethod: "courier" })).toBe(400);
    expect(await bad({ preferredMentorId: "00000000-0000-4000-8000-000000000000" })).toBe(400);
    const m = await mentor(ctx, "Biology Pref Mentor");
    expect(await bad({ preferredMentorId: m.id })).toBe(201);
    // Only students place orders.
    const g = await guardian(ctx, "Ordering Guardian");
    expect((await g.b.post("/orders", {})).statusCode).toBe(403);
  });

  it("only the student, staff and a permitted guardian can see an order; lists are scoped", async () => {
    const s = await student(ctx, "Visible Student");
    const o = await placeOrder(s);
    const other = await student(ctx, "Other Student");
    expect((await other.b.get(`/orders/${o.id}`)).statusCode).toBe(404);
    const g = await guardian(ctx, "Order Guardian");
    expect((await g.b.get(`/orders/${o.id}`)).statusCode).toBe(404);
    const code = (await s.b.post("/me/guardian-code")).json().code;
    await g.b.post("/guardian/children", { contact: `${s.sub.slice(0, 8)}@example.com`, code });
    expect((await g.b.get(`/orders/${o.id}`)).statusCode).toBe(200);
    expect(
      (await g.b.get("/orders?as=guardian")).json().map((x: { id: string }) => x.id),
    ).toContain(o.id);
    await s.b.put(`/me/guardians/${g.id}`, {
      viewOrders: false,
      viewPayments: true,
      payOnBehalf: false,
    });
    expect((await g.b.get(`/orders/${o.id}`)).statusCode).toBe(404);

    const sup = await signIn(ctx, "Order Supporter");
    await grant(ctx, sup.sub, "supporter");
    expect((await sup.b.get(`/orders/${o.id}`)).json()).toHaveProperty("payout");
    expect((await sup.b.get("/orders?as=staff")).statusCode).toBe(200);
    expect((await s.b.get("/orders?as=staff")).statusCode).toBe(403);
    expect((await s.b.get("/orders")).json().map((x: { id: string }) => x.id)).toEqual([o.id]);
    expect((await other.b.get("/orders")).json()).toEqual([]);
  });

  it("students cancel before assignment; staff need a reason", async () => {
    const s = await student(ctx, "Cancelling Student");
    const o = await placeOrder(s);
    const r = await s.b.post(`/orders/${o.id}/cancel`, {});
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().status).toBe("cancelled");
    expect((await s.b.post(`/orders/${o.id}/cancel`, {})).statusCode).toBe(409);

    const o2 = await placeOrder(s);
    const admin = await signIn(ctx, "Cancel Admin");
    await grant(ctx, admin.sub, "admin");
    expect((await admin.b.post(`/orders/${o2.id}/cancel`, {})).statusCode).toBe(400);
    expect(
      (await admin.b.post(`/orders/${o2.id}/cancel`, { reason: "Duplicate order" })).json().status,
    ).toBe("cancelled");
  });

  it("requirement files: signed upload, content check, EXIF removed, private download, removal", async () => {
    const s = await student(ctx, "File Student");
    const o = await placeOrder(s);
    const ok = await upload(ctx, s, o.id, "requirement", PDF, "application/pdf", "syllabus.pdf");
    expect(ok.done?.statusCode, ok.done?.body).toBe(200);

    // A script renamed to .pdf is refused after upload.
    const fake = await upload(
      ctx,
      s,
      o.id,
      "requirement",
      Buffer.from("<script>alert(1)</script>"),
      "application/pdf",
      "evil.pdf",
    );
    expect(fake.done?.statusCode).toBe(400);
    expect((await upload(ctx, s, o.id, "requirement", PDF, "text/html")).start.statusCode).toBe(
      400,
    );
    expect((await upload(ctx, s, o.id, "preview", PDF, "image/png")).start.statusCode).toBe(403);

    const jpeg = await sharp({ create: { width: 30, height: 20, channels: 3, background: "#888" } })
      .jpeg()
      .withExif({ IFD0: { Copyright: "gps-secret" } })
      .toBuffer();
    const img = await upload(ctx, s, o.id, "requirement", jpeg, "image/jpeg", "page1.jpg");
    expect(img.done?.statusCode).toBe(200);
    const dl = await s.b.get(`/orders/${o.id}/files/${img.fileId}`);
    expect(dl.statusCode).toBe(200);
    expect(dl.headers["content-type"]).toBe("image/webp");
    expect(dl.rawPayload.includes(Buffer.from("gps-secret"))).toBe(false);
    expect(dl.headers["x-content-type-options"]).toBe("nosniff");

    const other = await student(ctx, "Snooping Student");
    expect((await other.b.get(`/orders/${o.id}/files/${ok.fileId}`)).statusCode).toBe(404);
    const files = (await s.b.get(`/orders/${o.id}`)).json().files;
    expect(files.map((f: { name: string }) => f.name)).toEqual(["syllabus.pdf", "page1.jpg"]);
    expect((await s.b.del(`/orders/${o.id}/files/${ok.fileId}`)).statusCode).toBe(200);
    expect((await s.b.get(`/orders/${o.id}`)).json().files).toHaveLength(1);
  });
});
