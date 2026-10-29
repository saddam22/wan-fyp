import type { FastifyPluginAsync } from "fastify";
import { normalizeBdMobile, normalizeTrxId } from "@edukhata/contracts";
import { z } from "zod";
import { tx, type Queryable } from "../db.ts";
import type { Deps } from "../deps.ts";
import { audit } from "../lib/audit.ts";
import { ApiError } from "../lib/errors.ts";
import { requireUser } from "../lib/session.ts";
import { acct, balance, post } from "../market/ledger.ts";
import { loadOrder, orderLink } from "../market/orders.ts";
import { paymentRelation, type PaymentRow } from "../market/payments.ts";
import { getSettings } from "../market/settings.ts";

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body ?? {});
  if (!r.success)
    throw new ApiError("validation", r.error.issues[0]?.message, r.error.issues[0]?.path.join("."));
  return r.data;
}
const taka = (minor: number) => `৳${(minor / 100).toLocaleString("en-US")}`;
const uniqueViolation = (e: unknown) => (e as { code?: string }).code === "23505";

interface RefundRow {
  id: string;
  order_id: string;
  amount_minor: string;
  currency: string;
  source: string;
  reason: string;
  to_method: string | null;
  to_number: string | null;
  status: string;
  requested_by: string;
  approved_by: string | null;
  approved_at: Date | null;
  paid_by: string | null;
  paid_at: Date | null;
  reference: string | null;
  created_at: Date;
}
interface PayoutRow {
  id: string;
  mentor_id: string;
  amount_minor: string;
  currency: string;
  method: string;
  account: string;
  account_name: string | null;
  status: string;
  requested_at: Date;
  approved_by: string | null;
  approved_at: Date | null;
  paid_by: string | null;
  paid_at: Date | null;
  reference: string | null;
  note: string | null;
  fee_minor: string;
}

async function namesOf(db: Queryable, ids: (string | null)[]) {
  const rows = (
    await db.query<{ id: string; name: string }>(
      "select id, name from users where id = any($1::uuid[])",
      [ids.filter(Boolean)],
    )
  ).rows;
  return (id: string | null) => rows.find((r) => r.id === id)?.name ?? null;
}

