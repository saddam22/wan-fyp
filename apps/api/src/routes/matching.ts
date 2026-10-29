import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { Deps } from "../deps.ts";
import { audit } from "../lib/audit.ts";
import { ApiError } from "../lib/errors.ts";
import { requireUser } from "../lib/session.ts";
import { candidates } from "../market/matching.ts";
import { addEvent, loadOrder, orderDto, orderFor, transition } from "../market/orders.ts";

const note = z.object({ note: z.string().trim().max(300).default("") });

/** Offers for mentors, and the admin side of assignment. The server decides every step. */
export const matchingRoutes: FastifyPluginAsync<Deps> = async (
  app,
  { db, config, hub, matching },
) => {
  app.get("/mentor/offers", async (req) => {
    const s = await requireUser(db, config, hub, req, "/mentor");
    return matching.offersFor(s.user.id);
  });

  app.post<{ Params: { id: string } }>("/mentor/offers/:id/accept", async (req) => {
    const s = await requireUser(db, config, hub, req, "/mentor");
    const o = await matching.accept(req.params.id, s.user.id);
    return orderDto(db, o, "mentor");
  });

  app.post<{ Params: { id: string } }>("/mentor/offers/:id/decline", async (req) => {
    const s = await requireUser(db, config, hub, req, "/mentor");
    await matching.decline(req.params.id, s.user.id);
    return { ok: true };
  });

  /** The assigned mentor starts work (assigned → in_progress). */
  app.post<{ Params: { id: string } }>("/mentor/orders/:id/start", async (req) => {
    const s = await requireUser(db, config, hub, req, "/mentor");
    const { o, rel } = await orderFor(db, req.params.id, s);
    if (rel !== "mentor") throw new ApiError("not_found", "Order not found");
    const row = await transition(db, o, ["assigned"], "in_progress");
    await addEvent(db, o.id, {
      kind: "started",
      status: "in_progress",
      actorId: s.user.id,
      note: "Mentor started work",
    });
    return orderDto(db, row, "mentor");
  });

  /** Before starting, the mentor may hand the order back; it looks for another mentor. */
  app.post<{ Params: { id: string } }>("/mentor/orders/:id/release", async (req) => {
    const s = await requireUser(db, config, hub, req, "/mentor");
    const b = note.parse(req.body ?? {});
    const { rel } = await orderFor(db, req.params.id, s);
    if (rel !== "mentor") throw new ApiError("not_found", "Order not found");
    await matching.unassign(req.params.id, s.user.id, b.note || "Mentor released the order", [
      "assigned",
    ]);
    return { ok: true };
  });

  // ---- Admin --------------------------------------------------------------------------

  app.get<{ Params: { id: string } }>("/admin/orders/:id/candidates", async (req) => {
    await requireUser(db, config, hub, req, "/admin/orders");
    const o = await loadOrder(db, req.params.id);
    if (!o) throw new ApiError("not_found", "Order not found");
    return candidates(db, o, 50, true);
  });

  /** Assignment history: every offer and its outcome. */
  app.get<{ Params: { id: string } }>("/admin/orders/:id/offers", async (req) => {
    await requireUser(db, config, hub, req, "/admin/orders");
    const rows = (
      await db.query<{
        mentor_id: string;
        name: string;
        wave: number;
        status: string;
        score: string;
        offered_at: Date;
        expires_at: Date;
        responded_at: Date | null;
      }>(
        `select f.mentor_id, u.name, f.wave, f.status, f.score, f.offered_at, f.expires_at, f.responded_at
           from order_offers f join users u on u.id = f.mentor_id where f.order_id::text = $1 order by f.offered_at`,
        [req.params.id],
      )
    ).rows;
    return rows.map((r) => ({
      mentorId: r.mentor_id,
      mentorName: r.name,
      wave: r.wave,
      status: r.status,
      score: Number(r.score),
      offeredAt: r.offered_at.toISOString(),
      expiresAt: r.expires_at.toISOString(),
      respondedAt: r.responded_at?.toISOString() ?? null,
    }));
  });

  app.post<{ Params: { id: string } }>("/admin/orders/:id/assign", async (req) => {
    const s = await requireUser(db, config, hub, req, "/admin/orders");
    const b = z
      .object({ mentorId: z.uuid(), note: z.string().trim().max(300).default("") })
      .safeParse(req.body);
    if (!b.success) throw new ApiError("validation", "Choose a mentor", "mentorId");
    const o = await matching.assign(req.params.id, b.data.mentorId, s.user.id, b.data.note);
    await audit(db, {
      actorId: s.user.id,
      action: "order.assign",
      target: o.id,
      details: { mentorId: b.data.mentorId, note: b.data.note },
      ip: req.ip,
    });
    return orderDto(db, o, "staff");
  });

  /** Take the order from its mentor and match again (choose someone with /assign instead). */
  app.post<{ Params: { id: string } }>("/admin/orders/:id/unassign", async (req) => {
    const s = await requireUser(db, config, hub, req, "/admin/orders");
    const b = z.object({ reason: z.string().trim().min(3).max(300) }).safeParse(req.body);
    if (!b.success) throw new ApiError("validation", "Give a reason", "reason");
    const o = await matching.unassign(req.params.id, s.user.id, b.data.reason, [
      "assigned",
      "in_progress",
      "revision_requested",
    ]);
    await audit(db, {
      actorId: s.user.id,
      action: "order.unassign",
      target: o.id,
      details: { reason: b.data.reason },
      ip: req.ip,
    });
    return orderDto(db, o, "staff");
  });
};
