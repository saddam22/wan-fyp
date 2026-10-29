import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import sharp from "sharp";
import { z } from "zod";
import { verifyContent } from "@chat-module/server";
import { tx } from "../db.ts";
import type { Deps } from "../deps.ts";
import { audit } from "../lib/audit.ts";
import { diskStorage } from "../lib/disk-storage.ts";
import { ApiError } from "../lib/errors.ts";
import { requireUser } from "../lib/session.ts";
import { activateRevisionTx } from "../market/delivery.ts";
import { addEvent, loadOrder, orderLink, transition } from "../market/orders.ts";
import {
  duePayment,
  isVerifier,
  paymentDto,
  paymentRelation,
  validateSubmission,
  type PaymentRow,
} from "../market/payments.ts";

const PROOF_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const PROOF_MAX = 5 * 1024 * 1024;

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body ?? {});
  if (!r.success)
    throw new ApiError("validation", r.error.issues[0]?.message, r.error.issues[0]?.path.join("."));
  return r.data;
}

const accountBody = z.object({
  method: z.enum(["bkash", "nagad", "rocket", "bank"]),
  channel: z.enum(["personal", "agent", "merchant", "bank"]),
  name: z.string().trim().min(2).max(60),
  number: z.string().trim().min(5).max(60),
  accountName: z.string().trim().max(80).optional(),
  branch: z.string().trim().max(80).optional(),
  routing: z.string().trim().max(20).optional(),
  instructions: z.array(z.string().trim().min(1).max(200)).max(6).default([]),
  enabled: z.boolean().default(true),
  sort: z.number().int().min(0).max(100).default(0),
});

interface AccountRow {
  id: string;
  method: string;
  channel: string;
  name: string;
  number: string;
  account_name: string | null;
  branch: string | null;
  routing: string | null;
  instructions: string[];
  enabled: boolean;
  sort: number;
}
const accountDto = (a: AccountRow) => ({
  key: a.id,
  method: a.method,
  channel: a.channel,
  name: a.name,
  number: a.number,
  ...(a.account_name ? { accountName: a.account_name } : {}),
  ...(a.branch ? { branch: a.branch } : {}),
  ...(a.routing ? { routing: a.routing } : {}),
  instructions: a.instructions,
  enabled: a.enabled,
});

/**
 * Manual payments (ICTSpark's flow): send money to an EduKhata account, submit the TrxID
 * (and optionally a screenshot), an accountant checks it against the statement.
 */
