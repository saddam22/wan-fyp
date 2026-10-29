import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { grant, signIn, student, useHarness } from "./harness.ts";
import { freshSubject, mentor, PDF, placeOrder, upload, type Person } from "./market.ts";

const ctx = useHarness();
const png = () =>
  sharp({ create: { width: 200, height: 150, channels: 3, background: "#fff" } })
    .png()
    .toBuffer();

/** An order in progress with its mentor. */
async function working() {
  const subject = await freshSubject(ctx);
  const m = await mentor(ctx, `Delivering ${subject}`, { subjects: [subject] });
  const s = await student(ctx, `Receiving ${subject}`);
  const o = await placeOrder(s, { subjectId: subject });
  await ctx.app.edkDeps.matching.startMatching(o.id, null);
  const offer = (await m.b.get("/mentor/offers")).json()[0];
  expect((await m.b.post(`/mentor/offers/${offer.id}/accept`)).statusCode).toBe(200);
  expect((await m.b.post(`/mentor/orders/${o.id}/start`)).statusCode).toBe(200);
  return { o, m, s };
}
async function deliver(m: Person, orderId: string) {
  expect(
    (await upload(ctx, m, orderId, "preview", await png(), "image/png", "preview.png")).done
      ?.statusCode,
  ).toBe(200);
  expect(
    (await upload(ctx, m, orderId, "final", PDF, "application/pdf", "final.pdf")).done?.statusCode,
  ).toBe(200);
  const r = await m.b.post(`/mentor/orders/${orderId}/deliver`, { note: "Done" });
  expect(r.statusCode, r.body).toBe(200);
  return r.json();
}

