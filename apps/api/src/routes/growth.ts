import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { tx, type Db, type Queryable } from "../db.ts";
import type { Deps } from "../deps.ts";
import { audit } from "../lib/audit.ts";
import { ApiError } from "../lib/errors.ts";
import { requireUser } from "../lib/session.ts";
import { normalizeCode, type CouponRow } from "../market/coupons.ts";
import { acct, balance, post } from "../market/ledger.ts";
import { getSettings, type Settings } from "../market/settings.ts";

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body ?? {});
  if (!r.success)
    throw new ApiError("validation", r.error.issues[0]?.message, r.error.issues[0]?.path.join("."));
  return r.data;
}
const taka = (minor: number) => `৳${(minor / 100).toLocaleString("en-US")}`;
const DAY = 86_400_000;

export const PROMOTIONS = {
  boost: { days: 7, price: (s: Settings) => s.boost_7d_minor, label: "Featured boost (7 days)" },
  pro_monthly: { days: 30, price: (s: Settings) => s.pro_monthly_minor, label: "Pro (1 month)" },
  pro_yearly: { days: 365, price: (s: Settings) => s.pro_yearly_minor, label: "Pro (1 year)" },
} as const;
type Kind = keyof typeof PROMOTIONS;

interface PromotionRow {
  id: string;
  mentor_id: string;
  kind: Kind;
  price_minor: string;
  currency: string;
  starts_at: Date;
  ends_at: Date;
  status: string;
  created_at: Date;
}
const promoDto = (p: PromotionRow, mentorName?: string | null) => ({
  id: p.id,
  mentorId: p.mentor_id,
  ...(mentorName !== undefined ? { mentorName } : {}),
  kind: p.kind,
  label: PROMOTIONS[p.kind].label,
  price: { amountMinor: Number(p.price_minor), currency: p.currency },
  startsAt: p.starts_at.toISOString(),
  endsAt: p.ends_at.toISOString(),
  status: p.status,
});

/** Ends promotions whose time is up and reminds mentors 3 days before Pro ends. No auto-renewal. */
export async function sweepPromotions(db: Db, notifications: Deps["notifications"]) {
  await db.query(
    "update mentor_promotions set status = 'expired' where status = 'active' and ends_at <= now()",
  );
  const due = (
    await db.query<PromotionRow>(
      `update mentor_promotions set reminded_at = now()
        where status = 'active' and reminded_at is null and ends_at <= now() + interval '3 days'
          and ends_at - starts_at > interval '7 days' returning *`,
    )
  ).rows;
  for (const p of due)
    await notifications.service
      .notify({
        type: "promotion.expiring",
        recipientIds: [p.mentor_id],
        actorId: null,
        payload: { link: "/mentor/promote" },
        data: { code: PROMOTIONS[p.kind].label, title: "" },
      })
      .catch(() => undefined);
}

