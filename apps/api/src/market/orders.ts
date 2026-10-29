import type { Role } from "@edukhata/contracts";
import type { Queryable } from "../db.ts";
import { ApiError } from "../lib/errors.ts";
import type { SessionCtx } from "../lib/session.ts";
import { getSettings } from "./settings.ts";

export const STAFF: Role[] = ["supporter", "accountant", "admin", "super_admin"];
/** Statuses in which a mentor is working on the order (count against capacity). */
export const ACTIVE_STATUSES = [
  "assigned",
  "in_progress",
  "delivered",
  "revision_requested",
] as const;
/** Before a mentor is assigned (the student may still cancel). */
export const OPEN_STATUSES = ["awaiting_payment", "payment_review", "matching"] as const;
export const TERMINAL_STATUSES = ["closed", "cancelled", "refunded"] as const;

export interface OrderRow {
  id: string;
  code: string;
  student_id: string;
  mentor_id: string | null;
  preferred_mentor_id: string | null;
  category_slug: string;
  subject_id: string;
  level: string;
  work_type: string;
  title: string;
  instructions: string;
  pages: number;
  delivery_method: "digital" | "courier";
  delivery_address: string | null;
  deadline: Date;
  price_minor: string;
  currency: string;
  commission_rate: string;
  free_revisions: number;
  status: string;
  match_wave: number;
  needs_manual_assignment: boolean;
  created_at: Date;
  updated_at: Date;
  assigned_at: Date | null;
  delivered_at: Date | null;
  approved_at: Date | null;
  closed_at: Date | null;
  cancelled_at: Date | null;
}

export type Relation = "student" | "mentor" | "guardian" | "staff";

export async function loadOrder(db: Queryable, id: string, lock = false): Promise<OrderRow | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  return (
    (
      await db.query<OrderRow>(`select * from orders where id = $1${lock ? " for update" : ""}`, [
        id,
      ])
    ).rows[0] ?? null
  );
}

/**
 * How the signed-in person relates to an order. Guardians need the student's
 * "view orders" permission. Mentors only see orders assigned to them (offers are
 * shown through /mentor/offers).
 */
export async function relationTo(
  db: Queryable,
  o: OrderRow,
  s: SessionCtx,
): Promise<Relation | null> {
  if (o.student_id === s.user.id) return "student";
  if (o.mentor_id && o.mentor_id === s.user.id) return "mentor";
  if (s.roles.some((r) => STAFF.includes(r))) return "staff";
  if (s.roles.includes("guardian")) {
    const g = await db.query(
      "select 1 from guardian_links where guardian_id = $1 and student_id = $2 and view_orders",
      [s.user.id, o.student_id],
    );
    if (g.rowCount) return "guardian";
  }
  return null;
}

/** The order, or 404 (also when it exists but isn't the person's — no probing). */
export async function orderFor(db: Queryable, id: string, s: SessionCtx, lock = false) {
  const o = await loadOrder(db, id, lock);
  const rel = o ? await relationTo(db, o, s) : null;
  if (!o || !rel) throw new ApiError("not_found", "Order not found");
  return { o, rel };
}

export async function addEvent(
  db: Queryable,
  orderId: string,
  e: { kind: string; status: string; actorId: string | null; note?: string; details?: object },
) {
  await db.query(
    "insert into order_events (order_id, kind, status, actor_id, note, details) values ($1, $2, $3, $4, $5, $6)",
    [
      orderId,
      e.kind,
      e.status,
      e.actorId,
      e.note ?? "",
      e.details ? JSON.stringify(e.details) : null,
    ],
  );
}

/**
 * Moves an order from one of `from` to `to` in one conditional UPDATE, so two requests
 * can never both move it (the loser gets 409). `set` adds column assignments.
 */
export async function transition(
  db: Queryable,
  o: OrderRow,
  from: readonly string[],
  to: string,
  set: Record<string, unknown> = {},
): Promise<OrderRow> {
  const cols = Object.keys(set);
  const assign = cols.map((c, i) => `${c} = $${i + 4}`).join(", ");
  const r = await db.query<OrderRow>(
    `update orders set status = $2, updated_at = now()${assign ? `, ${assign}` : ""}
      where id = $1 and status = any($3::text[]) returning *`,
    [o.id, to, [...from], ...cols.map((c) => set[c])],
  );
  const row = r.rows[0];
  if (!row) throw new ApiError("conflict", "The order changed meanwhile — reload and try again");
  return row;
}

export async function quote(
  db: Queryable,
  input: { workType: string; pages: number; deliveryMethod: "digital" | "courier" },
) {
  const p = (
    await db.query<{ per_page_minor: string; currency: string }>(
      "select per_page_minor, currency from price_list where work_type = $1",
      [input.workType],
    )
  ).rows[0];
  if (!p) throw new ApiError("validation", "Unknown type of work", "workType");
  const settings = await getSettings(db);
  const baseMinor = Number(p.per_page_minor) * input.pages;
  const courierMinor = input.deliveryMethod === "courier" ? settings.courier_fee_minor : 0;
  return {
    currency: p.currency,
    perPageMinor: Number(p.per_page_minor),
    baseMinor,
    courierMinor,
    totalMinor: baseMinor + courierMinor,
    settings,
  };
}

/** Mentor share of an order, rounded down to whole paisa (the platform keeps the rest). */
export const mentorShare = (priceMinor: number, rate: number) =>
  Math.floor(priceMinor * (1 - rate));

