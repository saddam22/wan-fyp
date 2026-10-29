import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { homeFor, ROLE_LABEL, type Role } from "@edukhata/contracts";
import { tx } from "../db.ts";
import type { Deps } from "../deps.ts";
import { audit } from "../lib/audit.ts";
import { ApiError } from "../lib/errors.ts";
import { requireUser } from "../lib/session.ts";

const MARKET_ROLES = ["student", "guardian", "mentor"] as const;
const STAFF_ROLES = ["supporter", "accountant", "admin", "super_admin"] as const;
const ALL_ROLES = [...MARKET_ROLES, ...STAFF_ROLES] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const rolesBody = z.object({ roles: z.array(z.enum(ALL_ROLES)).max(ALL_ROLES.length) });
const statusBody = z.object({
  status: z.enum(["active", "suspended"]),
  reason: z.string().trim().max(300).optional(),
});
const decisionBody = z.object({
  approve: z.boolean(),
  note: z.string().trim().max(300).optional(),
});

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success)
    throw new ApiError("validation", r.error.issues[0]?.message, r.error.issues[0]?.path.join("."));
  return r.data;
}

interface UserListRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  created_at: Date;
  last_login_at: Date | null;
  roles: Role[];
}

export const adminRoutes: FastifyPluginAsync<Deps> = async (
  app,
  { db, config, hub, notifications },
) => {
  const userRow = async (id: string) =>
    (
      await db.query<UserListRow>(
        `select u.id, u.name, u.email, u.phone, u.status, u.created_at, u.last_login_at,
                coalesce(array_agg(r.role order by r.role) filter (where r.role is not null), '{}') as roles
           from users u left join user_roles r on r.user_id = u.id
          where u.id = $1 group by u.id`,
        [id],
      )
    ).rows[0];
  const toJson = (u: UserListRow) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    status: u.status,
    roles: u.roles,
    createdAt: u.created_at.toISOString(),
    lastLoginAt: u.last_login_at?.toISOString() ?? null,
  });

  app.get<{ Querystring: { q?: string; role?: string } }>("/admin/users", async (req) => {
    await requireUser(db, config, hub, req, "/admin/users");
    const q = (req.query.q ?? "").trim().slice(0, 80);
    const role =
      req.query.role && (ALL_ROLES as readonly string[]).includes(req.query.role)
        ? req.query.role
        : null;
    const rows = (
      await db.query<UserListRow>(
        `select u.id, u.name, u.email, u.phone, u.status, u.created_at, u.last_login_at,
                coalesce(array_agg(r.role order by r.role) filter (where r.role is not null), '{}') as roles
           from users u left join user_roles r on r.user_id = u.id
          where ($1 = '' or u.name ilike '%' || $1 || '%' or u.email ilike '%' || $1 || '%' or u.phone ilike '%' || $1 || '%')
          group by u.id
         having $2::text is null or $2 = any(array_agg(r.role))
          order by u.created_at desc limit 200`,
        [q, role],
      )
    ).rows;
    return rows.map(toJson);
  });

  /**
   * Replaces a user's marketplace roles. Admins manage student/guardian/mentor; only a
   * super admin manages staff roles. Nobody removes their own super admin role, and the
   * last super admin can't be removed.
   */
  app.put<{ Params: { id: string } }>("/admin/users/:id/roles", async (req) => {
    const actor = await requireUser(db, config, hub, req, "/admin/users");
    if (!UUID.test(req.params.id)) throw new ApiError("not_found");
    const { roles } = parse(rolesBody, req.body);
    const result = await tx(db, async (c) => {
      // Serialize role changes so the "last super admin" check can't race, and re-read the
      // actor's own roles under the lock (they may have been changed a moment ago).
      await c.query("select pg_advisory_xact_lock(4242)");
      const actorRoles = (
        await c.query<{ role: Role }>("select role from user_roles where user_id = $1", [
          actor.user.id,
        ])
      ).rows.map((r) => r.role);
      if (!actorRoles.includes("admin") && !actorRoles.includes("super_admin"))
        throw new ApiError("forbidden", "Your role doesn't allow this");
      const isSuper = actorRoles.includes("super_admin");
      const before = (
        await c.query<{ role: Role }>("select role from user_roles where user_id = $1", [
          req.params.id,
        ])
      ).rows.map((r) => r.role);
      if (!(await c.query("select 1 from users where id = $1", [req.params.id])).rowCount)
        throw new ApiError("not_found");
      const wanted = new Set(roles);
      const added = [...wanted].filter((r) => !before.includes(r));
      const removed = before.filter((r) => !wanted.has(r));
      const touchesStaff = [...added, ...removed].some((r) =>
        (STAFF_ROLES as readonly string[]).includes(r),
      );
      if (touchesStaff && !isSuper)
        throw new ApiError("forbidden", "Only a super admin can change staff roles", "roles");
      if (removed.includes("super_admin")) {
        if (req.params.id === actor.user.id)
          throw new ApiError("conflict", "You can't remove your own super admin role", "roles");
        const left = (
          await c.query("select count(*)::int as n from user_roles where role = 'super_admin'")
        ).rows[0].n as number;
        if (left <= 1)
          throw new ApiError("conflict", "At least one super admin must remain", "roles");
      }
      for (const r of removed)
        await c.query("delete from user_roles where user_id = $1 and role = $2", [
          req.params.id,
          r,
        ]);
      for (const r of added)
        await c.query("insert into user_roles (user_id, role, granted_by) values ($1, $2, $3)", [
          req.params.id,
          r,
          actor.user.id,
        ]);
      if (added.length || removed.length) {
        await audit(c, {
          actorId: actor.user.id,
          action: "user.roles",
          target: req.params.id,
          details: { added, removed },
          ip: req.ip,
        });
      }
      const u = (
        await c.query<UserListRow>(
          `select u.id, u.name, u.email, u.phone, u.status, u.created_at, u.last_login_at,
                  coalesce(array_agg(r.role order by r.role) filter (where r.role is not null), '{}') as roles
             from users u left join user_roles r on r.user_id = u.id where u.id = $1 group by u.id`,
          [req.params.id],
        )
      ).rows[0]!;
      return { user: toJson(u), added, removed };
    });
    if (result.added.length || result.removed.length) {
      await notifications.service.notify({
        type: "account.roles_changed",
        recipientIds: [req.params.id],
        actorId: actor.user.id,
        payload: { home: homeFor(result.user.roles) },
        data: {
          ...(result.added.length
            ? { added: result.added.map((r) => ROLE_LABEL[r]).join(", ") }
            : {}),
          ...(result.removed.length
            ? { removed: result.removed.map((r) => ROLE_LABEL[r]).join(", ") }
            : {}),
        },
      });
    }
    return result.user;
  });

  /** Marketplace-level suspension: ends the user's EduKhata sessions immediately. */
  app.post<{ Params: { id: string } }>("/admin/users/:id/status", async (req) => {
    const actor = await requireUser(db, config, hub, req, "/admin/users");
    if (!UUID.test(req.params.id)) throw new ApiError("not_found");
    const { status, reason } = parse(statusBody, req.body);
    if (req.params.id === actor.user.id)
      throw new ApiError("conflict", "You can't change your own status");
    const target = await userRow(req.params.id);
    if (!target) throw new ApiError("not_found");
    const targetIsStaff = target.roles.some((r) => (STAFF_ROLES as readonly string[]).includes(r));
    if (targetIsStaff && !actor.roles.includes("super_admin"))
      throw new ApiError("forbidden", "Only a super admin can suspend staff");
    await tx(db, async (c) => {
      await c.query("update users set status = $2, status_reason = $3 where id = $1", [
        req.params.id,
        status,
        reason ?? null,
      ]);
      if (status === "suspended")
        await c.query(
          "update sessions set revoked_at = now() where user_id = $1 and revoked_at is null",
          [req.params.id],
        );
      await audit(c, {
        actorId: actor.user.id,
        action: status === "suspended" ? "user.suspend" : "user.reactivate",
        target: req.params.id,
        details: { reason },
        ip: req.ip,
      });
    });
    return toJson((await userRow(req.params.id))!);
  });

  /** Access requests people made for EduKhata in WAN Identity Hub (decided here, stored there). */
  app.get<{ Querystring: { status?: string } }>("/admin/access-requests", async (req) => {
    await requireUser(db, config, hub, req, "/admin/access-requests");
    return hub.accessRequests(req.query.status ?? "pending");
  });

  app.post<{ Params: { id: string } }>("/admin/access-requests/:id/decision", async (req) => {
    const actor = await requireUser(db, config, hub, req, "/admin/access-requests");
    const { approve, note } = parse(decisionBody, req.body);
    const decided = await hub.decideAccessRequest(req.params.id, approve, note);
    await audit(db, {
      actorId: actor.user.id,
      action: approve ? "access_request.approve" : "access_request.reject",
      target: decided.sub,
      details: { request: decided.id, role: decided.roleName },
      ip: req.ip,
    });
    return decided;
  });

  app.get("/admin/audit", async (req) => {
    await requireUser(db, config, hub, req, "/admin/audit");
    const rows = (
      await db.query<{
        id: string;
        at: Date;
        action: string;
        target: string;
        details: object | null;
        ip: string;
        actor: string | null;
      }>(
        `select a.id, a.at, a.action, a.target, a.details, a.ip, u.name as actor
           from audit_log a left join users u on u.id = a.actor_id order by a.at desc limit 200`,
      )
    ).rows;
    return rows.map((r) => ({ ...r, at: r.at.toISOString() }));
  });
};
