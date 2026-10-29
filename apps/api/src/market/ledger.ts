import type { Queryable } from "../db.ts";
import { ApiError } from "../lib/errors.ts";
import { mentorShare, type OrderRow } from "./orders.ts";

export type Entry = { account: string; amountMinor: number };

export const acct = {
  cash: (paymentAccountId: string) => `cash:${paymentAccountId}`,
  escrow: (orderId: string) => `escrow:order:${orderId}`,
  pending: (mentorId: string) => `mentor:${mentorId}:pending`,
  available: (mentorId: string) => `mentor:${mentorId}:available`,
  commission: "revenue:commission",
  refunds: "refunds:payable",
  payouts: "payouts:payable",
};

/**
 * Posts one balanced transaction (inside the caller's DB transaction). Posting the same
 * business event twice is a no-op (idempotency key), so retries never double money.
 */
export async function post(
  c: Queryable,
  t: {
    key: string;
    kind: string;
    memo: string;
    orderId?: string | null;
    paymentId?: string | null;
    actorId?: string | null;
  },
  entries: Entry[],
): Promise<string | null> {
  const lines = entries.filter((e) => e.amountMinor !== 0);
  if (lines.reduce((a, e) => a + e.amountMinor, 0) !== 0)
    throw new ApiError("server", "Unbalanced ledger posting");
  if (lines.length < 2) return null;
  const r = await c.query<{ id: string }>(
    `insert into ledger_transactions (idempotency_key, kind, memo, order_id, payment_id, actor_id) values ($1, $2, $3, $4, $5, $6)
     on conflict (idempotency_key) do nothing returning id`,
    [t.key, t.kind, t.memo, t.orderId ?? null, t.paymentId ?? null, t.actorId ?? null],
  );
  const id = r.rows[0]?.id;
  if (!id) return null; // already posted
  for (const e of lines)
    await c.query(
      "insert into ledger_entries (txn_id, account, amount_minor) values ($1, $2, $3)",
      [id, e.account, e.amountMinor],
    );
  return id;
}

export async function balance(c: Queryable, account: string): Promise<number> {
  return Number(
    (
      await c.query(
        "select coalesce(sum(amount_minor), 0) as b from ledger_entries where account = $1",
        [account],
      )
    ).rows[0].b,
  );
}

/** Money received for an order: cash in, held for the order. */
export async function postPaymentReceived(
  c: Queryable,
  p: { id: string; order_id: string; account_id: string; amount_minor: string; invoice_no: string },
  code: string,
  actorId: string,
) {
  const a = Number(p.amount_minor);
  return post(
    c,
    {
      key: `payment:${p.id}:received`,
      kind: "payment_received",
      memo: `${p.invoice_no} for ${code}`,
      orderId: p.order_id,
      paymentId: p.id,
      actorId,
    },
    [
      { account: acct.cash(p.account_id), amountMinor: a },
      { account: acct.escrow(p.order_id), amountMinor: -a },
    ],
  );
}

/**
 * Work approved: everything held for the order is split by the order's commission rate,
 * mentor share rounded down to whole paisa (the remainder is commission).
 */
export async function postOrderEarned(c: Queryable, o: OrderRow, actorId: string | null) {
  if (!o.mentor_id) throw new ApiError("conflict", "No mentor to pay");
  const held = -(await balance(c, acct.escrow(o.id)));
  if (held <= 0) return null;
  const mentor = mentorShare(held, Number(o.commission_rate));
  return post(
    c,
    {
      key: `order:${o.id}:earned`,
      kind: "order_earned",
      memo: `${o.code} approved`,
      orderId: o.id,
      actorId,
    },
    [
      { account: acct.escrow(o.id), amountMinor: held },
      { account: acct.pending(o.mentor_id), amountMinor: -mentor },
      { account: acct.commission, amountMinor: -(held - mentor) },
    ],
  );
}

/** Order closed: the mentor's pending earnings from it become available for payout. */
export async function postOrderAvailable(c: Queryable, o: OrderRow, actorId: string | null) {
  if (!o.mentor_id) return null;
  const earned = (
    await c.query<{ amount_minor: string }>(
      `select e.amount_minor from ledger_entries e join ledger_transactions t on t.id = e.txn_id
        where t.idempotency_key = $1 and e.account = $2`,
      [`order:${o.id}:earned`, acct.pending(o.mentor_id)],
    )
  ).rows[0];
  if (!earned) return null;
  const m = -Number(earned.amount_minor);
  return post(
    c,
    {
      key: `order:${o.id}:available`,
      kind: "earnings_available",
      memo: `${o.code} closed`,
      orderId: o.id,
      actorId,
    },
    [
      { account: acct.pending(o.mentor_id), amountMinor: m },
      { account: acct.available(o.mentor_id), amountMinor: -m },
    ],
  );
}