/** Refunds, mentor payouts, reconciliation and invoices. Money out needs two people. */
export const moneyRoutes: FastifyPluginAsync<Deps> = async (
  app,
  { db, config, hub, notifications },
) => {
  const accountants = async () =>
    (
      await db.query<{ user_id: string }>(
        "select distinct user_id from user_roles where role in ('accountant', 'super_admin')",
      )
    ).rows.map((r) => r.user_id);
  const cashAccount = async (c: Queryable, id: string) => {
    const a = (
      await c.query<{ id: string }>("select id from payment_accounts where id::text = $1", [id])
    ).rows[0];
    if (!a)
      throw new ApiError(
        "validation",
        "Choose the account the money was sent from",
        "fromAccountId",
      );
    return a.id;
  };

  // ---- Refunds ------------------------------------------------------------------------

  const refundDto = async (r: RefundRow) => {
    const o = (await loadOrder(db, r.order_id))!;
    const name = await namesOf(db, [r.requested_by, r.approved_by, r.paid_by, o.student_id]);
    return {
      id: r.id,
      orderId: r.order_id,
      orderCode: o.code,
      studentName: name(o.student_id),
      amount: { amountMinor: Number(r.amount_minor), currency: r.currency },
      source: r.source,
      reason: r.reason,
      to: r.to_method ? { method: r.to_method, number: r.to_number } : null,
      status: r.status,
      requestedBy: name(r.requested_by),
      approvedBy: name(r.approved_by),
      paidBy: name(r.paid_by),
      reference: r.reference,
      createdAt: r.created_at.toISOString(),
      paidAt: r.paid_at?.toISOString() ?? null,
    };
  };

  app.get<{ Querystring: { status?: string } }>("/accountant/refunds", async (req) => {
    await requireUser(db, config, hub, req, "/accountant");
    const rows = (
      await db.query<RefundRow>(
        "select * from refunds where ($1::text is null or status = $1) order by created_at desc limit 300",
        [req.query.status ?? null],
      )
    ).rows;
    return Promise.all(rows.map(refundDto));
  });

  /** Second person confirms the refund decision (not the one who asked for it). */
  app.post<{ Params: { id: string } }>("/accountant/refunds/:id/approve", async (req) => {
    const s = await requireUser(db, config, hub, req, "/accountant");
    const r = await tx(db, async (c) => {
      const r = (
        await c.query<RefundRow>("select * from refunds where id::text = $1 for update", [
          req.params.id,
        ])
      ).rows[0];
      if (!r) throw new ApiError("not_found", "Refund not found");
      if (r.status !== "requested") throw new ApiError("conflict", "Already approved");
      if (r.requested_by === s.user.id)
        throw new ApiError("forbidden", "Someone other than the requester must approve it");
      await c.query(
        "update refunds set status = 'approved', approved_by = $2, approved_at = now() where id = $1",
        [r.id, s.user.id],
      );
      await audit(c, {
        actorId: s.user.id,
        action: "refund.approve",
        target: r.id,
        details: { amountMinor: Number(r.amount_minor) },
        ip: req.ip,
      });
      return (await c.query<RefundRow>("select * from refunds where id = $1", [r.id])).rows[0]!;
    });
    return refundDto(r);
  });

  /** The money was sent back: record the account it left and the reference (TrxID). */
  app.post<{ Params: { id: string } }>("/accountant/refunds/:id/paid", async (req) => {
    const s = await requireUser(db, config, hub, req, "/accountant");
    const b = parse(
      z.object({ fromAccountId: z.string(), reference: z.string().trim().min(4).max(40) }),
      req.body,
    );
    const r = await tx(db, async (c) => {
      const r = (
        await c.query<RefundRow>("select * from refunds where id::text = $1 for update", [
          req.params.id,
        ])
      ).rows[0];
      if (!r) throw new ApiError("not_found", "Refund not found");
      if (r.status !== "approved")
        throw new ApiError("conflict", r.status === "paid" ? "Already paid" : "Approve it first");
      const from = await cashAccount(c, b.fromAccountId);
      const ref = normalizeTrxId(b.reference);
      try {
        await c.query("savepoint ref");
        await c.query(
          "update refunds set status = 'paid', paid_by = $2, paid_at = now(), from_account_id = $3, reference = $4 where id = $1",
          [r.id, s.user.id, from, ref],
        );
      } catch (e) {
        if (uniqueViolation(e))
          throw new ApiError("conflict", "This reference was already used", "reference");
        throw e;
      }
      const o = (await loadOrder(c, r.order_id))!;
      await post(
        c,
        {
          key: `refund:${r.id}:paid`,
          kind: "refund_paid",
          memo: `Refund for ${o.code} sent (${ref})`,
          orderId: o.id,
          refundId: r.id,
          actorId: s.user.id,
        },
        [
          { account: acct.refunds, amountMinor: Number(r.amount_minor) },
          { account: acct.cash(from), amountMinor: -Number(r.amount_minor) },
        ],
      );
      // Everything paid for the order went back: its payments are refunded.
      const left = (await import("../market/refunds.ts")).refundable;
      if ((await left(c, o)).total === 0 && ["cancelled", "refunded"].includes(o.status))
        await c.query(
          "update payments set status = 'refunded', updated_at = now() where order_id = $1 and status = 'approved'",
          [o.id],
        );
      await audit(c, {
        actorId: s.user.id,
        action: "refund.paid",
        target: r.id,
        details: { reference: ref },
        ip: req.ip,
      });
      return (await c.query<RefundRow>("select * from refunds where id = $1", [r.id])).rows[0]!;
    });
    const o = (await loadOrder(db, r.order_id))!;
    await notifications.service.notify({
      type: "refund.paid",
      recipientIds: [o.student_id],
      actorId: null,
      payload: { link: orderLink("student", o.id) },
      data: { code: o.code, title: o.title, amount: taka(Number(r.amount_minor)) },
    });
    return refundDto(r);
  });

  // ---- Payouts ------------------------------------------------------------------------

  const payoutDto = async (p: PayoutRow) => {
    const name = await namesOf(db, [p.mentor_id, p.approved_by, p.paid_by]);
    return {
      id: p.id,
      mentorId: p.mentor_id,
      mentorName: name(p.mentor_id) ?? "",
      amount: { amountMinor: Number(p.amount_minor), currency: p.currency },
      // The transfer fee is the mentor's: it is taken from what is sent.
      fee: { amountMinor: Number(p.fee_minor), currency: p.currency },
      received: { amountMinor: Number(p.amount_minor) - Number(p.fee_minor), currency: p.currency },
      method: p.method,
      account: p.account,
      ...(p.account_name ? { accountName: p.account_name } : {}),
      status: p.status,
      requestedAt: p.requested_at.toISOString(),
      ...(p.approved_at ? { decidedAt: p.approved_at.toISOString() } : {}),
      approvedBy: name(p.approved_by),
      paidBy: name(p.paid_by),
      ...(p.reference ? { reference: p.reference } : {}),
      ...(p.note ? { note: p.note } : {}),
    };
  };

  app.get("/mentor/payouts", async (req) => {
    const s = await requireUser(db, config, hub, req, "/mentor");
    const rows = (
      await db.query<PayoutRow>(
        "select * from payouts where mentor_id = $1 order by requested_at desc",
        [s.user.id],
      )
    ).rows;
    const settings = await getSettings(db);
    return {
      minPayoutMinor: settings.min_payout_minor,
      feeEstimatePct: settings.payout_fee_estimate_pct,
      items: await Promise.all(rows.map(payoutDto)),
    };
  });

  /** The mentor asks for (part of) the available balance; it is reserved at once. */
  app.post("/mentor/payouts", async (req, reply) => {
    const s = await requireUser(db, config, hub, req, "/mentor");
    const b = parse(
      z.object({
        amountMinor: z.number().int().min(1),
        method: z.enum(["bkash", "nagad", "rocket", "bank"]),
        account: z.string().trim().min(5).max(60),
        accountName: z.string().trim().max(80).optional(),
      }),
      req.body,
    );
    const account = b.method === "bank" ? b.account : normalizeBdMobile(b.account);
    if (!account)
      throw new ApiError(
        "validation",
        "Enter the mobile number to receive the money (01XXXXXXXXX)",
        "account",
      );
    const p = await tx(db, async (c) => {
      await c.query("select pg_advisory_xact_lock(4246, hashtext($1))", [s.user.id]);
      const settings = await getSettings(c);
      if (b.amountMinor < settings.min_payout_minor)
        throw new ApiError(
          "validation",
          `The smallest payout is ${taka(settings.min_payout_minor)}`,
          "amountMinor",
        );
      const available = -(await balance(c, acct.available(s.user.id)));
      if (b.amountMinor > available)
        throw new ApiError(
          "validation",
          `You can withdraw up to ${taka(available)}`,
          "amountMinor",
        );
      let row: PayoutRow;
      try {
        row = (
          await c.query<PayoutRow>(
            "insert into payouts (mentor_id, amount_minor, method, account, account_name) values ($1, $2, $3, $4, $5) returning *",
            [s.user.id, b.amountMinor, b.method, account, b.accountName ?? null],
          )
        ).rows[0]!;
      } catch (e) {
        if (uniqueViolation(e)) throw new ApiError("conflict", "You already have a payout waiting");
        throw e;
      }
      await post(
        c,
        {
          key: `payout:${row.id}:requested`,
          kind: "payout_requested",
          memo: `Payout to ${account}`,
          payoutId: row.id,
          actorId: s.user.id,
        },
        [
          { account: acct.available(s.user.id), amountMinor: b.amountMinor },
          { account: acct.payouts, amountMinor: -b.amountMinor },
        ],
      );
      return row;
    });
    await notifications.service.notify({
      type: "payout.requested",
      recipientIds: await accountants(),
      actorId: null,
      payload: { link: "/accountant/payouts" },
      data: { code: "Payout", title: s.user.name, amount: taka(b.amountMinor) },
    });
    return reply.code(201).send(await payoutDto(p));
  });

  app.get<{ Querystring: { status?: string } }>("/accountant/payouts", async (req) => {
    await requireUser(db, config, hub, req, "/accountant");
    const rows = (
      await db.query<PayoutRow>(
        "select * from payouts where ($1::text is null or status = $1) order by requested_at desc limit 300",
        [req.query.status ?? null],
      )
    ).rows;
    return Promise.all(rows.map(payoutDto));
  });

  const payoutStep = async (
    id: string,
    staffId: string,
    fn: (c: Queryable, p: PayoutRow) => Promise<{ type: string; note?: string }>,
  ) => {
    const r = await tx(db, async (c) => {
      const p = (
        await c.query<PayoutRow>("select * from payouts where id::text = $1 for update", [id])
      ).rows[0];
      if (!p) throw new ApiError("not_found", "Payout not found");
      if (p.mentor_id === staffId)
        throw new ApiError("forbidden", "You can't handle your own payout");
      const n = await fn(c, p);
      return {
        p: (await c.query<PayoutRow>("select * from payouts where id = $1", [p.id])).rows[0]!,
        n,
      };
    });
    await notifications.service.notify({
      type: r.n.type,
      recipientIds: [r.p.mentor_id],
      actorId: null,
      payload: { link: "/mentor/payouts" },
      data: {
        code: "Payout",
        title: "",
        // What reaches the mentor (after the transfer fee, which is theirs).
        amount: taka(Number(r.p.amount_minor) - Number(r.p.fee_minor)),
        note: r.n.note ?? "",
      },
    });
    return payoutDto(r.p);
  };

  app.post<{ Params: { id: string } }>("/accountant/payouts/:id/approve", async (req) => {
    const s = await requireUser(db, config, hub, req, "/accountant");
    return payoutStep(req.params.id, s.user.id, async (c, p) => {
      if (p.status !== "requested")
        throw new ApiError("conflict", "This payout was already decided");
      await c.query(
        "update payouts set status = 'approved', approved_by = $2, approved_at = now() where id = $1",
        [p.id, s.user.id],
      );
      await audit(c, {
        actorId: s.user.id,
        action: "payout.approve",
        target: p.id,
        details: { amountMinor: Number(p.amount_minor) },
        ip: req.ip,
      });
      return { type: "payout.approved" };
    });
  });

  app.post<{ Params: { id: string } }>("/accountant/payouts/:id/reject", async (req) => {
    const s = await requireUser(db, config, hub, req, "/accountant");
    const b = parse(z.object({ note: z.string().trim().min(3).max(300) }), req.body);
    return payoutStep(req.params.id, s.user.id, async (c, p) => {
      if (!["requested", "approved"].includes(p.status))
        throw new ApiError("conflict", "This payout can't be rejected now");
      await c.query("update payouts set status = 'rejected', note = $2 where id = $1", [
        p.id,
        b.note,
      ]);
      // The reserved amount goes back to the mentor's available balance.
      await post(
        c,
        {
          key: `payout:${p.id}:rejected`,
          kind: "payout_rejected",
          memo: `Payout rejected: ${b.note}`,
          payoutId: p.id,
          actorId: s.user.id,
        },
        [
          { account: acct.payouts, amountMinor: Number(p.amount_minor) },
          { account: acct.available(p.mentor_id), amountMinor: -Number(p.amount_minor) },
        ],
      );
      await audit(c, {
        actorId: s.user.id,
        action: "payout.reject",
        target: p.id,
        details: { note: b.note },
        ip: req.ip,
      });
      return { type: "payout.rejected", note: b.note };
    });
  });

  /** Sent: by someone other than the approver (maker-checker), with the transfer's TrxID. */
  app.post<{ Params: { id: string } }>("/accountant/payouts/:id/paid", async (req) => {
    const s = await requireUser(db, config, hub, req, "/accountant");
    const b = parse(
      z.object({
        fromAccountId: z.string(),
        reference: z.string().trim().min(4).max(40),
        /** The provider's transfer fee, paid by the mentor (deducted from what is sent). */
        feeMinor: z.number().int().min(0).default(0),
      }),
      req.body,
    );
    return payoutStep(req.params.id, s.user.id, async (c, p) => {
      if (p.status !== "approved")
        throw new ApiError("conflict", p.status === "paid" ? "Already paid" : "Approve it first");
      if (p.approved_by === s.user.id)
        throw new ApiError("forbidden", "A second person must send the payout");
      const from = await cashAccount(c, b.fromAccountId);
      const ref = normalizeTrxId(b.reference);
      const max = Math.floor(Number(p.amount_minor) * (await getSettings(c)).payout_fee_max_pct);
      if (b.feeMinor > max)
        throw new ApiError("validation", `The fee can be at most ${taka(max)}`, "feeMinor");
      try {
        await c.query("savepoint ref");
        await c.query(
          "update payouts set status = 'paid', paid_by = $2, paid_at = now(), from_account_id = $3, reference = $4, fee_minor = $5 where id = $1",
          [p.id, s.user.id, from, ref, b.feeMinor],
        );
      } catch (e) {
        if (uniqueViolation(e))
          throw new ApiError("conflict", "This reference was already used", "reference");
        throw e;
      }
      await post(
        c,
        {
          key: `payout:${p.id}:paid`,
          kind: "payout_paid",
          // The whole amount leaves the account: sent to the mentor + the provider's fee.
          memo: b.feeMinor
            ? `Payout sent (${ref}), ${taka(Number(p.amount_minor) - b.feeMinor)} + fee ${taka(b.feeMinor)}`
            : `Payout sent (${ref})`,
          payoutId: p.id,
          actorId: s.user.id,
        },
        [
          { account: acct.payouts, amountMinor: Number(p.amount_minor) },
          { account: acct.cash(from), amountMinor: -Number(p.amount_minor) },
        ],
      );
      await audit(c, {
        actorId: s.user.id,
        action: "payout.paid",
        target: p.id,
        details: { reference: ref },
        ip: req.ip,
      });
      return { type: "payout.paid" };
    });
  });

  // ---- Reconciliation -----------------------------------------------------------------

  /** Per receiving account: what the statement should show, and payments to tick off. */
  app.get<{ Querystring: { from?: string; to?: string } }>(
    "/accountant/reconciliation",
    async (req) => {
      await requireUser(db, config, hub, req, "/accountant");
      const from = req.query.from
        ? new Date(req.query.from)
        : new Date(Date.now() - 30 * 24 * 3600_000);
      const to = req.query.to ? new Date(req.query.to) : new Date();
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()))
        throw new ApiError("validation", "Invalid dates");
      const accounts = (
        await db.query<{ id: string; name: string; number: string }>(
          "select id, name, number from payment_accounts order by sort, name",
        )
      ).rows;
      const flows = (
        await db.query<{ account: string; kind: string; total: string }>(
          `select e.account, t.kind, sum(e.amount_minor) as total from ledger_entries e join ledger_transactions t on t.id = e.txn_id
          where e.account like 'cash:%' and e.created_at >= $1 and e.created_at < $2 group by e.account, t.kind`,
          [from, to],
        )
      ).rows;
      const open = (
        await db.query<PaymentRow & { code: string }>(
          `select p.*, o.code from payments p join orders o on o.id = p.order_id
          where p.status in ('approved', 'refunded') and p.reconciled_at is null and p.decided_at >= $1 and p.decided_at < $2
          order by p.decided_at`,
          [from, to],
        )
      ).rows;
      return {
        from: from.toISOString(),
        to: to.toISOString(),
        accounts: await Promise.all(
          accounts.map(async (a) => {
            const f = (kind: string) =>
              Number(
                flows.find((x) => x.account === `cash:${a.id}` && x.kind === kind)?.total ?? 0,
              );
            return {
              id: a.id,
              name: `${a.name} (${a.number})`,
              receivedMinor: f("payment_received"),
              refundsSentMinor: -f("refund_paid"),
              payoutsSentMinor: -f("payout_paid"),
              balanceMinor: await balance(db, acct.cash(a.id)),
            };
          }),
        ),
        unreconciled: open.map((p) => ({
          id: p.id,
          invoiceNo: p.invoice_no,
          orderCode: p.code,
          amount: { amountMinor: Number(p.amount_minor), currency: p.currency },
          method: p.method,
          sender: p.sender,
          trxId: p.trx_id,
          decidedAt: p.decided_at?.toISOString() ?? null,
        })),
      };
    },
  );

  app.post<{ Params: { id: string } }>("/accountant/payments/:id/reconcile", async (req) => {
    const s = await requireUser(db, config, hub, req, "/accountant");
    const r = await db.query(
      "update payments set reconciled_at = now(), reconciled_by = $2 where id::text = $1 and status in ('approved', 'refunded') and reconciled_at is null",
      [req.params.id, s.user.id],
    );
    if (!r.rowCount) throw new ApiError("conflict", "Not an approved, unreconciled payment");
    await audit(db, {
      actorId: s.user.id,
      action: "payment.reconcile",
      target: req.params.id,
      ip: req.ip,
    });
    return { ok: true };
  });

  // ---- Invoices -----------------------------------------------------------------------

  /** Invoice of an approved payment: for the payer, the student, permitted guardians, staff. */
  app.get<{ Params: { id: string } }>("/payments/:id/invoice", async (req) => {
    const s = await requireUser(db, config, hub, req);
    const p = (
      await db.query<PaymentRow>("select * from payments where id::text = $1", [req.params.id])
    ).rows[0];
    const o = p ? await loadOrder(db, p.order_id) : null;
    const rel = o ? await paymentRelation(db, o, s) : null;
    if (!p || !o || !rel || !["approved", "refunded"].includes(p.status))
      throw new ApiError("not_found", "Invoice not found");
    const name = await namesOf(db, [o.student_id, p.payer_id]);
    return {
      invoiceNo: p.invoice_no,
      issuedAt: (p.decided_at ?? p.created_at).toISOString(),
      seller: { name: "EduKhata", address: "WANBAHJAHKAS ecosystem", website: config.webUrl },
      billedTo: { name: name(o.student_id), paidBy: name(p.payer_id) },
      items: [
        {
          description:
            p.purpose === "order"
              ? `${o.code} · ${o.title} (${o.pages} pages)`
              : `${o.code} · paid revision ${p.revision_n}`,
          amount: { amountMinor: Number(p.amount_minor), currency: p.currency },
        },
      ],
      total: { amountMinor: Number(p.amount_minor), currency: p.currency },
      // No VAT is applied (owner decision Q19).
      tax: { amountMinor: 0, currency: p.currency, note: "No VAT applied" },
      payment: { method: p.method, reference: p.trx_id, status: p.status },
    };
  });
};
