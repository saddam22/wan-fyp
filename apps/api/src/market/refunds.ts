import type { Db, Queryable } from "../db.ts";
import type { Deps } from "../deps.ts";
import { ApiError } from "../lib/errors.ts";
import { acct, balance, orderBalance, post } from "./ledger.ts";
import type { OrderRow } from "./orders.ts";

/** Money of an order that can still go back to the student: held, then earned-but-pending. */
export async function refundable(c: Queryable, o: OrderRow) {
  const held = -(await balance(c, acct.escrow(o.id)));
  const pending = o.mentor_id ? -(await orderBalance(c, o.id, acct.pending(o.mentor_id))) : 0;
  const commission = -(await orderBalance(c, o.id, acct.commission));
  return { held, pending, commission, total: held + pending + commission };
}

/**
 * Records a refund decision (inside the caller's transaction): the amount moves to
 * "refunds payable" — first from money still held for the order, the rest back from the
 * mentor's pending share and the commission in the order's proportion. Paid out later by
 * an accountant after a second person approves it. Returns null when nothing was paid.
 */
export async function createRefundTx(
  c: Queryable,
  o: OrderRow,
  r: {
    amountMinor?: number;
    source: "cancellation" | "dispute";
    reason: string;
    requestedBy: string;
  },
): Promise<string | null> {
  const avail = await refundable(c, o);
  // Nothing was paid (or everything was already released): only the decision is recorded.
  if (avail.total <= 0) return null;
  const amount = r.amountMinor ?? avail.total;
  if (amount <= 0) return null;
  if (amount > avail.total)
    throw new ApiError(
      "validation",
      "The refund is more than what was paid and not yet released",
      "refundMinor",
    );
  const fromHeld = Math.min(avail.held, amount);
  const rest = amount - fromHeld;
  const rate = Number(o.commission_rate);
  const fromMentor = Math.min(avail.pending, Math.floor(rest * (1 - rate)));
  const fromCommission = rest - fromMentor;
  if (fromCommission > avail.commission)
    throw new ApiError("server", "Refund split exceeds the commission");
  // Send it back where it came from: the latest approved payment's sender.
  const to = (
    await c.query<{ method: string; sender: string }>(
      "select method, sender from payments where order_id = $1 and status = 'approved' order by decided_at desc limit 1",
      [o.id],
    )
  ).rows[0];
  const id = (
    await c.query<{ id: string }>(
      `insert into refunds (order_id, amount_minor, currency, source, reason, to_method, to_number, requested_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
      [
        o.id,
        amount,
        o.currency,
        r.source,
        r.reason,
        to?.method ?? null,
        to?.sender ?? null,
        r.requestedBy,
      ],
    )
  ).rows[0]!.id;
  await post(
    c,
    {
      key: `refund:${id}:decided`,
      kind: "refund_decided",
      memo: `Refund for ${o.code} (${r.source})`,
      orderId: o.id,
      refundId: id,
      actorId: r.requestedBy,
    },
    [
      { account: acct.escrow(o.id), amountMinor: fromHeld },
      ...(o.mentor_id ? [{ account: acct.pending(o.mentor_id), amountMinor: fromMentor }] : []),
      { account: acct.commission, amountMinor: fromCommission },
      { account: acct.refunds, amountMinor: -amount },
    ],
  );
  return id;
}

/** Tells the accounts team a refund waits for a second person's approval. */
export async function notifyRefundDue(db: Db, notifications: Deps["notifications"], o: OrderRow) {
  const ids = (
    await db.query<{ user_id: string }>(
      "select distinct user_id from user_roles where role in ('accountant', 'super_admin')",
    )
  ).rows.map((r) => r.user_id);
  await notifications.service
    .notify({
      type: "refund.decided",
      recipientIds: ids,
      actorId: null,
      payload: { link: "/accountant/refunds" },
      data: { code: o.code, title: o.title },
    })
    .catch(() => undefined);
}
