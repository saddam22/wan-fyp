import { describe, expect, it } from "vitest";
import { grant, signIn, student, useHarness } from "./harness.ts";
import { accountant, deliverWork, paidOrder, type Person } from "./market.ts";

const ctx = useHarness();
const bal = async (p: Pick<Person, "b">) =>
  (await p.b.get("/accountant/balances")).json() as Record<string, number>;
const earnings = async (m: Person) =>
  (await m.b.get("/mentor/earnings")).json() as { pendingMinor: number; availableMinor: number };
const refundsOf = async (p: Pick<Person, "b">, orderId: string) =>
  (
    (await p.b.get("/accountant/refunds")).json() as {
      id: string;
      orderId: string;
      status: string;
      amount: { amountMinor: number };
      to: unknown;
    }[]
  ).filter((r) => r.orderId === orderId);

async function superAdmin(name: string) {
  const s = await signIn(ctx, name);
  await grant(ctx, s.sub, "super_admin");
  return s;
}

describe("refunds, payouts, reconciliation, invoices", () => {
  it("cancelling a paid order refunds it: approve (second person) → paid with a reference", async () => {
    const { acc, bk, s, o } = await paidOrder(ctx);
    // The mentor has started, so only staff can cancel now.
    expect((await s.b.post(`/orders/${o.id}/cancel`, {})).statusCode).toBe(409);
    const admin = await signIn(ctx, "Cancelling Admin");
    await grant(ctx, admin.sub, "admin");
    const r = await admin.b.post(`/orders/${o.id}/cancel`, {
      reason: "Mentor fell ill, student agreed",
    });
    expect(r.statusCode, r.body).toBe(200);
    const [ref] = await refundsOf(acc, o.id);
    expect(ref).toMatchObject({
      status: "requested",
      amount: { amountMinor: 50000 },
      to: { method: "bkash", number: "01766666666" },
    });
    let b = await bal(acc);
    expect(b.trialBalanceMinor).toBe(0);
    expect(b.refundsPayableMinor).toBeGreaterThanOrEqual(50000);

    expect(
      (
        await acc.b.post(`/accountant/refunds/${ref!.id}/paid`, {
          fromAccountId: bk.key,
          reference: "RF123456",
        })
      ).statusCode,
    ).toBe(409);
    expect((await acc.b.post(`/accountant/refunds/${ref!.id}/approve`)).statusCode).toBe(200);
    const paid = await acc.b.post(`/accountant/refunds/${ref!.id}/paid`, {
      fromAccountId: bk.key,
      reference: "rf-123456",
    });
    expect(paid.json()).toMatchObject({ status: "paid", reference: "RF123456" });
    expect(
      (
        await acc.b.post(`/accountant/refunds/${ref!.id}/paid`, {
          fromAccountId: bk.key,
          reference: "RF999999",
        })
      ).statusCode,
    ).toBe(409);
    b = await bal(acc);
    expect(b.trialBalanceMinor).toBe(0);
    const pay = (await s.b.get(`/orders/${o.id}/payment`)).json().payments[0];
    expect(pay.status).toBe("refunded");
    await new Promise((x) => setTimeout(x, 50));
    expect(
      (await s.b.get("/me/notifications")).json().items.map((n: { type: string }) => n.type),
    ).toContain("refund.paid");
  });

  it("the person who decided a refund can't approve it", async () => {
    const { o, m } = await paidOrder(ctx);
    const boss = await superAdmin("Deciding Super");
    await m.b.post(`/orders/${o.id}/disputes`, {
      reason: "The student asked for something else entirely",
    });
    const d = (await boss.b.get("/admin/disputes?status=open"))
      .json()
      .find((x: { orderId: string }) => x.orderId === o.id);
    expect(
      (
        await boss.b.post(`/admin/disputes/${d.id}/resolve`, {
          outcome: "refund",
          note: "Not deliverable, refund in full",
        })
      ).statusCode,
    ).toBe(200);
    const [ref] = await refundsOf(boss, o.id);
    expect(ref!.amount.amountMinor).toBe(50000);
    expect((await boss.b.post(`/accountant/refunds/${ref!.id}/approve`)).statusCode).toBe(403);
  });

  it("partial refund after approval comes back from the mentor's share and the commission", async () => {
    const { acc, m, s, o } = await paidOrder(ctx);
    const admin = await signIn(ctx, "Partial Admin");
    await grant(ctx, admin.sub, "admin");
    await deliverWork(ctx, m, o.id);
    await s.b.post(`/orders/${o.id}/approve`);
    expect(await earnings(m)).toMatchObject({ pendingMinor: 40000 });
    await s.b.post(`/orders/${o.id}/disputes`, { reason: "Two pages were missing after approval" });
    const d = (await admin.b.get("/admin/disputes?status=open"))
      .json()
      .find((x: { orderId: string }) => x.orderId === o.id);
    const r = await admin.b.post(`/admin/disputes/${d.id}/resolve`, {
      outcome: "partial",
      refundMinor: 20000,
      note: "Refund two pages' worth",
    });
    expect(r.statusCode, r.body).toBe(200);
    // 20000 back: 16000 from the mentor (80%), 4000 from commission; the rest is available now.
    expect(await earnings(m)).toMatchObject({ pendingMinor: 0, availableMinor: 24000 });
    expect((await refundsOf(acc, o.id))[0]!.amount.amountMinor).toBe(20000);
    expect((await bal(acc)).trialBalanceMinor).toBe(0);
  });

  it("payouts: within the available balance, one open at a time, approved and sent by two different people", async () => {
    const { acc, bk, m, s, o } = await paidOrder(ctx);
    const acc2 = await accountant(ctx, "Second Accountant");
    await deliverWork(ctx, m, o.id);
    await s.b.post(`/orders/${o.id}/approve`);
    expect((await m.b.post(`/mentor/orders/${o.id}/confirm`)).statusCode).toBe(200);
    expect(await earnings(m)).toMatchObject({ availableMinor: 40000 });

    const req = (body: Record<string, unknown>) =>
      m.b.post("/mentor/payouts", { method: "bkash", account: "01788888888", ...body });
    expect((await req({ amountMinor: 30000 })).statusCode).toBe(400); // below ৳500 minimum
    const sup = await superAdmin("Payout Rules Super");
    await sup.b.put("/admin/settings", { min_payout_minor: 10000 });
    expect((await req({ amountMinor: 50000 })).statusCode).toBe(400); // more than available
    const p = await req({ amountMinor: 30000 });
    expect(p.statusCode, p.body).toBe(201);
    expect(await earnings(m)).toMatchObject({ availableMinor: 10000 });
    expect((await req({ amountMinor: 10000 })).statusCode).toBe(409);
    const pid = p.json().id;
    expect((await m.b.post(`/accountant/payouts/${pid}/approve`)).statusCode).toBe(403);
    expect((await acc.b.post(`/accountant/payouts/${pid}/approve`)).json().status).toBe("approved");
    expect(
      (
        await acc.b.post(`/accountant/payouts/${pid}/paid`, {
          fromAccountId: bk.key,
          reference: "PO1234567",
        })
      ).statusCode,
    ).toBe(403);
    const sent = await acc2.b.post(`/accountant/payouts/${pid}/paid`, {
      fromAccountId: bk.key,
      reference: "PO1234567",
    });
    expect(sent.json()).toMatchObject({
      status: "paid",
      reference: "PO1234567",
      paidBy: "Second Accountant",
    });
    expect((await bal(acc)).trialBalanceMinor).toBe(0);

    // A rejected payout returns the money to the available balance.
    const p2 = (await req({ amountMinor: 10000 })).json();
    expect(await earnings(m)).toMatchObject({ availableMinor: 0 });
    expect(
      (
        await acc.b.post(`/accountant/payouts/${p2.id}/reject`, { note: "Wrong number format" })
      ).json().status,
    ).toBe("rejected");
    expect(await earnings(m)).toMatchObject({ availableMinor: 10000 });
    const mine = (await m.b.get("/mentor/payouts")).json();
    expect(mine.items.map((x: { status: string }) => x.status)).toEqual(["rejected", "paid"]);
    await new Promise((x) => setTimeout(x, 50));
    expect(
      (await m.b.get("/me/notifications")).json().items.map((n: { type: string }) => n.type),
    ).toEqual(expect.arrayContaining(["payout.paid", "payout.rejected"]));
    await sup.b.put("/admin/settings", { min_payout_minor: 50000 });
  });

  it("reconciliation and invoices", async () => {
    const { acc, bk, s, o, pid } = await paidOrder(ctx);
    const rec = (await acc.b.get("/accountant/reconciliation")).json();
    const line = rec.accounts.find((a: { id: string }) => a.id === bk.key);
    expect(line).toMatchObject({ receivedMinor: 50000, balanceMinor: 50000 });
    expect(rec.unreconciled.map((u: { id: string }) => u.id)).toContain(pid);
    expect((await acc.b.post(`/accountant/payments/${pid}/reconcile`)).statusCode).toBe(200);
    expect((await acc.b.post(`/accountant/payments/${pid}/reconcile`)).statusCode).toBe(409);
    expect(
      (await acc.b.get("/accountant/reconciliation"))
        .json()
        .unreconciled.map((u: { id: string }) => u.id),
    ).not.toContain(pid);

    const inv = await s.b.get(`/payments/${pid}/invoice`);
    expect(inv.statusCode, inv.body).toBe(200);
    expect(inv.json()).toMatchObject({
      total: { amountMinor: 50000 },
      tax: { amountMinor: 0 },
      payment: { method: "bkash", status: "approved" },
    });
    expect(inv.json().items[0].description).toContain(o.code);
    const other = await student(ctx, "Invoice Snoop");
    expect((await other.b.get(`/payments/${pid}/invoice`)).statusCode).toBe(404);
  });
});
