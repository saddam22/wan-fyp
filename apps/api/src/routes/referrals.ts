import { randomInt } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import type { ReferralSummary, Role } from "@edukhata/contracts";
import type { Queryable } from "../db.ts";
import type { Deps } from "../deps.ts";
import { ApiError } from "../lib/errors.ts";
import { requireUser, rolesOf } from "../lib/session.ts";

/** Set by the web app when someone opens a ?ref= link (first link wins, 30 days). */
export const REF_COOKIE = "ek_ref";
const STAFF: Role[] = ["supporter", "accountant", "admin", "super_admin"];
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const normalizeRefCode = (raw: string) =>
  raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 30);
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

/** ICTSpark: students and parents refer; staff don't (mentors earn from their work). */
export const canRefer = (roles: Role[]) =>
  (roles.includes("student") || roles.includes("guardian")) &&
  !roles.some((r) => STAFF.includes(r));

const RULE =
  "Share your code or link. Rewards are not switched on yet: they start with payments, after a friend's first completed order, at an amount EduKhata announces first.";

/** The person's code, created on first use (like ICTSpark's ensureCode). */
async function ensureCode(db: Queryable, user: { id: string; name: string }): Promise<string> {
  const have = (
    await db.query<{ code: string }>("select code from referral_codes where user_id = $1", [
      user.id,
    ])
  ).rows[0];
  if (have) return have.code;
  const base =
    firstName(user.name)
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 6) || "FRIEND";
  for (let i = 0; i < 8; i++) {
    const code = `EDK-${base}-${Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")}`;
    const r = await db.query<{ code: string }>(
      `insert into referral_codes (user_id, code) values ($1, $2) on conflict do nothing returning code`,
      [user.id, code],
    );
    if (r.rows[0]) return r.rows[0].code;
    // Lost a race for this user's first code, or the code is taken: re-read, then retry.
    const again = (
      await db.query<{ code: string }>("select code from referral_codes where user_id = $1", [
        user.id,
      ])
    ).rows[0];
    if (again) return again.code;
  }
  throw new ApiError("server", "Could not create a referral code");
}

/** The active, eligible owner of a code, or null. */
export async function resolveReferrer(
  db: Queryable,
  raw: string,
): Promise<{ id: string; name: string; code: string } | null> {
  const code = normalizeRefCode(raw);
  if (code.length < 6) return null;
  const r = (
    await db.query<{ id: string; name: string; code: string }>(
      `select u.id, u.name, c.code from referral_codes c join users u on u.id = c.user_id
        where c.code = $1 and u.status = 'active'`,
      [code],
    )
  ).rows[0];
  if (!r || !canRefer(await rolesOf(db, r.id))) return null;
  return r;
}

/**
 * Records who referred a person joining EduKhata. Called inside the onboarding
 * transaction, only for someone with no role yet. First attribution wins; no self-referral.
 * Returns the referrer so the caller can notify them after commit.
 */
export async function attributeReferral(
  c: Queryable,
  referredId: string,
  input: { code?: string | undefined; cookie?: string | undefined },
): Promise<{ id: string; name: string } | null> {
  // A code typed during onboarding is a deliberate choice, so it beats an older link.
  const [raw, source] = input.code
    ? [input.code, "code" as const]
    : input.cookie
      ? [input.cookie, "link" as const]
      : [null, null];
  if (!raw || !source) return null;
  const ref = await resolveReferrer(c, raw);
  if (!ref || ref.id === referredId) return null;
  const r = await c.query(
    `insert into referrals (referred_id, referrer_id, code, source) values ($1, $2, $3, $4) on conflict (referred_id) do nothing`,
    [referredId, ref.id, ref.code, source],
  );
  return r.rowCount ? { id: ref.id, name: ref.name } : null;
}

export const referralRoutes: FastifyPluginAsync<Deps> = async (app, { db, config, hub }) => {
  /** Public: whether a code is valid, and its owner's first name only (as ICTSpark). */
  app.get<{ Params: { code: string } }>(
    "/referrals/resolve/:code",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (req) => {
      const ref = await resolveReferrer(db, req.params.code);
      return ref ? { valid: true, code: ref.code, name: firstName(ref.name) } : { valid: false };
    },
  );

  app.get("/me/referral", async (req): Promise<ReferralSummary> => {
    const s = await requireUser(db, config, hub, req);
    if (!canRefer(s.roles))
      throw new ApiError("forbidden", "Referral codes are for students and guardians");
    const code = await ensureCode(db, s.user);
    const invited = (
      await db.query<{ name: string; attributed_at: Date }>(
        `select u.name, r.attributed_at from referrals r join users u on u.id = r.referred_id
          where r.referrer_id = $1 order by r.attributed_at desc limit 100`,
        [s.user.id],
      )
    ).rows;
    const total = Number(
      (await db.query("select count(*) from referrals where referrer_id = $1", [s.user.id])).rows[0]
        .count,
    );
    return {
      code,
      link: `${config.webUrl}/?ref=${encodeURIComponent(code)}`,
      invited: total,
      // Orders and rewards arrive in Phases 4–5; nothing is counted until then.
      converted: 0,
      earnedMinor: 0,
      pendingMinor: 0,
      rewardRule: RULE,
      history: invited.map((i) => ({
        name: firstName(i.name),
        at: i.attributed_at.toISOString(),
        status: "joined" as const,
        rewardMinor: 0,
      })),
    };
  });

  /** Staff view of attributions (who referred whom), newest first. */
  app.get("/admin/referrals", async (req) => {
    await requireUser(db, config, hub, req, "/admin");
    const rows = (
      await db.query<{
        referrer: string;
        referred: string;
        code: string;
        source: string;
        attributed_at: Date;
      }>(
        `select a.name as referrer, b.name as referred, r.code, r.source, r.attributed_at from referrals r
           join users a on a.id = r.referrer_id join users b on b.id = r.referred_id
          order by r.attributed_at desc limit 200`,
      )
    ).rows;
    return rows.map((r) => ({
      referrer: r.referrer,
      referred: r.referred,
      code: r.code,
      source: r.source,
      at: r.attributed_at.toISOString(),
    }));
  });
};
