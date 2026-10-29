import type { Db, Queryable } from "../db.ts";
import { tx } from "../db.ts";
import type { Deps } from "../deps.ts";
import { ApiError } from "../lib/errors.ts";
import { addEvent, loadOrder, orderLink, transition, type OrderRow } from "./orders.ts";
import { getSettings } from "./settings.ts";

type Notifications = Deps["notifications"];
type Logger = { error(o: object, m?: string): void };

/** Statuses from which a dispute can be opened (work started or delivered). */
export const DISPUTABLE = [
  "assigned",
  "in_progress",
  "delivered",
  "revision_requested",
  "approved",
] as const;

/** Delivery, approval, revisions, disputes and closure. Every step is a guarded transition. */
export function createDelivery(db: Db, notifications: Notifications, logger: Logger) {
  const notify = async (
    type: string,
    o: OrderRow,
    to: "student" | "mentor",
    data: Record<string, string | number | boolean> = {},
  ) => {
    const id = to === "student" ? o.student_id : o.mentor_id;
    if (!id) return;
    await notifications.service
      .notify({
        type,
        recipientIds: [id],
        actorId: null,
        payload: { link: orderLink(to, o.id) },
        data: { code: o.code, title: o.title, ...data },
      })
      .catch((err: unknown) => logger.error({ err }, "order notification failed"));
  };
  const staffIds = async () =>
    (
      await db.query<{ user_id: string }>(
        "select distinct user_id from user_roles where role in ('supporter', 'admin', 'super_admin')",
      )
    ).rows.map((r) => r.user_id);

  const currentRound = async (c: Queryable, orderId: string) =>
    Number(
      (
        await c.query(
          "select count(*) from order_revisions where order_id = $1 and payment_status <> 'cancelled'",
          [orderId],
        )
      ).rows[0].count,
    );

  const api = {
    /** The mentor delivers: needs at least one preview and one final file in this round. */
    async deliver(orderId: string, mentorId: string, note: string) {
      const o = await tx(db, async (c) => {
        const o = await loadOrder(c, orderId, true);
        if (!o || o.mentor_id !== mentorId) throw new ApiError("not_found", "Order not found");
        const round = await currentRound(c, o.id);
        const files = (
          await c.query<{ stage: string; n: number }>(
            "select stage, count(*)::int as n from order_files where order_id = $1 and round = $2 and status = 'ready' and stage in ('preview', 'final') group by stage",
            [o.id, round],
          )
        ).rows;
        const has = (stage: string) => files.some((f) => f.stage === stage && f.n > 0);
        if (!has("preview") || !has("final"))
          throw new ApiError(
            "validation",
            "Upload at least one preview image and the final files for this delivery",
          );
        // delivered_at keeps the first delivery (on-time rate); later rounds are in the timeline.
        const row = await transition(c, o, ["in_progress", "revision_requested"], "delivered", {
          delivered_at: o.delivered_at ?? new Date(),
        });
        await c.query(
          "update order_revisions set resolved_at = now() where order_id = $1 and resolved_at is null and payment_status in ('not_required', 'paid')",
          [o.id],
        );
        await addEvent(c, o.id, {
          kind: "delivered",
          status: "delivered",
          actorId: mentorId,
          note: note || (round ? `Revision ${round} delivered` : "Work delivered"),
          details: { round },
        });
        return row;
      });
      await notify("order.delivered", o, "student");
      return o;
    },

    async approve(orderId: string, studentId: string) {
      const o = await tx(db, async (c) => {
        const o = await loadOrder(c, orderId, true);
        if (!o || o.student_id !== studentId) throw new ApiError("not_found", "Order not found");
        // A revision waiting for payment is withdrawn by approving.
        await c.query(
          "update order_revisions set payment_status = 'cancelled' where order_id = $1 and payment_status = 'due'",
          [o.id],
        );
        const row = await transition(c, o, ["delivered"], "approved", { approved_at: new Date() });
        await addEvent(c, o.id, {
          kind: "approved",
          status: "approved",
          actorId: studentId,
          note: "Student approved the work",
        });
        return row;
      });
      await notify("order.approved", o, "mentor");
      return o;
    },

    /**
     * The student asks for changes. Free revisions go straight to the mentor; beyond the
     * allowance the revision is priced and waits for payment (activated in Phase 5).
     */
    async requestRevision(orderId: string, studentId: string, instructions: string) {
      const result = await tx(db, async (c) => {
        const o = await loadOrder(c, orderId, true);
        if (!o || o.student_id !== studentId) throw new ApiError("not_found", "Order not found");
        if (o.status !== "delivered")
          throw new ApiError("conflict", "You can ask for a revision after a delivery");
        const settings = await getSettings(c);
        const pending = (
          await c.query(
            "select 1 from order_revisions where order_id = $1 and payment_status = 'due'",
            [o.id],
          )
        ).rowCount;
        if (pending)
          throw new ApiError("conflict", "A paid revision is already waiting for payment");
        const used = await currentRound(c, o.id);
        if (used >= settings.max_revisions)
          throw new ApiError(
            "conflict",
            "The revision limit for this order is reached — open a dispute if the work is not acceptable",
          );
        const n = used + 1;
        const paid = n > o.free_revisions;
        const fee = paid ? Math.round(Number(o.price_minor) * settings.paid_revision_fee_pct) : 0;
        await c.query(
          "insert into order_revisions (order_id, n, instructions, paid, requested_by, fee_minor, payment_status) values ($1, $2, $3, $4, $5, $6, $7)",
          [o.id, n, instructions, paid, studentId, fee, paid && fee > 0 ? "due" : "not_required"],
        );
        if (paid && fee > 0) {
          await addEvent(c, o.id, {
            kind: "revision_due",
            status: o.status,
            actorId: studentId,
            note: `Revision ${n} needs payment`,
            details: { n, feeMinor: fee },
          });
          return { o, n, due: true, fee };
        }
        const row = await transition(c, o, ["delivered"], "revision_requested");
        await addEvent(c, o.id, {
          kind: "revision",
          status: "revision_requested",
          actorId: studentId,
          note: `Revision ${n} requested`,
          details: { n },
        });
        return { o: row, n, due: false, fee };
      });
      if (result.due) await notify("order.revision_due", result.o, "student", { n: result.n });
      else await notify("order.revision", result.o, "mentor", { n: result.n });
      return result;
    },

    /** Phase 5 calls this when a paid revision's payment is approved. */
    async activatePaidRevision(orderId: string, n: number, actorId: string | null) {
      const o = await tx(db, async (c) => {
        const o = await loadOrder(c, orderId, true);
        if (!o) throw new ApiError("not_found", "Order not found");
        const r = await c.query(
          "update order_revisions set payment_status = 'paid' where order_id = $1 and n = $2 and payment_status = 'due'",
          [o.id, n],
        );
        if (!r.rowCount) throw new ApiError("conflict", "No revision is waiting for payment");
        const row = await transition(c, o, ["delivered"], "revision_requested");
        await addEvent(c, o.id, {
          kind: "revision",
          status: "revision_requested",
          actorId,
          note: `Revision ${n} paid and requested`,
          details: { n },
        });
        return row;
      });
      await notify("order.revision", o, "mentor", { n });
      return o;
    },

    async openDispute(
      orderId: string,
      by: { id: string; rel: "student" | "mentor" },
      reason: string,
    ) {
      const o = await tx(db, async (c) => {
        const o = await loadOrder(c, orderId, true);
        if (!o) throw new ApiError("not_found", "Order not found");
        if (!(DISPUTABLE as readonly string[]).includes(o.status))
          throw new ApiError("conflict", "A dispute can't be opened for this order now");
        try {
          await c.query(
            "insert into disputes (order_id, opened_by, reason, order_status_before) values ($1, $2, $3, $4)",
            [o.id, by.id, reason, o.status],
          );
        } catch (e) {
          if ((e as { code?: string }).code === "23505")
            throw new ApiError("conflict", "A dispute is already open");
          throw e;
        }
        const row = await transition(c, o, [...DISPUTABLE], "disputed");
        await addEvent(c, o.id, {
          kind: "dispute_opened",
          status: "disputed",
          actorId: by.id,
          note: reason,
        });
        return row;
      });
      await notify("order.dispute", o, "student");
      await notify("order.dispute", o, "mentor");
      await notifications.service
        .notify({
          type: "order.dispute",
          recipientIds: await staffIds(),
          actorId: null,
          payload: { link: orderLink("admin", o.id) },
          data: { code: o.code, title: o.title },
        })
        .catch((err: unknown) => logger.error({ err }, "dispute notification failed"));
      return o;
    },

    /**
     * Staff decision. release: the work stands (approved if it was delivered, otherwise back
     * to where it was); refund: full refund (order refunded); partial: part refunded, order
     * closed. Money moves with payments (Phase 5) from the recorded refund amount.
     */
    async resolveDispute(
      disputeId: string,
      actorId: string,
      d: { outcome: "release" | "refund" | "partial"; refundMinor?: number; note: string },
    ) {
      const o = await tx(db, async (c) => {
        const dsp = (
          await c.query<{
            id: string;
            order_id: string;
            order_status_before: string;
            status: string;
          }>("select * from disputes where id::text = $1 for update", [disputeId])
        ).rows[0];
        if (!dsp) throw new ApiError("not_found", "Dispute not found");
        if (dsp.status !== "open")
          throw new ApiError("conflict", "This dispute is already resolved");
        const o = (await loadOrder(c, dsp.order_id, true))!;
        const price = Number(o.price_minor);
        let refund = 0;
        let to: string;
        const set: Record<string, unknown> = {};
        if (d.outcome === "refund") {
          refund = price;
          to = "refunded";
          set.closed_at = new Date();
        } else if (d.outcome === "partial") {
          refund = d.refundMinor ?? 0;
          if (!(refund > 0 && refund < price))
            throw new ApiError(
              "validation",
              "A partial refund must be more than 0 and less than the price",
              "refundMinor",
            );
          to = "closed";
          set.closed_at = new Date();
        } else {
          to = ["delivered", "approved"].includes(dsp.order_status_before)
            ? "approved"
            : dsp.order_status_before;
          if (to === "approved") set.approved_at = o.approved_at ?? new Date();
        }
        await c.query(
          "update disputes set status = $2, refund_minor = $3, resolution_note = $4, resolved_by = $5, resolved_at = now() where id = $1",
          [
            dsp.id,
            d.outcome === "release"
              ? "resolved_release"
              : d.outcome === "refund"
                ? "resolved_refund"
                : "resolved_partial",
            refund,
            d.note,
            actorId,
          ],
        );
        const row = await transition(c, o, ["disputed"], to, set);
        await addEvent(c, o.id, {
          kind: "dispute_resolved",
          status: to,
          actorId,
          note: d.note,
          details: { outcome: d.outcome, refundMinor: refund },
        });
        return row;
      });
      await notify("order.dispute", o, "student", { resolved: true });
      await notify("order.dispute", o, "mentor", { resolved: true });
      return o;
    },

    async close(orderId: string, actorId: string | null, note: string) {
      const o = await tx(db, async (c) => {
        const o = await loadOrder(c, orderId, true);
        if (!o) throw new ApiError("not_found", "Order not found");
        const row = await transition(c, o, ["approved"], "closed", { closed_at: new Date() });
        await addEvent(c, o.id, { kind: "closed", status: "closed", actorId, note });
        return row;
      });
      await notify("order.closed", o, "mentor");
      return o;
    },

    /** Auto-close approved orders and remind mentors of deadlines. Run periodically. */
    async sweep() {
      const settings = await getSettings(db);
      const due = (
        await db.query<{ id: string }>(
          "select id from orders where status = 'approved' and approved_at < now() - make_interval(days => $1)",
          [settings.auto_close_days],
        )
      ).rows;
      for (const d of due)
        await api.close(d.id, null, "Closed automatically").catch(() => undefined);
      const soon = (
        await db.query<OrderRow>(
          `update orders set deadline_reminded_at = now()
            where status in ('assigned', 'in_progress', 'revision_requested') and deadline_reminded_at is null
              and deadline < now() + make_interval(hours => $1) returning *`,
          [settings.deadline_reminder_hours],
        )
      ).rows;
      for (const o of soon)
        await notify("order.deadline", o, "mentor", {
          hours: Math.max(0, Math.round((o.deadline.getTime() - Date.now()) / 3600_000)),
        });
      return { closed: due.length, reminded: soon.length };
    },
  };
  return api;
}
export type Delivery = ReturnType<typeof createDelivery>;
