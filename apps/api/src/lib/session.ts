import type { FastifyReply, FastifyRequest } from "fastify";
import { canAccess, type Role } from "@edukhata/contracts";
import type { Config } from "../config.ts";
import type { Db, Queryable } from "../db.ts";
import { randomToken, sha256 } from "./crypto.ts";
import { ApiError } from "./errors.ts";
import type { Hub } from "./hub.ts";

export const SESSION_COOKIE = "ek_sid";

export interface UserRow {
  id: string;
  wan_sub: string;
  name: string;
  email: string | null;
  email_verified: boolean;
  phone: string | null;
  phone_verified: boolean;
  locale: string | null;
  status: "active" | "suspended";
  status_reason: string | null;
  created_at: Date;
  last_login_at: Date | null;
}

export interface SessionCtx {
  sessionId: string;
  user: UserRow;
  roles: Role[];
}

export async function rolesOf(db: Queryable, userId: string): Promise<Role[]> {
  return (
    await db.query<{ role: Role }>("select role from user_roles where user_id = $1 order by role", [
      userId,
    ])
  ).rows.map((r) => r.role);
}

export async function startSession(
  db: Queryable,
  config: Config,
  req: FastifyRequest,
  reply: FastifyReply,
  userId: string,
): Promise<void> {
  const token = randomToken();
  await db.query(
    `insert into sessions (user_id, token_hash, ip, user_agent, expires_at)
     values ($1, $2, $3, $4, now() + make_interval(secs => $5))`,
    [
      userId,
      sha256(token),
      req.ip,
      String(req.headers["user-agent"] ?? "").slice(0, 300),
      config.sessionTtlMs / 1000,
    ],
  );
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.cookieSecure,
    path: "/",
    maxAge: config.sessionTtlMs / 1000,
  });
}

export function clearSessionCookie(config: Config, reply: FastifyReply) {
  reply.clearCookie(SESSION_COOKIE, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: config.cookieSecure,
  });
}

/**
 * The signed-in user, or null. Expired, idle, revoked and suspended sessions end here.
 * Every `hubCheckIntervalMs` the hub entitlement is re-read: a user the hub suspended for
 * EduKhata loses the session. If the hub is unreachable the session continues (the hub
 * already allowed this sign-in) and the check is retried on the next request.
 */
export async function currentSession(
  db: Db,
  config: Config,
  hub: Hub,
  req: FastifyRequest,
): Promise<SessionCtx | null> {
  const token = req.cookies[SESSION_COOKIE];
  if (!token) return null;
  const row = (
    await db.query<UserRow & { session_id: string; hub_due: boolean; idle: boolean }>(
      `select u.*, s.id as session_id,
              s.hub_checked_at < now() - make_interval(secs => $2) as hub_due,
              s.last_seen_at < now() - make_interval(secs => $3) as idle
         from sessions s join users u on u.id = s.user_id
        where s.token_hash = $1 and s.revoked_at is null and s.expires_at > now()`,
      [sha256(token), config.hubCheckIntervalMs / 1000, config.sessionIdleMs / 1000],
    )
  ).rows[0];
  if (!row) return null;
  if (row.idle || row.status !== "active") {
    await db.query("update sessions set revoked_at = now() where id = $1", [row.session_id]);
    return null;
  }
  if (row.hub_due) {
    try {
      const ent = await hub.entitlement(row.wan_sub);
      if (ent.status === "suspended" || ent.status === "rejected") {
        await db.query(
          "update sessions set revoked_at = now() where user_id = $1 and revoked_at is null",
          [row.id],
        );
        throw new ApiError(
          "platform_access_denied",
          "Your EduKhata access was suspended in WAN Identity",
        );
      }
      await db.query("update sessions set hub_checked_at = now() where id = $1", [row.session_id]);
    } catch (error) {
      if (error instanceof ApiError && error.code === "platform_access_denied") throw error;
      req.log.warn({ err: error }, "hub entitlement check failed; continuing");
    }
  }
  await db.query("update sessions set last_seen_at = now() where id = $1", [row.session_id]);
  const { session_id, hub_due: _h, idle: _i, ...user } = row;
  return { sessionId: session_id, user, roles: await rolesOf(db, user.id) };
}

/** Requires a signed-in user who may open `area` (same rules as the web app). */
export async function requireUser(
  db: Db,
  config: Config,
  hub: Hub,
  req: FastifyRequest,
  area?: string,
): Promise<SessionCtx> {
  const s = await currentSession(db, config, hub, req);
  if (!s) throw new ApiError("unauthorized", "Sign in with your WAN ID");
  if (area && !canAccess(s.roles, area))
    throw new ApiError("forbidden", "Your role doesn't allow this");
  return s;
}
