import { describe, expect, it } from "vitest";
import { tx } from "../src/db.ts";
import { post } from "../src/market/ledger.ts";
import { grant, signIn, useHarness } from "./harness.ts";
import { deliverWork, paidOrder } from "./market.ts";

const ctx = useHarness();
const balances = async (who: { b: { get(u: string): Promise<{ json(): unknown }> } }) =>
  (await who.b.get("/accountant/balances")).json() as Record<string, number>;

describe("double-entry ledger, commission, mentor earnings", () => {
  it("payment → held for the order; approval → 80/20 split; closure → available", async () => {
    const { acc, m, s, o } = await paidOrder(ctx);
    let b = await balances(acc);
    expect(b).toMatchObject({ heldForOrdersMinor: 50000, trialBalanceMinor: 0 });
    expect(b.cashTotalMinor).toBeGreaterThanOrEqual(50000);
    expect((await m.b.get("/mentor/earnings")).json()).toMatchObject({
      pendingMinor: 0,
      availableMinor: 0,
    });

    await deliverWork(ctx, m, o.id);
    expect((await s.b.post(`/orders/${o.id}/approve`)).statusCode).toBe(200);
    expect((await m.b.get("/mentor/earnings")).json()).toMatchObject({
      pendingMinor: 40000,
      availableMinor: 0,
    });
    b = await balances(acc);
    expect(b.trialBalanceMinor).toBe(0);

    await ctx.app.edkDeps.delivery.close(o.id, null, "test");
    const e = (await m.b.get("/mentor/earnings")).json();
    expect(e).toMatchObject({ pendingMinor: 0, availableMinor: 40000 });
    expect(e.lines.map((l: { kind: string }) => l.kind)).toEqual([
      "earnings_available",
      "earnings_available",
      "order_earned",
    ]);

    const lines = (await acc.b.get(`/accountant/ledger?account=escrow:order:${o.id}`)).json();
    expect(
      lines.map((l: { debitMinor: number; creditMinor: number }) => [l.debitMinor, l.creditMinor]),
    ).toEqual([
      [50000, 0],
      [0, 50000],
    ]);
    const commission = (await acc.b.get("/accountant/ledger?account=revenue:commission")).json();
    expect(
      commission.some(
        (l: { creditMinor: number; memo: string }) =>
          l.creditMinor === 10000 && l.memo === `${o.code} approved`,
      ),
    ).toBe(true);
  });

  it("odd amounts: the mentor share is rounded down, commission takes the remainder", async () => {
    const admin = await signIn(ctx, "Price Admin");
    await grant(ctx, admin.sub, "admin");
    await admin.b.put("/admin/price-list/biology_drawing", { perPageMinor: 3333 });
    const { m, s, o } = await paidOrder(ctx, {
      workType: "biology_drawing",
      pages: 1,
      categorySlug: "drawings",
    });
    await deliverWork(ctx, m, o.id);
    await s.b.post(`/orders/${o.id}/approve`);
    expect((await m.b.get("/mentor/earnings")).json().pendingMinor).toBe(2666); // floor(3333 × 0.8)
    await admin.b.put("/admin/price-list/biology_drawing", { perPageMinor: 25000 });
  });

  it("the database refuses unbalanced or edited entries; postings are idempotent", async () => {
    const { o } = await paidOrder(ctx);
    // Same business event twice → posted once.
    const key = `test:${o.id}`;
    const entries = [
      { account: "revenue:commission", amountMinor: 1 },
      { account: "refunds:payable", amountMinor: -1 },
    ];
    const first = await tx(ctx.db, (c) => post(c, { key, kind: "test", memo: "x" }, entries));
    const second = await tx(ctx.db, (c) => post(c, { key, kind: "test", memo: "x" }, entries));
    expect(first).toBeTruthy();
    expect(second).toBeNull();
    // A raw unbalanced insert fails at commit.
    await expect(
      tx(ctx.db, async (c) => {
        const t = (
          await c.query(
            "insert into ledger_transactions (idempotency_key, kind) values ($1, 'bad') returning id",
            [`bad:${o.id}`],
          )
        ).rows[0].id;
        await c.query(
          "insert into ledger_entries (txn_id, account, amount_minor) values ($1, 'revenue:commission', 5)",
          [t],
        );
      }),
    ).rejects.toThrow(/not balanced/);
    await expect(
      ctx.db.query("update ledger_entries set amount_minor = amount_minor + 1"),
    ).rejects.toThrow(/append-only/);
    await expect(ctx.db.query("delete from ledger_transactions")).rejects.toThrow(/append-only/);
    await expect(
      tx(ctx.db, async (c) => {
        const t = (
          await c.query(
            "insert into ledger_transactions (idempotency_key, kind) values ($1, 'bad') returning id",
            [`bad2:${o.id}`],
          )
        ).rows[0].id;
        await c.query(
          "insert into ledger_entries (txn_id, account, amount_minor) values ($1, 'my-pocket', 5), ($1, 'revenue:commission', -5)",
          [t],
        );
      }),
    ).rejects.toThrow(/check/);
  });

  it("only accountants (and super admins) see the books; mentors only their own earnings", async () => {
    const { m, s } = await paidOrder(ctx);
    expect((await s.b.get("/accountant/balances")).statusCode).toBe(403);
    expect((await m.b.get("/accountant/ledger")).statusCode).toBe(403);
    expect((await s.b.get("/mentor/earnings")).statusCode).toBe(403);
    const admin = await signIn(ctx, "Plain Admin");
    await grant(ctx, admin.sub, "admin");
    expect((await admin.b.get("/accountant/ledger")).statusCode).toBe(403);
  });
});
