import { isValidTrxId, normalizeBdMobile, normalizeTrxId } from "@edukhata/contracts";
import type { Queryable } from "../db.ts";
import { ApiError } from "../lib/errors.ts";
import type { SessionCtx } from "../lib/session.ts";
import { loadOrder, STAFF, type OrderRow } from "./orders.ts";

/** People who verify incoming money (the accountant area). */
export const VERIFIERS = ["accountant", "super_admin"] as const;
export const isVerifier = (s: SessionCtx) =>
  s.roles.some((r) => (VERIFIERS as readonly string[]).includes(r));

export interface PaymentRow {
  id: string;
  invoice_no: string;
  order_id: string;
  purpose: "order" | "revision";
  revision_n: number | null;
  amount_minor: string;
  currency: string;
  status: string;
  payer_id: string | null;
  account_id: string | null;
  method: string | null;
  channel: string | null;
  sender: string | null;
  trx_id: string | null;
  proof_key: string | null;
  submitted_at: Date | null;
  decided_at: Date | null;
  decided_by: string | null;
  note: string | null;
  reconciled_at: Date | null;
  created_at: Date;
}

export type PaymentRelation = "student" | "guardian" | "staff";

/**
 * Who may see (and pay) a payment: the student, a guardian with "view payments" (and
 * "pay on behalf" to submit), staff. Everyone else gets 404.
 */
export async function paymentRelation(
  db: Queryable,
  o: OrderRow,
  s: SessionCtx,
): Promise<{ rel: PaymentRelation; canPay: boolean } | null> {
  if (o.student_id === s.user.id) return { rel: "student", canPay: true };
  if (s.roles.some((r) => STAFF.includes(r))) return { rel: "staff", canPay: false };
  if (s.roles.includes("guardian")) {
    const g = (
      await db.query<{ view_payments: boolean; pay_on_behalf: boolean }>(
        "select view_payments, pay_on_behalf from guardian_links where guardian_id = $1 and student_id = $2",
        [s.user.id, o.student_id],
      )
    ).rows[0];
    if (g?.view_payments || g?.pay_on_behalf) return { rel: "guardian", canPay: g.pay_on_behalf };
  }
  return null;
}

/**
 * The payment the order needs now (created on first request): the order price while the
 * order waits for payment, or the fee of a paid revision waiting for payment. Null if
 * nothing is due (the existing payments are listed separately).
 */
export async function duePayment(c: Queryable, o: OrderRow): Promise<PaymentRow | null> {
  let purpose: "order" | "revision";
  let n: number | null = null;
  let amount: number;
  if (o.status === "awaiting_payment" || o.status === "payment_review") {
    purpose = "order";
    amount = Number(o.price_minor);
  } else {
    const r = (
      await c.query<{ n: number; fee_minor: string }>(
        "select n, fee_minor from order_revisions where order_id = $1 and payment_status = 'due' order by n desc limit 1",
        [o.id],
      )
    ).rows[0];
    if (!r) return null;
    purpose = "revision";
    n = r.n;
    amount = Number(r.fee_minor);
  }
  const live = (
    await c.query<PaymentRow>(
      `select * from payments where order_id = $1 and purpose = $2 and coalesce(revision_n, 0) = $3
         and status in ('pending', 'submitted', 'rejected', 'approved')`,
      [o.id, purpose, n ?? 0],
    )
  ).rows[0];
  if (live) return live;
  return (
    (
      await c.query<PaymentRow>(
        `insert into payments (order_id, purpose, revision_n, amount_minor, currency) values ($1, $2, $3, $4, $5)
       on conflict do nothing returning *`,
        [o.id, purpose, n, amount, o.currency],
      )
    ).rows[0] ?? (await duePayment(c, o))
  );
}

/** ICTSpark's checks: a BD mobile sender + 6–20 character TrxID, or a bank sender + reference. */
export function validateSubmission(
  method: string,
  senderRaw: string,
  trxRaw: string,
): { sender: string; trxId: string } {
  if (method === "bank") {
    const sender = senderRaw.trim().replace(/[<>]/g, "").slice(0, 60);
    if (sender.length < 3)
      throw new ApiError("validation", "Write the account name or bank you sent from", "sender");
    if (!isValidTrxId(trxRaw, "bank"))
      throw new ApiError("validation", "Enter the bank's reference number", "trxId");
    return { sender, trxId: normalizeTrxId(trxRaw) };
  }
  const sender = normalizeBdMobile(senderRaw);
  if (!sender)
    throw new ApiError("validation", "Enter the number you sent from (01XXXXXXXXX)", "sender");
  if (!isValidTrxId(trxRaw, method as "bkash"))
    throw new ApiError("validation", "Enter the TrxID exactly as in the SMS", "trxId");
  return { sender, trxId: normalizeTrxId(trxRaw) };
}

export async function paymentDto(db: Queryable, p: PaymentRow, rel: PaymentRelation) {
  const o = (await loadOrder(db, p.order_id))!;
  const people = (
    await db.query<{ id: string; name: string }>(
      "select id, name from users where id = any($1::uuid[])",
      [[p.payer_id, p.decided_by].filter(Boolean)],
    )
  ).rows;
  const name = (id: string | null) => people.find((x) => x.id === id)?.name;
  return {
    id: p.id,
    invoiceNo: p.invoice_no,
    orderId: p.order_id,
    orderCode: o.code,
    orderTitle: o.title,
    purpose: p.purpose,
    ...(p.revision_n ? { revisionN: p.revision_n } : {}),
    payerName: name(p.payer_id) ?? "",
    amount: { amountMinor: Number(p.amount_minor), currency: p.currency },
    ...(p.method ? { method: p.method, channel: p.channel } : {}),
    ...(p.sender ? { sender: p.sender } : {}),
    ...(p.trx_id ? { trxId: p.trx_id } : {}),
    hasProof: !!p.proof_key,
    status: p.status,
    createdAt: p.created_at.toISOString(),
    ...(p.submitted_at ? { submittedAt: p.submitted_at.toISOString() } : {}),
    ...(p.decided_at ? { decidedAt: p.decided_at.toISOString() } : {}),
    // Only staff see who decided; everyone sees the reason of a rejection.
    ...(rel === "staff" && p.decided_by ? { decidedBy: name(p.decided_by) ?? "" } : {}),
    ...(p.note ? { note: p.note } : {}),
    ...(rel === "staff" && p.reconciled_at ? { reconciledAt: p.reconciled_at.toISOString() } : {}),
  };
}
