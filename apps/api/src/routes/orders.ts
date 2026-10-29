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
import { requireUser, type SessionCtx } from "../lib/session.ts";
import {
  addEvent,
  mentorShare,
  OPEN_STATUSES,
  orderDto,
  orderFor,
  orderLink,
  quote,
  STAFF,
  transition,
  type OrderRow,
} from "../market/orders.ts";
import { evaluateCoupon } from "../market/coupons.ts";
import { createRefundTx, notifyRefundDue } from "../market/refunds.ts";
import { LEVELS, WORK_TYPES } from "./catalog.ts";

export const ORDER_FILE_MAX = 10 * 1024 * 1024;
const FILE_TYPES: Record<"requirement" | "preview" | "final", string[]> = {
  requirement: [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  // Previews are images, watermarked by the server; finals unlock after approval.
  preview: ["image/jpeg", "image/png", "image/webp"],
  final: [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip",
  ],
};
const MAX_FILES_PER_STAGE = 20;

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success)
    throw new ApiError("validation", r.error.issues[0]?.message, r.error.issues[0]?.path.join("."));
  return r.data;
}

const quoteBody = z.object({
  workType: z.enum(WORK_TYPES),
  pages: z.number().int().min(1).max(300),
  deliveryMethod: z.enum(["digital", "courier"]),
  couponCode: z.string().trim().max(24).optional(),
});
const createBody = quoteBody.extend({
  categorySlug: z.string().max(40),
  subjectId: z.string().max(40),
  level: z.enum(LEVELS),
  title: z.string().trim().min(8).max(140),
  instructions: z.string().trim().min(30).max(5000),
  deadline: z.iso.datetime({ offset: true }),
  deliveryAddress: z.string().trim().max(400).optional(),
  preferredMentorId: z.uuid().optional(),
});

const isStaff = (s: SessionCtx) => s.roles.some((r) => STAFF.includes(r));