export async function names(db: Queryable, ids: (string | null)[]) {
  const list = ids.filter((x): x is string => !!x);
  const rows = (
    await db.query<{ id: string; name: string }>(
      "select id, name from users where id = any($1::uuid[])",
      [list],
    )
  ).rows;
  return new Map(rows.map((r) => [r.id, r.name]));
}

/** Order as the contracts' `Order` type, shaped for the viewer's relation. */
export async function orderDto(db: Queryable, o: OrderRow, rel: Relation) {
  const dispute = (
    await db.query<{
      id: string;
      status: string;
      reason: string;
      opened_at: Date;
      resolved_at: Date | null;
      resolution_note: string | null;
      refund_minor: string | null;
    }>(
      "select id, status, reason, opened_at, resolved_at, resolution_note, refund_minor from disputes where order_id = $1 order by opened_at desc limit 1",
      [o.id],
    )
  ).rows[0];
  const [nm, files, revisions, events] = await Promise.all([
    names(db, [o.student_id, o.mentor_id]),
    db.query<{
      id: string;
      name: string;
      content_type: string;
      byte_size: string;
      stage: string;
      round: number;
      uploaded_by: string;
      created_at: Date;
    }>(
      "select id, name, content_type, byte_size, stage, round, uploaded_by, created_at from order_files where order_id = $1 and status = 'ready' order by created_at",
      [o.id],
    ),
    db.query<{
      n: number;
      instructions: string;
      paid: boolean;
      requested_at: Date;
      resolved_at: Date | null;
      fee_minor: string;
      payment_status: string;
    }>(
      "select n, instructions, paid, requested_at, resolved_at, fee_minor, payment_status from order_revisions where order_id = $1 order by n",
      [o.id],
    ),
    db.query<{ at: Date; kind: string; status: string; note: string; actor_id: string | null }>(
      "select at, kind, status, note, actor_id from order_events where order_id = $1 order by id",
      [o.id],
    ),
  ]);
  const actorNames = await names(
    db,
    events.rows.map((e) => e.actor_id),
  );
  const price = Number(o.price_minor);
  const rate = Number(o.commission_rate);
  // Finals unlock for the student side only after approval (previews before).
  const finalsVisible =
    rel === "mentor" || rel === "staff" || ["approved", "closed"].includes(o.status);
  const kindOf = (t: string) =>
    t === "application/pdf"
      ? "pdf"
      : t.startsWith("image/")
        ? "image"
        : t === "application/zip"
          ? "zip"
          : "doc";
  return {
    id: o.id,
    code: o.code,
    title: o.title,
    categorySlug: o.category_slug,
    subject: o.subject_id,
    level: o.level,
    workType: o.work_type,
    pages: o.pages,
    instructions: o.instructions,
    studentId: o.student_id,
    studentName: nm.get(o.student_id) ?? "",
    ...(o.mentor_id ? { mentorId: o.mentor_id, mentorName: nm.get(o.mentor_id) ?? "" } : {}),
    status: o.status,
    price: { amountMinor: price, currency: o.currency },
    commissionRate: rate,
    // The mentor and staff see the mentor's share; students and guardians see the price.
    ...(rel === "mentor" || rel === "staff"
      ? { payout: { amountMinor: mentorShare(price, rate), currency: o.currency } }
      : {}),
    createdAt: o.created_at.toISOString(),
    deadline: o.deadline.toISOString(),
    ...(o.delivered_at ? { deliveredAt: o.delivered_at.toISOString() } : {}),
    freeRevisions: o.free_revisions,
    revisions: revisions.rows.map((r) => ({
      n: r.n,
      requestedAt: r.requested_at.toISOString(),
      instructions: r.instructions,
      paid: r.paid,
      feeMinor: Number(r.fee_minor),
      paymentStatus: r.payment_status,
      ...(r.resolved_at ? { resolvedAt: r.resolved_at.toISOString() } : {}),
    })),
    dispute: dispute
      ? {
          id: dispute.id,
          status: dispute.status,
          reason: dispute.reason,
          openedAt: dispute.opened_at.toISOString(),
          ...(dispute.resolved_at
            ? {
                resolvedAt: dispute.resolved_at.toISOString(),
                resolutionNote: dispute.resolution_note,
                refundMinor: Number(dispute.refund_minor ?? 0),
              }
            : {}),
        }
      : null,
    files: files.rows
      .filter((f) => f.stage !== "final" || finalsVisible)
      .map((f) => ({
        id: f.id,
        name: f.name,
        kind: kindOf(f.content_type),
        sizeKb: Math.max(1, Math.round(Number(f.byte_size) / 1024)),
        uploadedBy: f.uploaded_by === o.student_id ? "student" : "mentor",
        at: f.created_at.toISOString(),
        stage: f.stage,
        round: f.round,
      })),
    timeline: events.rows.map((e) => ({
      at: e.at.toISOString(),
      status: e.status,
      kind: e.kind,
      note: e.note,
      actor: e.actor_id ? (actorNames.get(e.actor_id) ?? "") : "EduKhata",
    })),
    deliveryMethod: o.delivery_method,
    // The address is for the assigned mentor (courier delivery) and staff only.
    ...(o.delivery_address && (rel !== "mentor" || o.delivery_method === "courier")
      ? { deliveryAddress: o.delivery_address }
      : {}),
    needsManualAssignment: rel === "staff" ? o.needs_manual_assignment : undefined,
  };
}

/** Where each side opens an order (notification links). */
export const orderLink = (who: "student" | "mentor" | "guardian" | "admin", id: string) =>
  who === "admin" ? `/admin/orders/${id}` : `/${who}/orders/${id}`;
