import type { Queryable } from "../db.ts";
import { ApiError } from "../lib/errors.ts";

export interface CouponRow {
  id: string;
  code: string;
  kind: "percent" | "fixed";
  value: number;
  max_discount_minor: string | null;
  min_order_minor: string;
  max_uses: number | null;
  per_user: number;
  starts_at: Date | null;
  ends_at: Date | null;
  active: boolean;
  created_at: Date;
}

/** An order always costs at least this much after a discount (৳10). */
export const MIN_PRICE_AFTER_DISCOUNT = 1000;

export const normalizeCode = (code: string) => code.trim().toUpperCase();

/**
 * Checks a coupon for an order total and returns the discount. With `userId` and `lock`
 * (inside the order's transaction) usage limits are checked under a row lock, so a
 * coupon's last use can't be taken twice.
 */
export async function evaluateCoupon(
  c: Queryable,
  codeRaw: string,
  totalMinor: number,
  opts: { userId?: string; lock?: boolean } = {},
): Promise<{ coupon: CouponRow; discountMinor: number }> {
  const bad = (msg: string) => new ApiError("validation", msg, "couponCode");
  const coupon = (
    await c.query<CouponRow>(
      `select * from coupons where code = $1${opts.lock ? " for update" : ""}`,
      [normalizeCode(codeRaw)],
    )
  ).rows[0];
  const now = new Date();
  if (
    !coupon ||
    !coupon.active ||
    (coupon.starts_at && coupon.starts_at > now) ||
    (coupon.ends_at && coupon.ends_at < now)
  )
    throw bad("This coupon isn't valid");
  if (totalMinor < Number(coupon.min_order_minor))
    throw bad(`This coupon needs an order of at least ৳${Number(coupon.min_order_minor) / 100}`);
  if (coupon.max_uses !== null || opts.userId) {
    const used = (
      await c.query<{ all: number; mine: number }>(
        `select count(*)::int as all, count(*) filter (where user_id = $2)::int as mine
           from coupon_redemptions where coupon_id = $1 and status = 'active'`,
        [coupon.id, opts.userId ?? null],
      )
    ).rows[0]!;
    if (coupon.max_uses !== null && used.all >= coupon.max_uses)
      throw bad("This coupon has been used up");
    if (opts.userId && used.mine >= coupon.per_user) throw bad("You have already used this coupon");
  }
  let discount =
    coupon.kind === "percent" ? Math.floor((totalMinor * coupon.value) / 100) : coupon.value;
  if (coupon.max_discount_minor !== null)
    discount = Math.min(discount, Number(coupon.max_discount_minor));
  discount = Math.min(discount, totalMinor - MIN_PRICE_AFTER_DISCOUNT);
  if (discount <= 0) throw bad("This coupon doesn't apply to this order");
  return { coupon, discountMinor: discount };
}
