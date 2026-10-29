import type { Db, Queryable } from "../db.ts";
import { tx } from "../db.ts";
import type { Deps } from "../deps.ts";
import { ApiError } from "../lib/errors.ts";
import {
  ACTIVE_STATUSES,
  addEvent,
  loadOrder,
  mentorShare,
  orderLink,
  transition,
  type OrderRow,
} from "./orders.ts";
import { getSettings } from "./settings.ts";

type Notifications = Deps["notifications"];
type Logger = { error(o: object, m?: string): void };

export interface Candidate {
  id: string;
  name: string;
  activeOrders: number;
  capacity: number;
  completedOrders: number;
  rating: number | null;
  onTimeRate: number | null;
  score: number;
}

/**
 * Mentors who may take the order now: active, mentor role, available, subject + type of
 * work (+ level when they set levels), below capacity, not the student, not offered yet.
 * Ranked by organic signals only (never paid input): rating, on-time rate, load, experience.
 */
export async function candidates(
  db: Queryable,
  o: OrderRow,
  limit = 50,
  includeOffered = false,
): Promise<Candidate[]> {
  const verifiedOnly = (await getSettings(db)).require_verified_mentors;
  const rows = (
    await db.query<{
      id: string;
      name: string;
      capacity: number;
      active: number;
      completed: number;
      rating: string | null;
      on_time: string | null;
      last_assigned_at: Date | null;
      verified: boolean;
    }>(
      `with stats as (
         select u.id, u.name, p.capacity, p.last_assigned_at, p.verified_at is not null as verified,
           (select count(*)::int from orders x where x.mentor_id = u.id and x.status = any($5::text[])) as active,
           (select count(*)::int from orders x where x.mentor_id = u.id and x.status in ('approved', 'closed')) as completed,
           (select avg(rating) from reviews v where v.mentor_id = u.id and v.status = 'published') as rating,
           (select avg(case when x.delivered_at <= x.deadline then 1 else 0 end)
              from orders x where x.mentor_id = u.id and x.delivered_at is not null) as on_time
         from users u
         join user_roles r on r.user_id = u.id and r.role = 'mentor'
         join mentor_profiles p on p.user_id = u.id
         where u.status = 'active' and p.available and u.id <> $1
           and $2 = any(p.subjects) and $3 = any(p.work_types)
           and (cardinality(p.levels) = 0 or $4 = any(p.levels))
           and ($7 or not exists (select 1 from order_offers f where f.order_id = $6 and f.mentor_id = u.id))
           and (not $8 or p.verified_at is not null)
       )
       select * from stats where active < capacity`,
      [
        o.student_id,
        o.subject_id,
        o.work_type,
        o.level,
        [...ACTIVE_STATUSES],
        o.id,
        includeOffered,
        verifiedOnly,
      ],
    )
  ).rows;
  const scored = rows.map((r) => {
    const rating = r.rating === null ? null : Number(r.rating);
    const onTime = r.on_time === null ? null : Number(r.on_time);
    // Neutral defaults for new mentors, so they get a fair chance.
    const score =
      0.4 * ((rating ?? 3.5) / 5) +
      0.3 * (onTime ?? 0.8) +
      0.2 * (1 - r.active / r.capacity) +
      0.1 * (Math.min(r.completed, 20) / 20) +
      // Verified identity and qualifications (checked by staff). Paid promotions never count.
      (r.verified ? 0.1 : 0);
    return {
      c: {
        id: r.id,
        name: r.name,
        activeOrders: r.active,
        capacity: r.capacity,
        completedOrders: r.completed,
        rating,
        onTimeRate: onTime,
        score: Math.round(score * 1000) / 1000,
      },
      last: r.last_assigned_at?.getTime() ?? 0,
    };
  });
  // Best score first; ties go to whoever was assigned least recently.
  scored.sort((a, b) => b.c.score - a.c.score || a.last - b.last || a.c.id.localeCompare(b.c.id));
  return scored.slice(0, limit).map((x) => x.c);
}

export interface MatchingHooks {
  /** After a mentor is assigned (commit done): e.g. open the order's chat. */
  onAssigned?(o: OrderRow): Promise<void>;
}

