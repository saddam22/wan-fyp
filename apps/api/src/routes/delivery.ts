import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { Deps } from "../deps.ts";
import { audit } from "../lib/audit.ts";
import { ApiError } from "../lib/errors.ts";
import { requireUser } from "../lib/session.ts";
import { orderDto, orderFor } from "../market/orders.ts";

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body ?? {});
  if (!r.success)
    throw new ApiError("validation", r.error.issues[0]?.message, r.error.issues[0]?.path.join("."));
  return r.data;
}

/** Delivery, approval, revisions, disputes, closure. */
export const deliveryRoutes: FastifyPluginAsync<Deps> = async (
  app,
  { db, config, hub, delivery },
) => {
  app.post<{ Params: { id: string } }>("/mentor/orders/:id/deliver", async (req) => {
    const s = await requireUser(db, config, hub, req, "/mentor");
    const b = parse(z.object({ note: z.string().trim().max(1000).default("") }), req.body);
    const o = await delivery.deliver(req.params.id, s.user.id, b.note);
    return orderDto(db, o, "mentor");
  });

  app.post<{ Params: { id: string } }>("/orders/:id/approve", async (req) => {
    const s = await requireUser(db, config, hub, req, "/student");
    const o = await delivery.approve(req.params.id, s.user.id);
    return orderDto(db, o, "student");
  });

  app.post<{ Params: { id: string } }>("/orders/:id/revisions", async (req, reply) => {
    const s = await requireUser(db, config, hub, req, "/student");
    const b = parse(
      z.object({
        instructions: z
          .string()
          .trim()
          .min(10, "Describe what to change (10+ characters)")
          .max(3000),
      }),
      req.body,
    );
    const r = await delivery.requestRevision(req.params.id, s.user.id, b.instructions);
    return reply.code(201).send({
      n: r.n,
      paymentDue: r.due,
      feeMinor: r.fee,
      order: await orderDto(db, r.o, "student"),
    });
  });

  app.post<{ Params: { id: string } }>("/orders/:id/disputes", async (req, reply) => {
    const s = await requireUser(db, config, hub, req);
    const b = parse(
      z.object({
        reason: z.string().trim().min(20, "Explain the problem (20+ characters)").max(3000),
      }),
      req.body,
    );
    const { rel } = await orderFor(db, req.params.id, s);
    if (rel !== "student" && rel !== "mentor")
      throw new ApiError("forbidden", "Only the student or the mentor can open a dispute");
    const o = await delivery.openDispute(req.params.id, { id: s.user.id, rel }, b.reason);
    return reply.code(201).send(await orderDto(db, o, rel));
  });

  app.get<{ Querystring: { status?: string } }>("/admin/disputes", async (req) => {
    await requireUser(db, config, hub, req, "/admin/disputes");
    const rows = (
      await db.query<{
        id: string;
        order_id: string;
        code: string;
        title: string;
        opened_by: string;
        reason: string;
        status: string;
        price_minor: string;
        currency: string;
        refund_minor: string | null;
        opened_at: Date;
        resolved_at: Date | null;
        resolution_note: string | null;
      }>(
        `select d.*, o.code, o.title, o.price_minor, o.currency, u.name as opened_by from disputes d
           join orders o on o.id = d.order_id join users u on u.id = d.opened_by
          where ($1::text is null or d.status = $1) order by d.opened_at desc limit 200`,
        [req.query.status ?? null],
      )
    ).rows;
    return rows.map((d) => ({
      id: d.id,
      orderId: d.order_id,
      orderCode: d.code,
      title: d.title,
      openedBy: d.opened_by,
      reason: d.reason,
      amount: { amountMinor: Number(d.price_minor), currency: d.currency },
      status: d.status,
      refundMinor: d.refund_minor === null ? null : Number(d.refund_minor),
      resolutionNote: d.resolution_note,
      openedAt: d.opened_at.toISOString(),
      resolvedAt: d.resolved_at?.toISOString() ?? null,
    }));
  });

  app.post<{ Params: { id: string } }>("/admin/disputes/:id/resolve", async (req) => {
    const s = await requireUser(db, config, hub, req, "/admin/disputes");
    const b = parse(
      z.object({
        outcome: z.enum(["release", "refund", "partial"]),
        refundMinor: z.number().int().min(1).optional(),
        note: z.string().trim().min(5, "Explain the decision").max(2000),
      }),
      req.body,
    );
    const o = await delivery.resolveDispute(req.params.id, s.user.id, b);
    await audit(db, {
      actorId: s.user.id,
      action: "dispute.resolve",
      target: req.params.id,
      details: b,
      ip: req.ip,
    });
    return orderDto(db, o, "staff");
  });

  app.post<{ Params: { id: string } }>("/admin/orders/:id/close", async (req) => {
    const s = await requireUser(db, config, hub, req, "/admin/orders");
    const o = await delivery.close(req.params.id, s.user.id, "Closed by EduKhata");
    await audit(db, { actorId: s.user.id, action: "order.close", target: o.id, ip: req.ip });
    return orderDto(db, o, "staff");
  });
};
