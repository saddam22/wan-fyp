import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { grant, guardian, student, useHarness } from "./harness.ts";
import {
  account,
  accountant,
  freshSubject,
  mentor,
  newTrx,
  placeOrder,
  upload,
  PDF,
  type Person,
} from "./market.ts";

const ctx = useHarness();
const due = async (p: Person, orderId: string) =>
  (await p.b.get(`/orders/${orderId}/payment`)).json();
const submit = (p: Person, paymentId: string, body: Record<string, unknown>) =>
  p.b.post(`/payments/${paymentId}/submit`, body);
const notes = async (p: Person) =>
  (await p.b.get("/me/notifications"))
    .json()
    .items.map((n: { type: string }) => n.type) as string[];

describe("manual payments (ICTSpark flow, hardened)", () => {
  it("receiving accounts: accountants manage, everyone signed in sees the enabled ones", async () => {
    const acc = await accountant(ctx, "Accounts Ayesha");
    const s = await student(ctx, "Accounts Student");
    expect(
      (
        await s.b.post("/accountant/payment-accounts", {
          method: "bkash",
          channel: "personal",
          name: "x",
          number: "01700000000",
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await acc.b.post("/accountant/payment-accounts", {
          method: "bank",
          channel: "personal",
          name: "City Bank",
          number: "1234567890",
        })
      ).statusCode,
    ).toBe(400);
    const a = await account(ctx, acc, { name: "bKash merchant", channel: "merchant" });
    const off = await account(ctx, acc, { name: "Old Nagad", method: "nagad" });
    await acc.b.put(`/accountant/payment-accounts/${off.key}`, {
      method: "nagad",
      channel: "personal",
      name: "Old Nagad",
      number: "01700000001",
      enabled: false,
    });
    const visible = (await s.b.get("/payments/accounts")).json().map((x: { key: string }) => x.key);
    expect(visible).toContain(a.key);
    expect(visible).not.toContain(off.key);
  });

  it("submit → reject with a reason → resubmit → approve starts matching", async () => {
    const acc = await accountant(ctx, "Verifier Vikram");
    const bk = await account(ctx, acc);
    const subject = await freshSubject(ctx);
    const m = await mentor(ctx, `Paid Mentor ${subject}`, { subjects: [subject] });
    const s = await student(ctx, "Paying Student");
    const o = await placeOrder(s, { subjectId: subject });

    const d = await due(s, o.id);
    expect(d).toMatchObject({
      canPay: true,
      due: { status: "pending", purpose: "order", amount: { amountMinor: 50000 } },
    });
    expect(d.due.invoiceNo).toMatch(/^INV-\d{4}-\d{6}$/);
    const pid = d.due.id;

    expect(
      (await submit(s, pid, { accountId: bk.key, sender: "12345", trxId: "ABC12345" })).statusCode,
    ).toBe(400);
    expect(
      (await submit(s, pid, { accountId: bk.key, sender: "01712345678", trxId: "12" })).statusCode,
    ).toBe(400);
    const trx = newTrx();
    // Bengali digits and spaces are normalized like in ICTSpark.
    const ok = await submit(s, pid, {
      accountId: bk.key,
      sender: "০১৭১২-৩৪৫৬৭৮",
      trxId: ` ${trx.toLowerCase()} `,
    });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json()).toMatchObject({
      status: "submitted",
      sender: "01712345678",
      trxId: trx,
      method: "bkash",
    });
    expect((await s.b.get(`/orders/${o.id}`)).json().status).toBe("payment_review");
    expect(
      (await submit(s, pid, { accountId: bk.key, sender: "01712345678", trxId: newTrx() }))
        .statusCode,
    ).toBe(409);
    expect((await s.b.post(`/orders/${o.id}/cancel`, {})).statusCode).toBe(409);
    await new Promise((r) => setTimeout(r, 50));
    expect(await notes(acc)).toContain("payment.submitted");

    // Students can't decide; a reason is required to reject.
    expect(
      (await s.b.post(`/accountant/payments/${pid}/decision`, { approve: true })).statusCode,
    ).toBe(403);
    expect(
      (await acc.b.post(`/accountant/payments/${pid}/decision`, { approve: false })).statusCode,
    ).toBe(400);
    const rej = await acc.b.post(`/accountant/payments/${pid}/decision`, {
      approve: false,
      note: "No such TrxID in the statement",
    });
    expect(rej.json()).toMatchObject({
      status: "rejected",
      note: "No such TrxID in the statement",
    });
    expect((await s.b.get(`/orders/${o.id}`)).json().status).toBe("awaiting_payment");
    await new Promise((r) => setTimeout(r, 50));
    expect(await notes(s)).toContain("payment.rejected");

    // The rejected TrxID is free again; the corrected submission is approved.
    expect(
      (await submit(s, pid, { accountId: bk.key, sender: "01712345678", trxId: trx })).statusCode,
    ).toBe(200);
    const appr = await acc.b.post(`/accountant/payments/${pid}/decision`, { approve: true });
    expect(appr.json()).toMatchObject({ status: "approved", decidedBy: "Verifier Vikram" });
    expect(
      (await acc.b.post(`/accountant/payments/${pid}/decision`, { approve: true })).statusCode,
    ).toBe(409);
    const order = (await s.b.get(`/orders/${o.id}`)).json();
    expect(order.status).toBe("matching");
    expect(order.timeline.map((e: { kind: string }) => e.kind)).toEqual(
      expect.arrayContaining(["payment_submitted", "payment_rejected", "matching", "offered"]),
    );
    expect(
      (await m.b.get("/mentor/offers")).json().map((x: { orderId: string }) => x.orderId),
    ).toEqual([o.id]);
    const attempts = (
      await ctx.db.query(
        "select decision from payment_attempts where payment_id = $1 order by id",
        [pid],
      )
    ).rows.map((r) => r.decision);
    expect(attempts).toEqual(["rejected", "approved"]);
    const audit = (
      await ctx.db.query("select action from audit_log where target = $1 order by at", [pid])
    ).rows.map((r) => r.action);
    expect(audit).toEqual(["payment.reject", "payment.approve"]);
  });

  it("a TrxID backs one payment only, even under concurrent submissions", async () => {
    const acc = await accountant(ctx, "Dup Checker");
    const bk = await account(ctx, acc);
    const a = await student(ctx, "Dup Student A");
    const b = await student(ctx, "Dup Student B");
    const [oa, ob] = [await placeOrder(a), await placeOrder(b)];
    const [pa, pb] = [(await due(a, oa.id)).due.id, (await due(b, ob.id)).due.id];
    const trx = newTrx();
    const r = await Promise.all([
      submit(a, pa, { accountId: bk.key, sender: "01711111111", trxId: trx }),
      submit(b, pb, { accountId: bk.key, sender: "01722222222", trxId: trx }),
    ]);
    expect(r.map((x) => x.statusCode).sort()).toEqual([200, 409]);
    expect(r.find((x) => x.statusCode === 409)!.json().error.message).toBe(
      "This TrxID was already used for another payment",
    );
  });

  it("guardians pay only with the student's permission; accountants can't verify their own payment", async () => {
    const acc = await accountant(ctx, "Self Checker");
    const bk = await account(ctx, acc);
    const s = await student(ctx, "Guarded Payer");
    const g = await guardian(ctx, "Paying Guardian");
    const code = (await s.b.post("/me/guardian-code")).json().code;
    await g.b.post("/guardian/children", { contact: `${s.sub.slice(0, 8)}@example.com`, code });
    const o = await placeOrder(s);
    expect(await due(g, o.id)).toMatchObject({ canPay: false, due: null });
    const pid = (await due(s, o.id)).due.id;
    expect(
      (await submit(g, pid, { accountId: bk.key, sender: "01733333333", trxId: newTrx() }))
        .statusCode,
    ).toBe(404);
    await s.b.put(`/me/guardians/${g.id}`, {
      viewOrders: true,
      viewPayments: true,
      payOnBehalf: true,
    });
    const ok = await submit(g, pid, { accountId: bk.key, sender: "01733333333", trxId: newTrx() });
    expect(ok.json()).toMatchObject({ status: "submitted", payerName: "Paying Guardian" });
    const outsider = await student(ctx, "Payment Outsider");
    expect((await outsider.b.get(`/orders/${o.id}/payment`)).statusCode).toBe(404);

    // An accountant who is also a student can't approve money for their own order.
    await grant(ctx, s.sub, "accountant");
    expect(
      (await s.b.post(`/accountant/payments/${pid}/decision`, { approve: true })).statusCode,
    ).toBe(403);
    expect(
      (await acc.b.post(`/accountant/payments/${pid}/decision`, { approve: true })).statusCode,
    ).toBe(200);
  });

  it("proof screenshots are private and EXIF-free; foreign proof keys are refused", async () => {
    const acc = await accountant(ctx, "Proof Checker");
    const bk = await account(ctx, acc);
    const s = await student(ctx, "Proof Student");
    const o = await placeOrder(s);
    const pid = (await due(s, o.id)).due.id;
    const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#0a0" } })
      .png()
      .withExif({ IFD0: { Copyright: "phone-gps" } })
      .toBuffer();
    const start = (
      await s.b.post(`/payments/${pid}/proof`, { contentType: "image/png", byteSize: png.length })
    ).json();
    const put = await ctx.app.inject({
      method: "PUT",
      url: start.uploadUrl.replace(/^\/api/, ""),
      headers: { "content-type": "image/png", origin: "http://localhost:3200" },
      payload: png,
    });
    expect(put.statusCode).toBe(200);
    expect(
      (
        await submit(s, pid, {
          accountId: bk.key,
          sender: "01744444444",
          trxId: newTrx(),
          proofKey: "payments/other/x",
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await submit(s, pid, {
          accountId: bk.key,
          sender: "01744444444",
          trxId: newTrx(),
          proofKey: start.proofKey,
        })
      ).json().hasProof,
    ).toBe(true);
    const view = await acc.b.get(`/payments/${pid}/proof`);
    expect(view.statusCode).toBe(200);
    expect(view.rawPayload.includes(Buffer.from("phone-gps"))).toBe(false);
    const other = await student(ctx, "Proof Snoop");
    expect((await other.b.get(`/payments/${pid}/proof`)).statusCode).toBe(404);
  });

  it("a paid revision is charged and goes to the mentor after approval", async () => {
    const acc = await accountant(ctx, "Revision Checker");
    const bk = await account(ctx, acc);
    const subject = await freshSubject(ctx);
    const m = await mentor(ctx, `Rev Mentor ${subject}`, { subjects: [subject] });
    const s = await student(ctx, `Rev Student ${subject}`);
    const o = await placeOrder(s, { subjectId: subject });
    const pid = (await due(s, o.id)).due.id;
    await submit(s, pid, { accountId: bk.key, sender: "01755555555", trxId: newTrx() });
    await acc.b.post(`/accountant/payments/${pid}/decision`, { approve: true });
    const offer = (await m.b.get("/mentor/offers")).json()[0];
    await m.b.post(`/mentor/offers/${offer.id}/accept`);
    await m.b.post(`/mentor/orders/${o.id}/start`);
    const png = await sharp({ create: { width: 40, height: 40, channels: 3, background: "#fff" } })
      .png()
      .toBuffer();
    const deliver = async () => {
      await upload(ctx, m, o.id, "preview", png, "image/png");
      await upload(ctx, m, o.id, "final", PDF, "application/pdf");
      expect((await m.b.post(`/mentor/orders/${o.id}/deliver`, {})).statusCode).toBe(200);
    };
    await deliver();
    for (let i = 1; i <= 2; i++) {
      await s.b.post(`/orders/${o.id}/revisions`, {
        instructions: `Free change number ${i} please`,
      });
      await deliver();
    }
    expect(
      (
        await s.b.post(`/orders/${o.id}/revisions`, { instructions: "A third, paid change please" })
      ).json().paymentDue,
    ).toBe(true);
    const d = await due(s, o.id);
    expect(d.due).toMatchObject({
      purpose: "revision",
      revisionN: 3,
      amount: { amountMinor: 10000 },
      status: "pending",
    });
    await submit(s, d.due.id, { accountId: bk.key, sender: "01755555555", trxId: newTrx() });
    await acc.b.post(`/accountant/payments/${d.due.id}/decision`, { approve: true });
    expect((await s.b.get(`/orders/${o.id}`)).json().status).toBe("revision_requested");
    expect((await due(s, o.id)).due).toBeNull();
    expect((await due(s, o.id)).payments).toHaveLength(2);
  });
});