describe("delivery, revisions, approval, disputes", () => {
  it("delivery needs a preview and finals; finals unlock for the student only after approval", async () => {
    const { o, m, s } = await working();
    expect((await m.b.post(`/mentor/orders/${o.id}/deliver`)).statusCode).toBe(400);
    expect((await upload(ctx, m, o.id, "preview", PDF, "application/pdf")).start.statusCode).toBe(
      400,
    );
    await deliver(m, o.id);
    const view = (await s.b.get(`/orders/${o.id}`)).json();
    expect(view.status).toBe("delivered");
    expect(view.files.map((f: { stage: string }) => f.stage)).toEqual(["preview"]);
    const preview = view.files[0];
    const img = await s.b.get(`/orders/${o.id}/files/${preview.id}`);
    expect(img.headers["content-type"]).toBe("image/webp"); // watermarked copy
    const finalId = (
      await ctx.db.query("select id from order_files where order_id = $1 and stage = 'final'", [
        o.id,
      ])
    ).rows[0].id;
    expect((await s.b.get(`/orders/${o.id}/files/${finalId}`)).statusCode).toBe(403);
    // Only the student approves.
    expect((await m.b.post(`/orders/${o.id}/approve`)).statusCode).toBe(404);
    expect((await s.b.post(`/orders/${o.id}/approve`)).json().status).toBe("approved");
    expect((await s.b.get(`/orders/${o.id}/files/${finalId}`)).statusCode).toBe(200);
    expect((await s.b.post(`/orders/${o.id}/approve`)).statusCode).toBe(409);
    await new Promise((r) => setTimeout(r, 50));
    const types = (await m.b.get("/me/notifications"))
      .json()
      .items.map((n: { type: string }) => n.type);
    expect(types).toContain("order.approved");
  });

  it("free revisions go to the mentor; beyond the allowance a revision waits for payment", async () => {
    const { o, m, s } = await working();
    await deliver(m, o.id);
    for (const n of [1, 2]) {
      const r = await s.b.post(`/orders/${o.id}/revisions`, {
        instructions: `Please relabel diagram ${n} clearly`,
      });
      expect(r.statusCode, r.body).toBe(201);
      expect(r.json()).toMatchObject({
        n,
        paymentDue: false,
        order: { status: "revision_requested" },
      });
      // The mentor must deliver new files for the new round.
      expect((await m.b.post(`/mentor/orders/${o.id}/deliver`)).statusCode).toBe(400);
      await deliver(m, o.id);
    }
    const third = await s.b.post(`/orders/${o.id}/revisions`, {
      instructions: "One more change to page 4",
    });
    expect(third.json()).toMatchObject({
      n: 3,
      paymentDue: true,
      feeMinor: 10000,
      order: { status: "delivered" },
    });
    expect(
      (await s.b.post(`/orders/${o.id}/revisions`, { instructions: "And another change please" }))
        .statusCode,
    ).toBe(409);
    // Phase 5 payment approval activates it.
    const act = await ctx.app.edkDeps.delivery.activatePaidRevision(o.id, 3, null);
    expect(act.status).toBe("revision_requested");
    const view = (await s.b.get(`/orders/${o.id}`)).json();
    expect(
      view.revisions.map((r: { n: number; paid: boolean; paymentStatus: string }) => [
        r.n,
        r.paid,
        r.paymentStatus,
      ]),
    ).toEqual([
      [1, false, "not_required"],
      [2, false, "not_required"],
      [3, true, "paid"],
    ]);
    expect(view.deliveredAt).toBeTruthy();
  });

  it("disputes: either side opens one; staff resolve with release, refund or partial", async () => {
    const admin = await signIn(ctx, "Dispute Admin");
    await grant(ctx, admin.sub, "admin");
    const outsider = await student(ctx, "Dispute Outsider");

    const a = await working();
    await deliver(a.m, a.o.id);
    expect(
      (
        await outsider.b.post(`/orders/${a.o.id}/disputes`, {
          reason: "This is not my order at all, really",
        })
      ).statusCode,
    ).toBe(404);
    expect((await a.s.b.post(`/orders/${a.o.id}/disputes`, { reason: "short" })).statusCode).toBe(
      400,
    );
    const opened = await a.s.b.post(`/orders/${a.o.id}/disputes`, {
      reason: "The drawings do not match the board syllabus at all",
    });
    expect(opened.statusCode, opened.body).toBe(201);
    expect(opened.json().status).toBe("disputed");
    expect(
      (
        await a.m.b.post(`/orders/${a.o.id}/disputes`, {
          reason: "Opening a second dispute on the same order",
        })
      ).statusCode,
    ).toBe(409);
    const list = (await admin.b.get("/admin/disputes?status=open")).json();
    const d = list.find((x: { orderId: string }) => x.orderId === a.o.id);
    expect(d).toMatchObject({
      reason: "The drawings do not match the board syllabus at all",
      status: "open",
    });
    expect(
      (
        await a.s.b.post(`/admin/disputes/${d.id}/resolve`, {
          outcome: "refund",
          note: "x".repeat(10),
        })
      ).statusCode,
    ).toBe(403);
    const rel = await admin.b.post(`/admin/disputes/${d.id}/resolve`, {
      outcome: "release",
      note: "Work matches the instructions",
    });
    expect(rel.json().status).toBe("approved");
    expect(
      (
        await admin.b.post(`/admin/disputes/${d.id}/resolve`, {
          outcome: "refund",
          note: "Changed my mind",
        })
      ).statusCode,
    ).toBe(409);

    const b = await working();
    await b.m.b.post(`/orders/${b.o.id}/disputes`, {
      reason: "Student stopped answering, cannot finish the work",
    });
    const db2 = (await admin.b.get("/admin/disputes?status=open"))
      .json()
      .find((x: { orderId: string }) => x.orderId === b.o.id);
    expect(
      (
        await admin.b.post(`/admin/disputes/${db2.id}/resolve`, {
          outcome: "partial",
          refundMinor: 50000,
          note: "Price is 50000",
        })
      ).statusCode,
    ).toBe(400);
    const part = await admin.b.post(`/admin/disputes/${db2.id}/resolve`, {
      outcome: "partial",
      refundMinor: 20000,
      note: "Half the work was done",
    });
    expect(part.json()).toMatchObject({
      status: "closed",
      dispute: { status: "resolved_partial", refundMinor: 20000 },
    });

    const c = await working();
    await c.s.b.post(`/orders/${c.o.id}/disputes`, {
      reason: "Mentor is not responding to messages for days",
    });
    const dc = (await admin.b.get("/admin/disputes?status=open"))
      .json()
      .find((x: { orderId: string }) => x.orderId === c.o.id);
    expect(
      (
        await admin.b.post(`/admin/disputes/${dc.id}/resolve`, {
          outcome: "refund",
          note: "Full refund agreed",
        })
      ).json().status,
    ).toBe("refunded");
    const actions = (
      await ctx.db.query("select count(*) from audit_log where action = 'dispute.resolve'")
    ).rows[0].count;
    expect(Number(actions)).toBe(3);
  });

  it("both sides confirm: the student approves, the mentor confirms, then the share is released", async () => {
    const { o, m, s } = await working();
    // Nothing to confirm before the student approves.
    expect((await m.b.post(`/mentor/orders/${o.id}/confirm`)).statusCode).toBe(409);
    await deliver(m, o.id);
    expect((await m.b.post(`/mentor/orders/${o.id}/confirm`)).statusCode).toBe(409);
    expect((await s.b.post(`/orders/${o.id}/approve`)).statusCode).toBe(200);
    expect((await s.b.get(`/orders/${o.id}`)).json()).toMatchObject({ status: "approved" });

    // Not without the mentor: neither staff nor the timer can close it.
    const su = await signIn(ctx, "Closing Super");
    await grant(ctx, su.sub, "super_admin");
    expect((await su.b.post(`/admin/orders/${o.id}/close`)).statusCode).toBe(409);
    await ctx.db.query("update orders set approved_at = now() - interval '30 days' where id = $1", [
      o.id,
    ]);
    const r = await ctx.app.edkDeps.delivery.sweep();
    expect(r.confirmReminded).toBeGreaterThanOrEqual(1);
    expect((await s.b.get(`/orders/${o.id}`)).json().status).toBe("approved");
    expect((await ctx.app.edkDeps.delivery.sweep()).confirmReminded).toBe(0);
    await new Promise((x) => setTimeout(x, 50));
    expect(
      (await m.b.get("/me/notifications"))
        .json()
        .items.some((x: { type: string }) => x.type === "order.confirm_needed"),
    ).toBe(true);

    // Only the assigned mentor can confirm; then it closes at once.
    const other = await mentor(ctx, "Other Confirmer");
    expect((await other.b.post(`/mentor/orders/${o.id}/confirm`)).statusCode).toBe(404);
    expect((await s.b.post(`/mentor/orders/${o.id}/confirm`)).statusCode).toBe(403);
    const ok = await m.b.post(`/mentor/orders/${o.id}/confirm`);
    expect(ok.statusCode, ok.body).toBe(200);
    const done = (await s.b.get(`/orders/${o.id}`)).json();
    expect(done.status).toBe("closed");
    expect(done.mentorConfirmedAt).toBeTruthy();
    expect((await m.b.post(`/mentor/orders/${o.id}/confirm`)).statusCode).toBe(409);
  });

  it("deadline reminders go out once", async () => {
    const w = await working();
    await ctx.db.query("update orders set deadline = now() + interval '5 hours' where id = $1", [
      w.o.id,
    ]);
    expect((await ctx.app.edkDeps.delivery.sweep()).reminded).toBeGreaterThanOrEqual(1);
    expect((await ctx.app.edkDeps.delivery.sweep()).reminded).toBe(0);
    await new Promise((r) => setTimeout(r, 50));
    const n = (await w.m.b.get("/me/notifications"))
      .json()
      .items.find((x: { type: string }) => x.type === "order.deadline");
    expect(n).toMatchObject({ link: `/mentor/orders/${w.o.id}`, data: { hours: 5 } });
  });
});
