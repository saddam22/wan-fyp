import type { FastifyPluginAsync } from "fastify";
import { fromBnDigits } from "@edukhata/contracts";
import { z } from "zod";
import { tx } from "../db.ts";
import type { Deps } from "../deps.ts";
import { audit } from "../lib/audit.ts";
import { ApiError } from "../lib/errors.ts";
import { requireUser } from "../lib/session.ts";
import { loadOrder } from "../market/orders.ts";

/** Phone numbers, emails, links and messenger names: held for a moderator (no off-platform deals). */
export function looksLikeContact(text: string): boolean {
  const t = fromBnDigits(text).toLowerCase();
  return (
    /(?:\+?88)?0?1[3-9](?:[\s-]?\d){8}/.test(t) ||
    /[^\s@]+@[^\s@]+\.[a-z]{2,}/.test(t) ||
    /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|xyz|me|io|bd)\b)/.test(t) ||
    /\b(whats\s?app|telegram|imo|viber|messenger|bkash\s*number)\b/.test(t)
  );
}

const first = (name: string) => name.trim().split(/\s+/)[0] ?? "";

export const reviewRoutes: FastifyPluginAsync<Deps> = async (app, { db, config, hub }) => {
  /** One review per order by its student, after approval. */
  app.post<{ Params: { id: string } }>("/orders/:id/review", async (req, reply) => {
    const s = await requireUser(db, config, hub, req, "/student");
    const b = z
      .object({
        rating: z.number().int().min(1).max(5),
        text: z.string().trim().max(1000).default(""),
      })
      .safeParse(req.body);
    if (!b.success) throw new ApiError("validation", "Rate from 1 to 5", "rating");
    const o = await loadOrder(db, req.params.id);
    if (!o || o.student_id !== s.user.id) throw new ApiError("not_found", "Order not found");
    if (!["approved", "closed"].includes(o.status) || !o.mentor_id)
      throw new ApiError("conflict", "You can review after approving the work");
    const status = looksLikeContact(b.data.text) ? "pending" : "published";
    try {
      await db.query(
        "insert into reviews (order_id, mentor_id, student_id, rating, text, status) values ($1, $2, $3, $4, $5, $6)",
        [o.id, o.mentor_id, s.user.id, b.data.rating, b.data.text, status],
      );
    } catch (e) {
      if ((e as { code?: string }).code === "23505")
        throw new ApiError("conflict", "You already reviewed this order");
      throw e;
    }
    return reply.code(201).send({ status });
  });

  /** Published reviews of a mentor (first names of students only). */
  app.get<{ Params: { id: string } }>("/mentors/:id/reviews", async (req) => {
    const rows = (
      await db.query<{
        id: string;
        rating: number;
        text: string;
        created_at: Date;
        name: string;
        code: string;
      }>(
        `select v.id, v.rating, v.text, v.created_at, u.name, o.code from reviews v
           join users u on u.id = v.student_id join orders o on o.id = v.order_id
          where v.mentor_id::text = $1 and v.status = 'published' order by v.created_at desc limit 100`,
        [req.params.id],
      )
    ).rows;
    const avg = rows.length ? rows.reduce((a, r) => a + r.rating, 0) / rows.length : null;
    return {
      rating: avg === null ? null : Math.round(avg * 10) / 10,
      count: rows.length,
      items: rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        text: r.text,
        at: r.created_at.toISOString(),
        studentName: first(r.name),
        orderCode: r.code,
      })),
    };
  });

  app.get<{ Querystring: { status?: string } }>("/admin/reviews", async (req) => {
    await requireUser(db, config, hub, req, "/admin/reviews");
    const rows = (
      await db.query<{
        id: string;
        rating: number;
        text: string;
        status: string;
        created_at: Date;
        student: string;
        mentor: string;
        code: string;
      }>(
        `select v.id, v.rating, v.text, v.status, v.created_at, su.name as student, mu.name as mentor, o.code from reviews v
           join users su on su.id = v.student_id join users mu on mu.id = v.mentor_id join orders o on o.id = v.order_id
          where ($1::text is null or v.status = $1) order by v.created_at desc limit 200`,
        [req.query.status ?? null],
      )
    ).rows;
    return rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      text: r.text,
      status: r.status,
      at: r.created_at.toISOString(),
      studentName: r.student,
      mentorName: r.mentor,
      orderCode: r.code,
    }));
  });

  app.post<{ Params: { id: string } }>("/admin/reviews/:id/moderate", async (req) => {
    const s = await requireUser(db, config, hub, req, "/admin/reviews");
    const b = z
      .object({
        status: z.enum(["published", "hidden"]),
        note: z.string().trim().max(300).default(""),
      })
      .safeParse(req.body);
    if (!b.success) throw new ApiError("validation", "Choose publish or hide", "status");
    await tx(db, async (c) => {
      const r = await c.query(
        "update reviews set status = $2, moderated_by = $3, moderation_note = $4, updated_at = now() where id::text = $1",
        [req.params.id, b.data.status, s.user.id, b.data.note],
      );
      if (!r.rowCount) throw new ApiError("not_found", "Review not found");
      await audit(c, {
        actorId: s.user.id,
        action: "review.moderate",
        target: req.params.id,
        details: b.data,
        ip: req.ip,
      });
    });
    return { ok: true };
  });
};
