import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { homeFor } from "@edukhata/contracts";
import { tx } from "../db.ts";
import type { Deps } from "../deps.ts";
import { audit } from "../lib/audit.ts";
import { ApiError } from "../lib/errors.ts";
import { requireUser, rolesOf, type SessionCtx } from "../lib/session.ts";

const SUBJECTS = [
  "biology",
  "math",
  "ict",
  "english",
  "physics",
  "chemistry",
  "business",
  "bangla",
  "accounting",
  "engineering-drawing",
] as const;

const onboardingSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("student"),
    institution: z.string().trim().min(3).max(120),
    classLevel: z.string().trim().min(2).max(60),
    board: z.string().trim().max(60).optional(),
    subjects: z.array(z.enum(SUBJECTS)).min(1).max(10),
    country: z.literal("BD").default("BD"),
  }),
  z.object({ kind: z.literal("guardian"), country: z.literal("BD").default("BD") }),
]);

export async function meJson(deps: Deps, s: SessionCtx) {
  const student = (
    await deps.db.query(
      "select institution, class_level, board, subjects, country from student_profiles where user_id = $1",
      [s.user.id],
    )
  ).rows[0];
  return {
    user: {
      id: s.user.id,
      name: s.user.name,
      email: s.user.email,
      emailVerified: s.user.email_verified,
      phone: s.user.phone,
      phoneVerified: s.user.phone_verified,
      locale: s.user.locale,
    },
    roles: s.roles,
    onboardingComplete: s.roles.length > 0,
    home: homeFor(s.roles),
    studentProfile: student
      ? {
          institution: student.institution,
          classLevel: student.class_level,
          board: student.board,
          subjects: student.subjects,
          country: student.country,
        }
      : null,
  };
}

export const meRoutes: FastifyPluginAsync<Deps> = async (app, deps) => {
  const { db, config, hub, notifications } = deps;

  app.get("/me", async (req) => meJson(deps, await requireUser(db, config, hub, req)));

  /**
   * Profile completion gate. Students and guardians get their role here (self-service,
   * decision Q4); mentor and staff roles are only granted by EduKhata admins.
   */
  app.post("/me/onboarding", async (req) => {
    const s = await requireUser(db, config, hub, req);
    const parsed = onboardingSchema.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ApiError("validation", issue?.message, issue?.path.join("."));
    }
    const b = parsed.data;
    await tx(db, async (c) => {
      if (b.kind === "student") {
        await c.query(
          `insert into student_profiles (user_id, institution, class_level, board, subjects, country) values ($1, $2, $3, $4, $5, $6)
           on conflict (user_id) do update set institution = excluded.institution, class_level = excluded.class_level,
             board = excluded.board, subjects = excluded.subjects, country = excluded.country, updated_at = now()`,
          [s.user.id, b.institution, b.classLevel, b.board ?? null, b.subjects, b.country],
        );
      } else {
        await c.query(
          `insert into guardian_profiles (user_id, country) values ($1, $2)
           on conflict (user_id) do update set country = excluded.country, updated_at = now()`,
          [s.user.id, b.country],
        );
      }
      await c.query(
        "insert into user_roles (user_id, role, granted_by) values ($1, $2, $1) on conflict do nothing",
        [s.user.id, b.kind],
      );
      await audit(c, {
        actorId: s.user.id,
        action: "onboarding.completed",
        target: s.user.id,
        details: { kind: b.kind },
        ip: req.ip,
      });
    });
    const roles = await rolesOf(db, s.user.id);
    await notifications.service.notify({
      type: "account.welcome",
      recipientIds: [s.user.id],
      actorId: null,
      payload: { home: homeFor(roles) },
      data: { role: b.kind === "student" ? "Student" : "Guardian" },
      dedupeKey: `welcome:${b.kind}`,
    });
    return meJson(deps, { ...s, roles });
  });

  /** This person's EduKhata sessions (login history and devices live in WAN Identity). */
  app.get("/me/sessions", async (req) => {
    const s = await requireUser(db, config, hub, req);
    const rows = (
      await db.query<{
        id: string;
        ip: string;
        user_agent: string;
        created_at: Date;
        last_seen_at: Date;
      }>(
        `select id, ip, user_agent, created_at, last_seen_at from sessions
          where user_id = $1 and revoked_at is null and expires_at > now() order by last_seen_at desc`,
        [s.user.id],
      )
    ).rows;
    return rows.map((r) => ({
      id: r.id,
      ip: r.ip,
      userAgent: r.user_agent,
      createdAt: r.created_at,
      lastSeenAt: r.last_seen_at,
      current: r.id === s.sessionId,
    }));
  });

  app.delete<{ Params: { id: string } }>("/me/sessions/:id", async (req) => {
    const s = await requireUser(db, config, hub, req);
    const r = await db.query(
      "update sessions set revoked_at = now() where id::text = $1 and user_id = $2 and revoked_at is null",
      [req.params.id, s.user.id],
    );
    if (!r.rowCount) throw new ApiError("not_found");
    return { ok: true };
  });
};