/** Watermark for preview images: tiled diagonal text; also downscaled and EXIF-free. */
async function watermark(body: Buffer, code: string): Promise<Buffer> {
  const { data, info } = await sharp(body, { limitInputPixels: 50_000_000 })
    .rotate()
    .resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const label = `EduKhata preview · ${code}`.replace(/[<&>]/g, "");
  const line = `${label}   `.repeat(Math.ceil(width / 260) + 2);
  const rows = Array.from(
    { length: Math.ceil(height / 160) + 2 },
    (_, i) => `<text x="${(i % 2) * 120 - 200}" y="${i * 160}">${line}</text>`,
  ).join("");
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><style>text{font:600 28px sans-serif;fill:rgba(220,30,30,.35)}</style><g transform="rotate(-30 ${width / 2} ${height / 2})">${rows}</g></svg>`,
  );
  return sharp(data)
    .composite([{ input: svg }])
    .webp({ quality: 70 })
    .toBuffer();
}

export const orderRoutes: FastifyPluginAsync<Deps> = async (
  app,
  { db, config, hub, notifications },
) => {
  const storage = diskStorage(config.orderFilesDir, config.chatSecret, "/api/order-files", "order");

  /** Price for a draft order (the same calculation the order uses). */
  app.post("/orders/quote", async (req) => {
    const b = parse(quoteBody, req.body);
    const q = await quote(db, b);
    // Per-person limits are checked when the order is placed (the quote needs no sign-in).
    const d = b.couponCode ? await evaluateCoupon(db, b.couponCode, q.totalMinor) : null;
    return {
      currency: q.currency,
      perPageMinor: q.perPageMinor,
      baseMinor: q.baseMinor,
      courierMinor: q.courierMinor,
      ...(d ? { discountMinor: d.discountMinor, couponCode: d.coupon.code } : {}),
      totalMinor: q.totalMinor - (d?.discountMinor ?? 0),
      freeRevisions: q.settings.free_revisions,
    };
  });

  app.post("/orders", async (req, reply) => {
    const s = await requireUser(db, config, hub, req, "/student");
    const b = parse(createBody, req.body);
    const q = await quote(db, b);
    const deadline = new Date(b.deadline);
    if (deadline.getTime() < Date.now() + q.settings.min_deadline_hours * 3600_000)
      throw new ApiError(
        "validation",
        `The deadline must be at least ${q.settings.min_deadline_hours} hours from now`,
        "deadline",
      );
    if (deadline.getTime() > Date.now() + 120 * 24 * 3600_000)
      throw new ApiError("validation", "The deadline is too far away", "deadline");
    if (b.deliveryMethod === "courier" && !b.deliveryAddress)
      throw new ApiError("validation", "Add a delivery address", "deliveryAddress");
    const cat = (
      await db.query("select 1 from categories where slug = $1 and active", [b.categorySlug])
    ).rowCount;
    if (!cat) throw new ApiError("validation", "Unknown category", "categorySlug");
    const subj = (
      await db.query<{ levels: string[] }>("select levels from subjects where id = $1 and active", [
        b.subjectId,
      ])
    ).rows[0];
    if (!subj) throw new ApiError("validation", "Unknown subject", "subjectId");
    if (subj.levels.length && !subj.levels.includes(b.level))
      throw new ApiError("validation", "This subject isn't offered at that level", "level");
    if (b.preferredMentorId) {
      const m = await db.query(
        `select 1 from users u join user_roles r on r.user_id = u.id and r.role = 'mentor' join mentor_profiles p on p.user_id = u.id
          where u.id = $1 and u.status = 'active' and $2 = any(p.subjects) and u.id <> $3`,
        [b.preferredMentorId, b.subjectId, s.user.id],
      );
      if (!m.rowCount)
        throw new ApiError(
          "validation",
          "That mentor doesn't take this subject",
          "preferredMentorId",
        );
    }
    const o = await tx(db, async (c) => {
      // The discount is shared by the platform and the mentor in the order's split (Q9).
      const d = b.couponCode
        ? await evaluateCoupon(c, b.couponCode, q.totalMinor, { userId: s.user.id, lock: true })
        : null;
      const row = (
        await c.query<OrderRow>(
          `insert into orders (student_id, preferred_mentor_id, category_slug, subject_id, level, work_type, title, instructions, pages,
             delivery_method, delivery_address, deadline, price_minor, currency, commission_rate, free_revisions,
             list_price_minor, discount_minor, coupon_id)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) returning *`,
          [
            s.user.id,
            b.preferredMentorId ?? null,
            b.categorySlug,
            b.subjectId,
            b.level,
            b.workType,
            b.title,
            b.instructions,
            b.pages,
            b.deliveryMethod,
            b.deliveryMethod === "courier" ? b.deliveryAddress : null,
            deadline,
            q.totalMinor - (d?.discountMinor ?? 0),
            q.currency,
            q.settings.commission_rate,
            q.settings.free_revisions,
            q.totalMinor,
            d?.discountMinor ?? 0,
            d?.coupon.id ?? null,
          ],
        )
      ).rows[0]!;
      if (d)
        await c.query(
          "insert into coupon_redemptions (coupon_id, user_id, order_id, discount_minor) values ($1, $2, $3, $4)",
          [d.coupon.id, s.user.id, row.id, d.discountMinor],
        );
      await addEvent(c, row.id, {
        kind: "created",
        status: row.status,
        actorId: s.user.id,
        note: "Order placed",
      });
      return row;
    });
    return reply.code(201).send(await orderDto(db, o, "student"));
  });

  /** Orders for one side: as=student (own), mentor (assigned), guardian (children), staff (all). */
  app.get<{ Querystring: { as?: string; status?: string; q?: string } }>("/orders", async (req) => {
    const s = await requireUser(db, config, hub, req);
    const as = req.query.as ?? "student";
    const status = req.query.status ?? null;
    const where: Record<string, [string, unknown[]]> = {
      student: ["o.student_id = $1", [s.user.id]],
      mentor: ["o.mentor_id = $1", [s.user.id]],
      guardian: [
        "o.student_id in (select student_id from guardian_links where guardian_id = $1 and view_orders)",
        [s.user.id],
      ],
      staff: ["$1::uuid is not null", [s.user.id]],
    };
    const need: Record<string, string> = {
      student: "/student",
      mentor: "/mentor",
      guardian: "/guardian",
      staff: "",
    };
    const w = where[as];
    if (!w) throw new ApiError("validation", "Unknown list", "as");
    if (as === "staff") {
      if (!isStaff(s)) throw new ApiError("forbidden", "Your role doesn't allow this");
    } else await requireUser(db, config, hub, req, need[as]);
    const rows = (
      await db.query<OrderRow & { student_name: string; mentor_name: string | null }>(
        `select o.*, su.name as student_name, mu.name as mentor_name from orders o
           join users su on su.id = o.student_id left join users mu on mu.id = o.mentor_id
          where ${w[0]} and ($2::text is null or o.status = $2)
            and ($3::text is null or o.code ilike $3 or o.title ilike $3)
          order by o.created_at desc limit 200`,
        [
          ...w[1],
          status,
          req.query.q ? `%${req.query.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null,
        ],
      )
    ).rows;
    return rows.map((o) => ({
      id: o.id,
      code: o.code,
      title: o.title,
      subject: o.subject_id,
      workType: o.work_type,
      pages: o.pages,
      status: o.status,
      studentName: o.student_name,
      ...(o.mentor_name ? { mentorName: o.mentor_name } : {}),
      price: { amountMinor: Number(o.price_minor), currency: o.currency },
      commissionRate: Number(o.commission_rate),
      ...(as === "mentor" || as === "staff"
        ? {
            payout: {
              amountMinor: mentorShare(Number(o.price_minor), Number(o.commission_rate)),
              currency: o.currency,
            },
          }
        : {}),
      deadline: o.deadline.toISOString(),
      createdAt: o.created_at.toISOString(),
      needsManualAssignment: as === "staff" ? o.needs_manual_assignment : undefined,
    }));
  });

  app.get<{ Params: { id: string } }>("/orders/:id", async (req) => {
    const s = await requireUser(db, config, hub, req);
    const { o, rel } = await orderFor(db, req.params.id, s);
    return orderDto(db, o, rel);
  });

  /** Students cancel before a mentor is assigned; staff cancel any open order with a reason. */
  app.post<{ Params: { id: string } }>("/orders/:id/cancel", async (req) => {
    const s = await requireUser(db, config, hub, req);
    const b = parse(z.object({ reason: z.string().trim().max(300).default("") }), req.body ?? {});
    let refundId: string | null = null;
    const res = await tx(db, async (c) => {
      const { o, rel } = await orderFor(c, req.params.id, s, true);
      const from =
        rel === "student"
          ? [...OPEN_STATUSES]
          : rel === "staff"
            ? [
                "awaiting_payment",
                "payment_review",
                "matching",
                "assigned",
                "in_progress",
                "revision_requested",
                "delivered",
              ]
            : null;
      if (!from) throw new ApiError("forbidden", "Only the student or EduKhata staff can cancel");
      if (rel === "staff" && !b.reason) throw new ApiError("validation", "Give a reason", "reason");
      if (!from.includes(o.status))
        throw new ApiError(
          "conflict",
          rel === "student"
            ? "A mentor is already working on it — contact support or open a dispute"
            : "This order can't be cancelled now",
        );
      const pays = (
        await c.query<{ status: string }>(
          "select status from payments where order_id = $1 for update",
          [o.id],
        )
      ).rows;
      if (pays.some((p) => p.status === "submitted"))
        throw new ApiError(
          "conflict",
          "A payment is being checked — wait for the decision, then cancel",
        );
      const row = await transition(c, o, from, "cancelled", { cancelled_at: new Date() });
      // A coupon used on a cancelled order can be used again.
      await c.query(
        "update coupon_redemptions set status = 'released' where order_id = $1 and status = 'active'",
        [o.id],
      );
      await c.query(
        "update payments set status = 'cancelled', updated_at = now() where order_id = $1 and status in ('pending', 'rejected')",
        [o.id],
      );
      // Paid already: the money held for the order is refunded (approved by an accountant).
      refundId = await createRefundTx(c, row, {
        source: "cancellation",
        reason: b.reason || "Cancelled by the student",
        requestedBy: s.user.id,
      });
      await c.query(
        "update order_offers set status = 'withdrawn', responded_at = now() where order_id = $1 and status = 'offered'",
        [o.id],
      );
      await addEvent(c, o.id, {
        kind: "cancelled",
        status: "cancelled",
        actorId: s.user.id,
        note: b.reason || "Cancelled by the student",
      });
      if (rel === "staff")
        await audit(c, {
          actorId: s.user.id,
          action: "order.cancel",
          target: o.id,
          details: { reason: b.reason },
          ip: req.ip,
        });
      return { row, mentorId: o.mentor_id };
    });
    const data = { code: res.row.code, title: res.row.title };
    await notifications.service.notify({
      type: "order.cancelled",
      recipientIds: [res.row.student_id],
      actorId: null,
      payload: { link: orderLink("student", res.row.id) },
      data,
    });
    if (res.mentorId)
      await notifications.service.notify({
        type: "order.cancelled",
        recipientIds: [res.mentorId],
        actorId: null,
        payload: { link: orderLink("mentor", res.row.id) },
        data,
      });
    if (refundId) await notifyRefundDue(db, notifications, res.row);
    return orderDto(db, res.row, "student");
  });

  // ---- Files --------------------------------------------------------------------------

  const fileBody = z.object({
    stage: z.enum(["requirement", "preview", "final"]),
    name: z.string().trim().min(1).max(160),
    contentType: z.string().max(120),
    byteSize: z.number().int().min(1).max(ORDER_FILE_MAX),
  });

  /** Step 1: a signed upload URL. Students add requirements; the assigned mentor delivers. */
  app.post<{ Params: { id: string } }>("/orders/:id/files", async (req, reply) => {
    const s = await requireUser(db, config, hub, req);
    const b = parse(fileBody, req.body);
    const { o, rel } = await orderFor(db, req.params.id, s);
    if (b.stage === "requirement") {
      if (rel !== "student")
        throw new ApiError("forbidden", "Only the student adds requirement files");
      if (
        !["awaiting_payment", "payment_review", "matching", "assigned", "in_progress"].includes(
          o.status,
        )
      )
        throw new ApiError("conflict", "Requirement files can't be added now");
    } else {
      if (rel !== "mentor")
        throw new ApiError("forbidden", "Only the assigned mentor delivers work");
      if (!["in_progress", "revision_requested"].includes(o.status))
        throw new ApiError("conflict", "Start the order before uploading work");
    }
    if (!FILE_TYPES[b.stage].includes(b.contentType))
      throw new ApiError(
        "validation",
        b.stage === "preview"
          ? "Previews must be images (JPG, PNG, WebP)"
          : "This file type isn't allowed",
        "contentType",
      );
    const count = Number(
      (
        await db.query(
          "select count(*) from order_files where order_id = $1 and stage = $2 and status <> 'deleted'",
          [o.id, b.stage],
        )
      ).rows[0].count,
    );
    if (count >= MAX_FILES_PER_STAGE) throw new ApiError("validation", "Too many files");
    const round =
      b.stage === "requirement"
        ? 0
        : Number(
            (
              await db.query(
                "select count(*) from order_revisions where order_id = $1 and payment_status <> 'cancelled'",
                [o.id],
              )
            ).rows[0].count,
          );
    const key = `${o.id}/${randomUUID()}`;
    const r = await db.query<{ id: string }>(
      `insert into order_files (order_id, uploaded_by, stage, round, name, content_type, byte_size, storage_key)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
      [o.id, s.user.id, b.stage, round, b.name, b.contentType, b.byteSize, key],
    );
    const put = await storage.presignPut(key, b.contentType, b.byteSize);
    return reply
      .code(201)
      .send({ fileId: r.rows[0]!.id, uploadUrl: put.url, headers: put.headers });
  });

  // Step 2: the signed upload target.
  await app.register(async (scope) => {
    scope.removeAllContentTypeParsers();
    scope.addContentTypeParser(
      "*",
      { parseAs: "buffer", bodyLimit: ORDER_FILE_MAX },
      (_r, body, done) => done(null, body),
    );
    scope.put<{
      Params: { "*": string };
      Querystring: { exp?: string; size?: string; sig?: string };
    }>("/order-files/*", { bodyLimit: ORDER_FILE_MAX }, async (req, reply) => {
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
      await storage.put(key, body);
      return reply.code(200).send();
    });
  });

  /** Step 3: check the bytes really are the declared type; watermark previews. */
  app.post<{ Params: { id: string; fileId: string } }>(
    "/orders/:id/files/:fileId/complete",
    async (req) => {
      const s = await requireUser(db, config, hub, req);
      const { o } = await orderFor(db, req.params.id, s);
      const f = (
        await db.query<{
          id: string;
          storage_key: string;
          content_type: string;
          byte_size: string;
          stage: string;
          uploaded_by: string;
          status: string;
        }>("select * from order_files where id::text = $1 and order_id = $2", [
          req.params.fileId,
          o.id,
        ])
      ).rows[0];
      if (!f || f.uploaded_by !== s.user.id) throw new ApiError("not_found", "File not found");
      if (f.status === "ready") return { ok: true };
      const body = await storage.get(f.storage_key);
      if (!body || body.length !== Number(f.byte_size))
        throw new ApiError("validation", "Upload the file first");
      if (!verifyContent(f.content_type, body).ok) {
        await storage.delete(f.storage_key);
        await db.query("update order_files set status = 'deleted' where id = $1", [f.id]);
        throw new ApiError("validation", "The file's content doesn't match its type");
      }
      if (f.stage === "preview") {
        const marked = await watermark(body, o.code);
        await storage.put(f.storage_key, marked);
        await db.query(
          "update order_files set content_type = 'image/webp', byte_size = $2, status = 'ready' where id = $1",
          [f.id, marked.length],
        );
      } else if (f.content_type.startsWith("image/")) {
        // Re-encode photos: removes EXIF (location, device).
        const clean = await sharp(body, { limitInputPixels: 50_000_000 })
          .rotate()
          .webp({ quality: 85 })
          .toBuffer();
        await storage.put(f.storage_key, clean);
        await db.query(
          "update order_files set content_type = 'image/webp', byte_size = $2, status = 'ready' where id = $1",
          [f.id, clean.length],
        );
      } else {
        await db.query("update order_files set status = 'ready' where id = $1", [f.id]);
      }
      return { ok: true };
    },
  );

  /** Download. Finals reach the student side only after approval. */
  app.get<{ Params: { id: string; fileId: string } }>(
    "/orders/:id/files/:fileId",
    async (req, reply) => {
      const s = await requireUser(db, config, hub, req);
      const { o, rel } = await orderFor(db, req.params.id, s);
      const f = (
        await db.query<{ storage_key: string; content_type: string; name: string; stage: string }>(
          "select storage_key, content_type, name, stage from order_files where id::text = $1 and order_id = $2 and status = 'ready'",
          [req.params.fileId, o.id],
        )
      ).rows[0];
      if (!f) throw new ApiError("not_found", "File not found");
      if (
        f.stage === "final" &&
        (rel === "student" || rel === "guardian") &&
        !["approved", "closed"].includes(o.status)
      )
        throw new ApiError("forbidden", "Final files unlock when you approve the work");
      const body = await storage.get(f.storage_key);
      if (!body) throw new ApiError("not_found", "File not found");
      const inline = f.content_type.startsWith("image/");
      return reply
        .header("content-type", f.content_type)
        .header("x-content-type-options", "nosniff")
        .header("content-security-policy", "default-src 'none'; sandbox")
        .header("cache-control", "private, no-store")
        .header(
          "content-disposition",
          `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
        )
        .send(body);
    },
  );

  app.delete<{ Params: { id: string; fileId: string } }>(
    "/orders/:id/files/:fileId",
    async (req) => {
      const s = await requireUser(db, config, hub, req);
      const { o } = await orderFor(db, req.params.id, s);
      const f = (
        await db.query<{ id: string; storage_key: string; uploaded_by: string; stage: string }>(
          "select id, storage_key, uploaded_by, stage from order_files where id::text = $1 and order_id = $2 and status <> 'deleted'",
          [req.params.fileId, o.id],
        )
      ).rows[0];
      if (!f || f.uploaded_by !== s.user.id) throw new ApiError("not_found", "File not found");
      // Delivered work stays part of the record; requirements can be removed until assignment.
      if (f.stage !== "requirement" || !(OPEN_STATUSES as readonly string[]).includes(o.status))
        throw new ApiError("conflict", "This file can no longer be removed");
      await storage.delete(f.storage_key);
      await db.query("update order_files set status = 'deleted' where id = $1", [f.id]);
      return { ok: true };
    },
  );
};