export function createMatching(
  db: Db,
  notifications: Notifications,
  logger: Logger,
  hooks: MatchingHooks = {},
) {
  const admins = async () =>
    (
      await db.query<{ user_id: string }>(
        "select distinct user_id from user_roles where role in ('admin', 'super_admin')",
      )
    ).rows.map((r) => r.user_id);

  type After = () => Promise<void>;
  const run = async (fns: After[]) => {
    for (const f of fns)
      await f().catch((err: unknown) => logger.error({ err }, "matching notification failed"));
  };

  /** Next wave of offers for an order (inside the caller's transaction, order locked). */
  async function wave(c: Queryable, o: OrderRow, after: After[]): Promise<void> {
    if (o.status !== "matching" || o.mentor_id || o.needs_manual_assignment) return;
    const open = Number(
      (
        await c.query(
          "select count(*) from order_offers where order_id = $1 and status = 'offered'",
          [o.id],
        )
      ).rows[0].count,
    );
    if (open > 0) return;
    const settings = await getSettings(c);
    const n = o.match_wave + 1;
    let picks: Candidate[] = [];
    let ttlMinutes = settings.offer_ttl_minutes;
    if (n === 1 && o.preferred_mentor_id) {
      // The mentor the student chose gets an exclusive first window.
      picks = (await candidates(c, o, 200)).filter((x) => x.id === o.preferred_mentor_id);
      ttlMinutes = settings.preferred_mentor_minutes;
    }
    if (picks.length === 0) picks = await candidates(c, o, settings.offer_wave_size);
    if (n > settings.max_offer_waves || picks.length === 0) {
      await c.query(
        "update orders set needs_manual_assignment = true, updated_at = now() where id = $1",
        [o.id],
      );
      await addEvent(c, o.id, {
        kind: "needs_assignment",
        status: o.status,
        actorId: null,
        note: picks.length === 0 ? "No eligible mentor available" : "No mentor accepted in time",
      });
      after.push(async () => {
        await notifications.service.notify({
          type: "order.needs_assignment",
          recipientIds: await admins(),
          actorId: null,
          payload: { link: orderLink("admin", o.id) },
          data: { code: o.code, title: o.title },
          dedupeKey: `needs:${o.id}`,
        });
      });
      return;
    }
    const expires = new Date(Date.now() + ttlMinutes * 60_000);
    for (const p of picks) {
      await c.query(
        "insert into order_offers (order_id, mentor_id, wave, score, expires_at) values ($1, $2, $3, $4, $5)",
        [o.id, p.id, n, p.score, expires],
      );
    }
    await c.query("update orders set match_wave = $2, updated_at = now() where id = $1", [o.id, n]);
    await addEvent(c, o.id, {
      kind: "offered",
      status: o.status,
      actorId: null,
      note: `Offered to ${picks.length} mentor(s)`,
      details: { wave: n },
    });
    after.push(async () => {
      await notifications.service.notify({
        type: "order.offer",
        recipientIds: picks.map((p) => p.id),
        actorId: null,
        payload: { link: "/mentor/offers" },
        data: { code: o.code, title: o.title },
        dedupeKey: `offer:${o.id}:${n}`,
      });
    });
  }

  async function notifyAssigned(o: OrderRow) {
    await hooks.onAssigned?.(o);
    const m = (
      await db.query<{ name: string }>("select name from users where id = $1", [o.mentor_id])
    ).rows[0];
    await notifications.service.notify({
      type: "order.assigned",
      recipientIds: [o.student_id],
      actorId: o.mentor_id,
      payload: { link: orderLink("student", o.id) },
      data: { code: o.code, title: o.title, mentor: m?.name ?? "" },
    });
  }

  async function notifyUnassigned(o: OrderRow, mentorId: string) {
    await notifications.service.notify({
      type: "order.unassigned",
      recipientIds: [mentorId],
      actorId: null,
      payload: { link: "/mentor/orders" },
      data: { code: o.code, title: o.title },
    });
  }

  async function withOrder<T>(
    orderId: string,
    fn: (c: Queryable, o: OrderRow, after: After[]) => Promise<T>,
  ): Promise<T> {
    const after: After[] = [];
    const result = await tx(db, async (c) => {
      const o = await loadOrder(c, orderId, true);
      if (!o) throw new ApiError("not_found", "Order not found");
      return fn(c, o, after);
    });
    await run(after);
    return result;
  }

  return {
    /** Sends the first (or next) wave for an order already in matching. */
    kick(orderId: string) {
      return withOrder(orderId, (c, o, after) => wave(c, o, after));
    },

    /** Moves a paid order into matching (no wave yet); call kick() after commit. */
    async enterMatchingTx(c: Queryable, o: OrderRow, actorId: string | null) {
      const row = await transition(c, o, ["awaiting_payment", "payment_review"], "matching", {
        matching_started_at: new Date(),
      });
      await addEvent(c, o.id, {
        kind: "matching",
        status: "matching",
        actorId,
        note: "Payment approved — looking for a mentor",
      });
      return row;
    },

    /** Called when payment is approved (Phase 5): the order starts looking for a mentor. */
    startMatching(orderId: string, actorId: string | null) {
      return withOrder(orderId, async (c, o, after) => {
        const row = await transition(c, o, ["awaiting_payment", "payment_review"], "matching", {
          matching_started_at: new Date(),
        });
        await addEvent(c, o.id, {
          kind: "matching",
          status: "matching",
          actorId,
          note: "Looking for a mentor",
        });
        await wave(c, row, after);
        return row;
      });
    },

    /** A mentor accepts. Exactly one acceptance can win; the rest get 409. */
    async accept(offerId: string, mentorId: string) {
      const offer = (
        await db.query<{ order_id: string }>(
          "select order_id from order_offers where id::text = $1 and mentor_id = $2",
          [offerId, mentorId],
        )
      ).rows[0];
      if (!offer) throw new ApiError("not_found", "Offer not found");
      const after: After[] = [];
      const row = await tx(db, async (c) => {
        // Lock order: mentor (capacity) → order → offer, the same everywhere.
        await c.query("select pg_advisory_xact_lock(4245, hashtext($1))", [mentorId]);
        const o = await loadOrder(c, offer.order_id, true);
        const f = (
          await c.query<{ status: string; expired: boolean }>(
            "select status, expires_at <= now() as expired from order_offers where id = $1 for update",
            [offerId],
          )
        ).rows[0];
        if (!o || !f) throw new ApiError("not_found", "Offer not found");
        if (f.status !== "offered" || f.expired || o.status !== "matching" || o.mentor_id)
          throw new ApiError("conflict", "This offer is no longer available");
        const cap = (
          await c.query<{ ok: boolean }>(
            `select (select count(*) from orders where mentor_id = $1 and status = any($2::text[])) < p.capacity and p.available as ok
               from mentor_profiles p where p.user_id = $1`,
            [mentorId, [...ACTIVE_STATUSES]],
          )
        ).rows[0];
        if (!cap?.ok)
          throw new ApiError(
            "conflict",
            "You're at your order limit — finish an order or raise your capacity",
          );
        const assigned = await transition(c, o, ["matching"], "assigned", {
          mentor_id: mentorId,
          assigned_at: new Date(),
          needs_manual_assignment: false,
        });
        await c.query(
          "update order_offers set status = 'accepted', responded_at = now() where id = $1",
          [offerId],
        );
        await c.query(
          "update order_offers set status = 'withdrawn', responded_at = now() where order_id = $1 and status = 'offered'",
          [o.id],
        );
        await c.query("update mentor_profiles set last_assigned_at = now() where user_id = $1", [
          mentorId,
        ]);
        await addEvent(c, o.id, {
          kind: "assigned",
          status: "assigned",
          actorId: mentorId,
          note: "Mentor accepted the order",
        });
        after.push(() => notifyAssigned(assigned));
        return assigned;
      });
      await run(after);
      return row;
    },

    async decline(offerId: string, mentorId: string) {
      const offer = (
        await db.query<{ order_id: string }>(
          "select order_id from order_offers where id::text = $1 and mentor_id = $2",
          [offerId, mentorId],
        )
      ).rows[0];
      if (!offer) throw new ApiError("not_found", "Offer not found");
      await withOrder(offer.order_id, async (c, o, after) => {
        const r = await c.query(
          "update order_offers set status = 'declined', responded_at = now() where id = $1 and status = 'offered'",
          [offerId],
        );
        if (!r.rowCount) throw new ApiError("conflict", "This offer is no longer open");
        await wave(c, o, after);
      });
    },

    /** Expires old offers and sends the next wave where nobody is left to answer. */
    async sweep(): Promise<number> {
      await db.query(
        "update order_offers set status = 'expired', responded_at = now() where status = 'offered' and expires_at <= now()",
      );
      const due = (
        await db.query<{ id: string }>(
          `select o.id from orders o where o.status = 'matching' and o.mentor_id is null and not o.needs_manual_assignment
             and not exists (select 1 from order_offers f where f.order_id = o.id and f.status = 'offered')`,
        )
      ).rows;
      for (const d of due)
        await withOrder(d.id, (c, o, after) => wave(c, o, after)).catch((err: unknown) =>
          logger.error({ err }, "matching wave failed"),
        );
      return due.length;
    },

    /**
     * Admin assignment: for an order in matching (manual queue) or a reassignment of an
     * order in progress. Capacity and eligibility (role, active) are still enforced.
     */
    async assign(orderId: string, mentorId: string, actorId: string, note: string) {
      const after: After[] = [];
      const row = await tx(db, async (c) => {
        await c.query("select pg_advisory_xact_lock(4245, hashtext($1))", [mentorId]);
        const o = await loadOrder(c, orderId, true);
        if (!o) throw new ApiError("not_found", "Order not found");
        if (o.mentor_id === mentorId)
          throw new ApiError("conflict", "That mentor already has this order");
        const ok = (await candidates(c, o, 500, true)).some((x) => x.id === mentorId);
        if (!ok)
          throw new ApiError(
            "validation",
            "That mentor can't take this order (subject, type of work, availability or capacity)",
            "mentorId",
          );
        const previous = o.mentor_id;
        const from = previous ? ["assigned", "in_progress", "revision_requested"] : ["matching"];
        // Reassigned work restarts with the new mentor (status assigned).
        const assigned = await transition(c, o, from, "assigned", {
          mentor_id: mentorId,
          assigned_at: new Date(),
          needs_manual_assignment: false,
        });
        await c.query(
          "update order_offers set status = 'withdrawn', responded_at = now() where order_id = $1 and status = 'offered'",
          [o.id],
        );
        await c.query(
          `insert into order_offers (order_id, mentor_id, wave, status, expires_at, responded_at) values ($1, $2, $3, 'accepted', now(), now())
           on conflict (order_id, mentor_id) do update set status = 'accepted', responded_at = now()`,
          [o.id, mentorId, o.match_wave],
        );
        await c.query("update mentor_profiles set last_assigned_at = now() where user_id = $1", [
          mentorId,
        ]);
        await addEvent(c, o.id, {
          kind: previous ? "reassigned" : "assigned",
          status: "assigned",
          actorId,
          note: note || (previous ? "Reassigned by EduKhata" : "Assigned by EduKhata"),
          details: { mentorId, previous },
        });
        after.push(async () => {
          await notifyAssigned(assigned);
          if (previous) await notifyUnassigned(assigned, previous);
        });
        return assigned;
      });
      await run(after);
      return row;
    },

    /**
     * Takes the order away from its mentor and looks again (staff reassignment without a
     * chosen mentor, or a mentor releasing an order they haven't started).
     */
    unassign(orderId: string, actorId: string, note: string, from: readonly string[]) {
      return withOrder(orderId, async (c, o, after) => {
        if (!o.mentor_id) throw new ApiError("conflict", "No mentor is assigned");
        const previous = o.mentor_id;
        const row = await transition(c, o, from, "matching", {
          mentor_id: null,
          assigned_at: null,
          match_wave: 0,
          needs_manual_assignment: false,
        });
        await addEvent(c, o.id, {
          kind: "unassigned",
          status: "matching",
          actorId,
          note,
          details: { previous },
        });
        await wave(c, row, after);
        if (actorId !== previous) after.push(() => notifyUnassigned(o, previous));
        return row;
      });
    },

    /** The mentor's open offers. */
    async offersFor(mentorId: string) {
      const rows = (
        await db.query<OrderRow & { offer_id: string; expires_at: Date; score: string }>(
          `select o.*, f.id as offer_id, f.expires_at as expires_at, f.score from order_offers f join orders o on o.id = f.order_id
            where f.mentor_id = $1 and f.status = 'offered' and f.expires_at > now() and o.status = 'matching'
            order by f.expires_at`,
          [mentorId],
        )
      ).rows;
      return rows.map((o) => ({
        id: o.offer_id,
        orderId: o.id,
        orderCode: o.code,
        title: o.title,
        subject: o.subject_id,
        workType: o.work_type,
        level: o.level,
        pages: o.pages,
        instructions: o.instructions,
        deliveryMethod: o.delivery_method,
        payout: {
          amountMinor: mentorShare(Number(o.price_minor), Number(o.commission_rate)),
          currency: o.currency,
        },
        deadline: o.deadline.toISOString(),
        expiresAt: o.expires_at.toISOString(),
        matchScore: Number(o.score),
      }));
    },
  };
}
export type Matching = ReturnType<typeof createMatching>;