export const paymentRoutes: FastifyPluginAsync<Deps> = async (
  app,
  { db, config, hub, notifications, matching },
) => {
  const storage = diskStorage(
    config.orderFilesDir,
    config.chatSecret,
    "/api/payment-files",
    "payment",
  );
  const verifiers = async () =>
    (
      await db.query<{ user_id: string }>(
        "select distinct user_id from user_roles where role in ('accountant', 'super_admin')",
      )
    ).rows.map((r) => r.user_id);

  // ---- Receiving accounts -------------------------------------------------------------

  app.get("/payments/accounts", async (req) => {
    await requireUser(db, config, hub, req);
    return (
      await db.query<AccountRow>("select * from payment_accounts where enabled order by sort, name")
    ).rows.map(accountDto);
  });

  app.get("/accountant/payment-accounts", async (req) => {
    await requireUser(db, config, hub, req, "/accountant");
    return (
      await db.query<AccountRow>("select * from payment_accounts order by sort, name")
    ).rows.map(accountDto);
  });

  app.post("/accountant/payment-accounts", async (req, reply) => {
    const s = await requireUser(db, config, hub, req, "/accountant");
    const b = parse(accountBody, req.body);
    if ((b.method === "bank") !== (b.channel === "bank"))
      throw new ApiError("validation", "Bank accounts use the bank channel", "channel");
    const row = (
      await db.query<AccountRow>(
        `insert into payment_accounts (method, channel, name, number, account_name, branch, routing, instructions, enabled, sort)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning *`,
        [
          b.method,
          b.channel,
          b.name,
          b.number,
          b.accountName ?? null,
          b.branch ?? null,
          b.routing ?? null,
          b.instructions,
          b.enabled,
          b.sort,
        ],
      )
    ).rows[0]!;
    await audit(db, {
      actorId: s.user.id,
      action: "payment_account.create",
      target: row.id,
      details: b,
      ip: req.ip,
    });
    return reply.code(201).send(accountDto(row));
  });

  app.put<{ Params: { id: string } }>("/accountant/payment-accounts/:id", async (req) => {
    const s = await requireUser(db, config, hub, req, "/accountant");
    const b = parse(accountBody, req.body);
    if ((b.method === "bank") !== (b.channel === "bank"))
      throw new ApiError("validation", "Bank accounts use the bank channel", "channel");
    const row = (
      await db.query<AccountRow>(
        `update payment_accounts set method = $2, channel = $3, name = $4, number = $5, account_name = $6, branch = $7, routing = $8,
           instructions = $9, enabled = $10, sort = $11, updated_at = now() where id::text = $1 returning *`,
        [
          req.params.id,
          b.method,
          b.channel,
          b.name,
          b.number,
          b.accountName ?? null,
          b.branch ?? null,
          b.routing ?? null,
          b.instructions,
          b.enabled,
          b.sort,
        ],
      )
    ).rows[0];
    if (!row) throw new ApiError("not_found");
    await audit(db, {
      actorId: s.user.id,
      action: "payment_account.update",
      target: row.id,
      details: b,
      ip: req.ip,
    });
    return accountDto(row);
  });

  // ---- Paying -------------------------------------------------------------------------

  /** What the order needs paid now (if anything) and its earlier payments. */
  app.get<{ Params: { id: string } }>("/orders/:id/payment", async (req) => {
    const s = await requireUser(db, config, hub, req);
    const o = await loadOrder(db, req.params.id);
    const r = o ? await paymentRelation(db, o, s) : null;
    if (!o || !r) throw new ApiError("not_found", "Order not found");
    const due = r.canPay || r.rel === "staff" ? await tx(db, (c) => duePayment(c, o)) : null;
    const all = (
      await db.query<PaymentRow>("select * from payments where order_id = $1 order by created_at", [
        o.id,
      ])
    ).rows;
    return {
      due: due ? await paymentDto(db, due, r.rel) : null,
      canPay: r.canPay,
      payments: await Promise.all(all.map((p) => paymentDto(db, p, r.rel))),
    };
  });

  /** Optional proof (screenshot or PDF), uploaded before submitting. */
  app.post<{ Params: { id: string } }>("/payments/:id/proof", async (req) => {
    const s = await requireUser(db, config, hub, req);
    const b = parse(
      z.object({
        contentType: z.enum(PROOF_TYPES as [string, ...string[]]),
        byteSize: z.number().int().min(1).max(PROOF_MAX),
      }),
      req.body,
    );
    const p = (
      await db.query<PaymentRow>("select * from payments where id::text = $1", [req.params.id])
    ).rows[0];
    const o = p ? await loadOrder(db, p.order_id) : null;
    const r = o ? await paymentRelation(db, o, s) : null;
    if (!p || !r?.canPay) throw new ApiError("not_found", "Payment not found");
    const key = `payments/${p.id}/${randomUUID()}`;
    const put = await storage.presignPut(key, b.contentType, b.byteSize);
    return { proofKey: key, uploadUrl: put.url, headers: put.headers };
  });

  await app.register(async (scope) => {
    scope.removeAllContentTypeParsers();
    scope.addContentTypeParser("*", { parseAs: "buffer", bodyLimit: PROOF_MAX }, (_r, body, done) =>
      done(null, body),
    );
    scope.put<{
      Params: { "*": string };
      Querystring: { exp?: string; size?: string; sig?: string };
    }>("/payment-files/*", { bodyLimit: PROOF_MAX }, async (req, reply) => {
      const key = req.params["*"];
      const { exp, size, sig } = req.query;
      const body = req.body as Buffer | undefined;
      const type = req.headers["content-type"] ?? "";
      if (
        !body ||
        !exp ||
        !size ||
        !sig ||
        !storage.verifyUpload(key, Number(exp), Number(size), type, sig) ||
        body.length !== Number(size)
      )
        throw new ApiError("forbidden", "Invalid upload URL");
      if (!verifyContent(type, body).ok)
        throw new ApiError("validation", "The file's content doesn't match its type");
      // Screenshots lose their EXIF data; PDFs are stored as they are.
      await storage.put(
        key,
        type.startsWith("image/")
          ? await sharp(body).rotate().webp({ quality: 85 }).toBuffer()
          : body,
      );
      return reply.code(200).send();
    });
  });

  const submitBody = z.object({
    accountId: z.uuid(),
    sender: z.string().max(80),
    trxId: z.string().max(40),
    proofKey: z.string().max(200).optional(),
  });

  /** Submit (or resubmit after a rejection) the TrxID for a payment. */
  app.post<{ Params: { id: string } }>(
    "/payments/:id/submit",
    {
      config: {
        // ICTSpark allowed 10 tries per 10 minutes; here per signed-in person.
        rateLimit: {
          max: 10,
          timeWindow: "10 minutes",
          keyGenerator: (req) => req.cookies.ek_sid ?? req.ip,
        },
      },
    },
    async (req) => {
      const s = await requireUser(db, config, hub, req);
      const b = parse(submitBody, req.body);
      const result = await tx(db, async (c) => {
        const p0 = (
          await c.query<PaymentRow>("select * from payments where id::text = $1", [req.params.id])
        ).rows[0];
        const o = p0 ? await loadOrder(c, p0.order_id, true) : null;
        const r = o ? await paymentRelation(c, o, s) : null;
        if (!p0 || !o || !r?.canPay) throw new ApiError("not_found", "Payment not found");
        const p = (
          await c.query<PaymentRow>("select * from payments where id = $1 for update", [p0.id])
        ).rows[0]!;
        if (p.status === "submitted")
          throw new ApiError("conflict", "Already submitted — an accountant is checking it");
        if (p.status !== "pending" && p.status !== "rejected")
          throw new ApiError("conflict", "This payment can't take a submission now");
        const acc = (
          await c.query<AccountRow>("select * from payment_accounts where id = $1 and enabled", [
            b.accountId,
          ])
        ).rows[0];
        if (!acc)
          throw new ApiError("validation", "Choose the account you sent money to", "accountId");
        const { sender, trxId } = validateSubmission(acc.method, b.sender, b.trxId);
        if (b.proofKey) {
          if (!b.proofKey.startsWith(`payments/${p.id}/`) || !(await storage.get(b.proofKey)))
            throw new ApiError("validation", "Upload the proof again", "proofKey");
        }
        try {
          await c.query("savepoint trx");
          await c.query(
            `update payments set status = 'submitted', payer_id = $2, account_id = $3, method = $4, channel = $5, sender = $6, trx_id = $7,
               proof_key = $8, submitted_at = now(), decided_at = null, decided_by = null, note = null, updated_at = now() where id = $1`,
            [p.id, s.user.id, acc.id, acc.method, acc.channel, sender, trxId, b.proofKey ?? null],
          );
        } catch (e) {
          if ((e as { code?: string }).code === "23505") {
            await c.query("rollback to savepoint trx");
            throw new ApiError(
              "conflict",
              "This TrxID was already used for another payment",
              "trxId",
            );
          }
          throw e;
        }
        await c.query(
          "insert into payment_attempts (payment_id, payer_id, account_id, sender, trx_id, proof_key) values ($1, $2, $3, $4, $5, $6)",
          [p.id, s.user.id, acc.id, sender, trxId, b.proofKey ?? null],
        );
        if (p.purpose === "order" && o.status === "awaiting_payment")
          await transition(c, o, ["awaiting_payment"], "payment_review");
        await addEvent(c, o.id, {
          kind: "payment_submitted",
          status: p.purpose === "order" ? "payment_review" : o.status,
          actorId: s.user.id,
          note: `Payment submitted (${acc.name})`,
        });
        return {
          p: (await c.query<PaymentRow>("select * from payments where id = $1", [p.id])).rows[0]!,
          o,
        };
      });
      await notifications.service.notify({
        type: "payment.submitted",
        recipientIds: await verifiers(),
        actorId: null,
        payload: { link: "/accountant/payments" },
        data: {
          code: result.o.code,
          title: result.o.title,
          amount: `৳${Number(result.p.amount_minor) / 100}`,
        },
      });
      return paymentDto(db, result.p, "student");
    },
  );

  // ---- Verification (accountant) ------------------------------------------------------

  app.get<{ Querystring: { status?: string } }>("/accountant/payments", async (req) => {
    await requireUser(db, config, hub, req, "/accountant");
    const rows = (
      await db.query<PaymentRow>(
        "select * from payments where ($1::text is null or status = $1) and status <> 'pending' order by coalesce(submitted_at, created_at) desc limit 300",
        [req.query.status ?? null],
      )
    ).rows;
    return Promise.all(rows.map((p) => paymentDto(db, p, "staff")));
  });

  app.get<{ Params: { id: string } }>("/payments/:id/proof", async (req, reply) => {
    const s = await requireUser(db, config, hub, req);
    const p = (
      await db.query<PaymentRow>("select * from payments where id::text = $1", [req.params.id])
    ).rows[0];
    const o = p ? await loadOrder(db, p.order_id) : null;
    const allowed = !!o && (isVerifier(s) || (await paymentRelation(db, o, s))?.canPay);
    if (!p?.proof_key || !allowed) throw new ApiError("not_found", "No proof");
    const body = await storage.get(p.proof_key);
    if (!body) throw new ApiError("not_found", "No proof");
    const pdf = body.subarray(0, 5).toString() === "%PDF-";
    return reply
      .header("content-type", pdf ? "application/pdf" : "image/webp")
      .header("x-content-type-options", "nosniff")
      .header("content-security-policy", "default-src 'none'; sandbox")
      .header("cache-control", "private, no-store")
      .send(body);
  });

  /**
   * Approve (money arrived: the order starts matching, or the paid revision goes to the
   * mentor) or reject with a reason (the payer may submit again). One transaction.
   */
  app.post<{ Params: { id: string } }>("/accountant/payments/:id/decision", async (req) => {
    const s = await requireUser(db, config, hub, req, "/accountant");
    const b = parse(
      z.object({ approve: z.boolean(), note: z.string().trim().max(300).default("") }),
      req.body,
    );
    if (!b.approve && b.note.length < 3)
      throw new ApiError("validation", "Say why it doesn't match", "note");
    const result = await tx(db, async (c) => {
      const p0 = (
        await c.query<PaymentRow>("select * from payments where id::text = $1", [req.params.id])
      ).rows[0];
      if (!p0) throw new ApiError("not_found", "Payment not found");
      // Same lock order as everywhere: order → payment.
      const o = (await loadOrder(c, p0.order_id, true))!;
      const p = (
        await c.query<PaymentRow>("select * from payments where id = $1 for update", [p0.id])
      ).rows[0]!;
      if (p.status !== "submitted")
        throw new ApiError("conflict", "This payment was already decided");
      // Nobody verifies money they paid or that pays for their own order.
      if (p.payer_id === s.user.id || o.student_id === s.user.id)
        throw new ApiError("forbidden", "Someone else must check your own payment");
      await c.query(
        `update payments set status = $2, decided_at = now(), decided_by = $3, note = $4, updated_at = now() where id = $1`,
        [p.id, b.approve ? "approved" : "rejected", s.user.id, b.note || null],
      );
      await c.query(
        "update payment_attempts set decision = $2, decided_by = $3, decided_at = now(), note = $4 where id = (select max(id) from payment_attempts where payment_id = $1)",
        [p.id, b.approve ? "approved" : "rejected", s.user.id, b.note || null],
      );
      let order = o;
      if (b.approve) {
        if (p.purpose === "order") {
          if (!["awaiting_payment", "payment_review"].includes(o.status))
            throw new ApiError(
              "conflict",
              "The order changed meanwhile (cancelled?) — reject this payment with a note and refund it",
            );
          order = await matching.enterMatchingTx(c, o, s.user.id);
        } else {
          order = await activateRevisionTx(c, o, p.revision_n!, s.user.id);
        }
      } else {
        if (p.purpose === "order" && o.status === "payment_review")
          order = await transition(c, o, ["payment_review"], "awaiting_payment");
        await addEvent(c, o.id, {
          kind: "payment_rejected",
          status: order.status,
          actorId: s.user.id,
          note: `Payment not matched: ${b.note}`,
        });
      }
      await audit(c, {
        actorId: s.user.id,
        action: b.approve ? "payment.approve" : "payment.reject",
        target: p.id,
        details: { note: b.note, amountMinor: Number(p.amount_minor) },
        ip: req.ip,
      });
      return {
        p: (await c.query<PaymentRow>("select * from payments where id = $1", [p.id])).rows[0]!,
        order,
      };
    });
    const { p, order } = result;
    const recipients = [...new Set([order.student_id, p.payer_id].filter((x): x is string => !!x))];
    await notifications.service.notify({
      type: b.approve ? "payment.approved" : "payment.rejected",
      recipientIds: recipients,
      actorId: null,
      payload: { link: orderLink("student", order.id) },
      data: { code: order.code, title: order.title, note: b.note },
    });
    if (b.approve && p.purpose === "order") await matching.kick(order.id);
    if (b.approve && p.purpose === "revision" && order.mentor_id)
      await notifications.service.notify({
        type: "order.revision",
        recipientIds: [order.mentor_id],
        actorId: null,
        payload: { link: orderLink("mentor", order.id) },
        data: { code: order.code, title: order.title, n: p.revision_n ?? 0 },
      });
    return paymentDto(db, p, "staff");
  });
};
