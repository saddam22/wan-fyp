import { z } from "zod";
import type { Queryable } from "../db.ts";

/** Business rules stored in platform_settings, with their allowed ranges. */
export const SETTINGS_SCHEMA = z.object({
  /** Platform share of an order (mentor gets the rest). Default 0.2 = 20/80. */
  commission_rate: z.number().min(0).max(0.5),
  /** Free revisions per order (requirement: 2–3, configurable). */
  free_revisions: z.number().int().min(0).max(10),
  courier_fee_minor: z.number().int().min(0).max(1_000_000),
  min_deadline_hours: z
    .number()
    .int()
    .min(1)
    .max(24 * 14),
  /** How long a mentor has to accept an offer. */
  offer_ttl_minutes: z
    .number()
    .int()
    .min(2)
    .max(24 * 60),
  /** Mentors offered at once per wave. */
  offer_wave_size: z.number().int().min(1).max(20),
  /** Waves before the order goes to the admin queue. */
  max_offer_waves: z.number().int().min(1).max(20),
  /** Exclusive window for a mentor the student picked. */
  preferred_mentor_minutes: z
    .number()
    .int()
    .min(5)
    .max(24 * 60),
  /** Price of a revision beyond the free ones, as a share of the order price. */
  paid_revision_fee_pct: z.number().min(0).max(1),
  max_revisions: z.number().int().min(0).max(20),
  /** Approved orders close after this many days. */
  auto_close_days: z.number().int().min(1).max(60),
  /** Smallest payout a mentor can request (owner decision; default ৳500). */
  min_payout_minor: z.number().int().min(100).max(10_000_000),
  /** The mentor is reminded this long before the deadline. */
  deadline_reminder_hours: z.number().int().min(1).max(168),
  /** Only verified mentors get order offers (recommended once enough mentors are verified). */
  require_verified_mentors: z.boolean(),
  /** Days before a failed skill test can be retaken. */
  skill_retake_days: z.number().int().min(0).max(90),
  /** Prices of paid promotions (paid from the mentor's available balance). */
  boost_7d_minor: z.number().int().min(0).max(10_000_000),
  pro_monthly_minor: z.number().int().min(0).max(10_000_000),
  pro_yearly_minor: z.number().int().min(0).max(100_000_000),
});
export type Settings = z.infer<typeof SETTINGS_SCHEMA>;
export type SettingKey = keyof Settings;
export const SETTING_KEYS = Object.keys(SETTINGS_SCHEMA.shape) as SettingKey[];

export async function getSettings(db: Queryable): Promise<Settings> {
  const rows = (
    await db.query<{ key: string; value: unknown }>("select key, value from platform_settings")
  ).rows;
  return SETTINGS_SCHEMA.parse(Object.fromEntries(rows.map((r) => [r.key, r.value])));
}