/** Paid promotions (from the mentor's earnings, through the ledger) and coupons. */
export const growthRoutes: FastifyPluginAsync<Deps> = async (app, { db, config, hub }) => {
  // ---- Promotions ---------------------------------------------------------------------

  app.get("/mentor/promotions", async (req) => {
    const s = await requireUser(db, config, hub, req, "/mentor");
    const settings = await getSettings(db);
    const rows = (
      await db.query<PromotionRow>(
        "select * from mentor_promotions where mentor_id = $1 order by created_at desc limit 50",
        [s.user.id],
      )
    ).rows;
    return {
      currency: "BDT",
      availableMinor: -(await balance(db, acct.available(s.user.id))),
      plans: (Object.keys(PROMOTIONS) as Kind[]).map((k) => ({
        kind: k,
        label: PROMOTIONS[k].label,
        days: PROMOTIONS[k].days,
        priceMinor: PROMOTIONS[k].price(settings),
      })),
      items: rows.map((p) => promoDto(p)),
    };
  });

  /** Buy a promotion with available earnings. A renewal starts when the current one ends. */
  app.post("/mentor/promotions", async (req, reply) => {
    const s = await requireUser(db, config, hub, req, "/mentor");
    const b = parse(z.object({ kind: z.enum(["boost", "pro_monthly", "pro_yearly"]) }), req.body);
    const p = await tx(db, async (c) => {
      // Same lock as payouts: the balance can't be spent twice.
      await c.query("select pg_advisory_xact_lock(4246, hashtext($1))", [s.user.id]);
      const settings = await getSettings(c);
      const price = PROMOTIONS[b.kind].price(settings);
      const available = -(await balance(c, acct.available(s.user.id)));
      if (price > available)
        throw new ApiError(
          "validation",
          `This costs ${taka(price)}; you have ${taka(available)} available`,
          "kind",
        );
      const family = b.kind === "boost" ? ["boost"] : ["pro_monthly", "pro_yearly"];
      const last = (
        await c.query<{ ends_at: Date }>(
          "select max(ends_at) as ends_at from mentor_promotions where mentor_id = $1 and status = 'active' and kind = any($2::text[])",
          [s.user.id, family],
        )
      ).rows[0]?.ends_at;
      const start = last && last > new Date() ? last : new Date();
      const row = (
        await c.query<PromotionRow>(
          `insert into mentor_promotions (mentor_id, kind, price_minor, starts_at, ends_at)
           values ($1, $2, $3, $4, $5) returning *`,
          [
            s.user.id,
            b.kind,
            price,
            start,
            new Date(start.getTime() + PROMOTIONS[b.kind].days * DAY),
          ],
        )
      ).rows[0]!;
      await post(
        c,
        {
          key: `promotion:${row.id}:bought`,
          kind: "promotion_bought",
          memo: PROMOTIONS[b.kind].label,
          promotionId: row.id,
          actorId: s.user.id,
        },
        [
          { account: acct.available(s.user.id), amountMinor: price },
          { account: acct.promotions, amountMinor: -price },
        ],
      );
      await audit(c, {
        actorId: s.user.id,
        action: "promotion.buy",
        target: row.id,
        details: { kind: b.kind, priceMinor: price },
        ip: req.ip,
      });
      return row;
    });
    return reply.code(201).send(promoDto(p));
  });

  app.get("/admin/promotions", async (req) => {
    await requireUser(db, config, hub, req, "/admin/boosts");
    const rows = (
      await db.query<PromotionRow & { name: string }>(
        "select m.*, u.name from mentor_promotions m join users u on u.id = m.mentor_id order by m.created_at desc limit 300",
      )
    ).rows;
    return rows.map((p) => promoDto(p, p.name));
  });

  /** Stop a promotion (e.g. misleading profile); the unused days go back to the mentor. */
  app.post<{ Params: { id: string } }>("/admin/promotions/:id/cancel", async (req) => {
    const s = await requireUser(db, config, hub, req, "/admin/boosts");
    const b = parse(z.object({ note: z.string().trim().min(3).max(300) }), req.body);
    const p = await tx(db, async (c) => {
      const p = (
        await c.query<PromotionRow>(
          "select * from mentor_promotions where id::text = $1 for update",
          [req.params.id],
        )
      ).rows[0];
      if (!p) throw new ApiError("not_found");
      if (p.status !== "active") throw new ApiError("conflict", "This promotion isn't active");
      const total = p.ends_at.getTime() - p.starts_at.getTime();
      const left = Math.max(0, p.ends_at.getTime() - Math.max(Date.now(), p.starts_at.getTime()));
      const back = Math.floor((Number(p.price_minor) * left) / total);
      await c.query("update mentor_promotions set status = 'cancelled' where id = $1", [p.id]);
      await post(
        c,
        {
          key: `promotion:${p.id}:cancelled`,
          kind: "promotion_refunded",
          memo: `Promotion stopped: ${b.note}`,
          promotionId: p.id,
          actorId: s.user.id,
        },
        [
          { account: acct.promotions, amountMinor: back },
          { account: acct.available(p.mentor_id), amountMinor: -back },
        ],
      );
      await audit(c, {
        actorId: s.user.id,
        action: "promotion.cancel",
        target: p.id,
        details: { note: b.note, refundedMinor: back },
        ip: req.ip,
      });
      return (await c.query<PromotionRow>("select * from mentor_promotions where id = $1", [p.id]))
        .rows[0]!;
    });
    return promoDto(p);
  });

  // ---- Coupons ------------------------------------------------------------------------

  const couponBody = z.object({
    code: z.string().trim().min(3).max(24),
    kind: z.enum(["percent", "fixed"]),
    /** Percent (1–100) or an amount in paisa. */
    value: z.number().int().min(1).max(100_000_000),
    maxDiscountMinor: z.number().int().min(1).nullable().default(null),
    minOrderMinor: z.number().int().min(0).default(0),
    maxUses: z.number().int().min(1).nullable().default(null),
    perUser: z.number().int().min(1).max(100).default(1),
    startsAt: z.iso.datetime({ offset: true }).nullable().default(null),
    endsAt: z.iso.datetime({ offset: true }).nullable().default(null),
    active: z.boolean().default(true),
  });

  const couponDto = async (c: Queryable, r: CouponRow) => {
    const u = (
      await c.query<{ n: number; total: string }>(
        "select count(*)::int as n, coalesce(sum(discount_minor), 0) as total from coupon_redemptions where coupon_id = $1 and status = 'active'",
        [r.id],
      )
    ).rows[0]!;
    return {
      id: r.id,
      code: r.code,
      kind: r.kind,
      value: r.value,
      maxDiscountMinor: r.max_discount_minor === null ? null : Number(r.max_discount_minor),
      minOrderMinor: Number(r.min_order_minor),
      maxUses: r.max_uses,
      perUser: r.per_user,
      startsAt: r.starts_at?.toISOString() ?? null,
      endsAt: r.ends_at?.toISOString() ?? null,
      active: r.active,
      uses: u.n,
      discountGivenMinor: Number(u.total),
    };
  };

  const checked = (b: z.infer<typeof couponBody>) => {
    const code = normalizeCode(b.code);
    if (!/^[A-Z0-9_-]{3,24}$/.test(code))
      throw new ApiError("validation", "Use letters, numbers, - or _", "code");
    if (b.kind === "percent" && b.value > 100)
      throw new ApiError("validation", "A percentage is at most 100", "value");
    if (b.startsAt && b.endsAt && new Date(b.endsAt) <= new Date(b.startsAt))
      throw new ApiError("validation", "The end must be after the start", "endsAt");
    return code;
  };

  app.get("/admin/coupons", async (req) => {
    await requireUser(db, config, hub, req, "/admin/coupons");
    const rows = (await db.query<CouponRow>("select * from coupons order by created_at desc")).rows;
    return Promise.all(rows.map((r) => couponDto(db, r)));
  });

  app.post("/admin/coupons", async (req, reply) => {
    const s = await requireUser(db, config, hub, req, "/admin/coupons");
    const b = parse(couponBody, req.body);
    const code = checked(b);
    let row: CouponRow;
    try {
      row = (
        await db.query<CouponRow>(
          `insert into coupons (code, kind, value, max_discount_minor, min_order_minor, max_uses, per_user, starts_at, ends_at, active, created_by)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning *`,
          [
            code,
            b.kind,
            b.value,
            b.maxDiscountMinor,
            b.minOrderMinor,
            b.maxUses,
            b.perUser,
            b.startsAt,
            b.endsAt,
            b.active,
            s.user.id,
          ],
        )
      ).rows[0]!;
    } catch (e) {
      if ((e as { code?: string }).code === "23505")
        throw new ApiError("conflict", "This code already exists", "code");
      throw e;
    }
    await audit(db, {
      actorId: s.user.id,
      action: "coupon.create",
      target: row.id,
      details: b,
      ip: req.ip,
    });
    return reply.code(201).send(await couponDto(db, row));
  });

  /** Change limits, dates or switch off. The code and the discount stay as issued. */
  app.put<{ Params: { id: string } }>("/admin/coupons/:id", async (req) => {
    const s = await requireUser(db, config, hub, req, "/admin/coupons");
    const b = parse(
      couponBody.pick({ maxUses: true, perUser: true, startsAt: true, endsAt: true, active: true }),
      req.body,
    );
    const row = (
      await db.query<CouponRow>(
        "update coupons set max_uses = $2, per_user = $3, starts_at = $4, ends_at = $5, active = $6 where id::text = $1 returning *",
        [req.params.id, b.maxUses, b.perUser, b.startsAt, b.endsAt, b.active],
      )
    ).rows[0];
    if (!row) throw new ApiError("not_found");
    await audit(db, {
      actorId: s.user.id,
      action: "coupon.update",
      target: row.id,
      details: b,
      ip: req.ip,
    });
    return couponDto(db, row);
  });
};
