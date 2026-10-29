import { randomInt } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { normalizeBdMobile } from "@edukhata/contracts";
import { tx, type Queryable } from "../db.ts";
import type { Deps } from "../deps.ts";
import { audit } from "../lib/audit.ts";
import { sha256 } from "../lib/crypto.ts";
import { ApiError } from "../lib/errors.ts";
import { requireUser } from "../lib/session.ts";

/** ICTSpark allows six children per parent; EduKhata keeps that limit. */
export const MAX_CHILDREN = 6;
export const CODE_TTL_MS = 24 * 3600_000;
/** Failed link attempts allowed per guardian per hour. */
export const MAX_FAILURES_PER_HOUR = 10;
/** No 0/O or 1/I/L, so codes read out over the phone survive. 8 chars ≈ 40 bits. */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const newCode = () =>
  Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
const normalizeCode = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** One message for wrong contact, wrong code and expired code, so accounts can't be probed. */
const NOT_MATCHED = "Email/phone or link code is not correct";

const permissions = z.object({
  viewOrders: z.boolean(),
  viewPayments: z.boolean(),
  payOnBehalf: z.boolean(),
});

interface LinkRow {
  guardian_id: string;
  student_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  view_orders: boolean;
  view_payments: boolean;
  pay_on_behalf: boolean;
  created_at: Date;
  institution: string | null;
  class_level: string | null;
}

const toLink = (r: LinkRow, who: "guardian" | "student") => ({
  [who === "guardian" ? "guardianId" : "studentId"]:
    who === "guardian" ? r.guardian_id : r.student_id,
  name: r.name,
  contact: r.email ?? r.phone,
  permissions: {
    viewOrders: r.view_orders,
    viewPayments: r.view_payments,
    payOnBehalf: r.pay_on_behalf,
  },
  linkedAt: r.created_at.toISOString(),
  // What a guardian sees about a child (as in ICTSpark); students see nothing extra.
  ...(who === "student" ? { institution: r.institution, classLevel: r.class_level } : {}),
});

const listFor = (db: Queryable, side: "guardian" | "student", id: string) =>
  db.query<LinkRow>(
    `select l.*, u.name, u.email, u.phone, p.institution, p.class_level from guardian_links l
       join users u on u.id = ${side === "guardian" ? "l.student_id" : "l.guardian_id"}
       left join student_profiles p on p.user_id = l.student_id and $2
      where l.${side}_id = $1 order by l.created_at`,
    [id, side === "guardian"],
  );

/** Finds an active student by email or Bangladesh mobile number. */
async function findStudent(
  db: Queryable,
  contact: string,
): Promise<{ id: string; name: string } | null> {
  const c = contact.trim();
  const mobile = normalizeBdMobile(c);
  if (!c.includes("@") && !mobile) return null;
  const r = await db.query<{ id: string; name: string }>(
    `select u.id, u.name from users u join user_roles r on r.user_id = u.id and r.role = 'student'
      where u.status = 'active' and ${
        c.includes("@")
          ? "lower(u.email) = lower($1)"
          : "regexp_replace(regexp_replace(coalesce(u.phone, ''), '\\D', '', 'g'), '^880', '0') = $1"
      }
      limit 1`,
    [c.includes("@") ? c : mobile],
  );
  return r.rows[0] ?? null;
}

/**
 * Guardian linking. The student creates a one-time code (Student → Profile) and gives it
 * to the guardian with their email or phone; the student controls what each guardian sees
 * and either side can unlink. Rules ported from ICTSpark (parent.controller linkChild).
 */
export const guardianRoutes: FastifyPluginAsync<Deps> = async (
  app,
  { db, config, hub, notifications },
) => {
  /** Both sides hear about link changes (mandatory notifications), each linked to their own page. */
  const notifyBoth = async (
    type: "guardian.linked" | "guardian.unlinked",
    guardian: { id: string; name: string },
    student: { id: string; name: string },
  ) => {
    const data = { guardian: guardian.name, student: student.name };
    for (const [id, link] of [
      [guardian.id, "/guardian/children"],
      [student.id, "/student/profile"],
    ] as const) {
      await notifications.service.notify({
        type,
        recipientIds: [id],
        actorId: null,
        payload: { link },
        data,
      });
    }
  };

  // ---- Student side -------------------------------------------------------------------

  /** Whether a code is active (the code itself is only shown when created). */
  app.get("/me/guardian-code", async (req) => {
    const s = await requireUser(db, config, hub, req, "/student");
    const r = (
      await db.query<{ expires_at: Date }>(
        "select expires_at from guardian_link_codes where student_id = $1 and expires_at > now()",
        [s.user.id],
      )
    ).rows[0];
    return { active: !!r, expiresAt: r?.expires_at.toISOString() ?? null };
  });

  /** Creates a new code; any earlier code stops working. */
  app.post("/me/guardian-code", async (req) => {
    const s = await requireUser(db, config, hub, req, "/student");
    const code = newCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);
    await db.query(
      `insert into guardian_link_codes (student_id, code_hash, expires_at) values ($1, $2, $3)
       on conflict (student_id) do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at, created_at = now()`,
      [s.user.id, sha256(code), expiresAt],
    );
    return { code, expiresAt: expiresAt.toISOString() };
  });

  app.delete("/me/guardian-code", async (req) => {
    const s = await requireUser(db, config, hub, req, "/student");
    await db.query("delete from guardian_link_codes where student_id = $1", [s.user.id]);
    return { ok: true };
  });

  app.get("/me/guardians", async (req) => {
    const s = await requireUser(db, config, hub, req, "/student");
    return (await listFor(db, "student", s.user.id)).rows.map((r) => toLink(r, "guardian"));
  });

  app.put<{ Params: { guardianId: string } }>("/me/guardians/:guardianId", async (req) => {
    const s = await requireUser(db, config, hub, req, "/student");
    const body = permissions.safeParse(req.body);
    if (!body.success)
      throw new ApiError("validation", "Send viewOrders, viewPayments and payOnBehalf");
    const p = body.data;
    const r = await db.query(
      `update guardian_links set view_orders = $3, view_payments = $4, pay_on_behalf = $5, updated_at = now()
        where student_id = $1 and guardian_id::text = $2`,
      [s.user.id, req.params.guardianId, p.viewOrders, p.viewPayments, p.payOnBehalf],
    );
    if (!r.rowCount) throw new ApiError("not_found", "This guardian is not linked to you");
    await audit(db, {
      actorId: s.user.id,
      action: "guardian.permissions",
      target: req.params.guardianId,
      details: p,
      ip: req.ip,
    });
    const row = (await listFor(db, "student", s.user.id)).rows.find(
      (x) => x.guardian_id === req.params.guardianId,
    )!;
    return toLink(row, "guardian");
  });

  app.delete<{ Params: { guardianId: string } }>("/me/guardians/:guardianId", async (req) => {
    const s = await requireUser(db, config, hub, req, "/student");
    const r = await db.query<{ guardian_id: string; name: string }>(
      `delete from guardian_links l using users g where l.guardian_id = g.id
        and l.student_id = $1 and l.guardian_id::text = $2 returning l.guardian_id, g.name`,
      [s.user.id, req.params.guardianId],
    );
    const g = r.rows[0];
    if (!g) throw new ApiError("not_found", "This guardian is not linked to you");
    await audit(db, {
      actorId: s.user.id,
      action: "guardian.unlinked",
      target: g.guardian_id,
      details: { by: "student" },
      ip: req.ip,
    });
    await notifyBoth(
      "guardian.unlinked",
      { id: g.guardian_id, name: g.name },
      { id: s.user.id, name: s.user.name },
    );
    return { ok: true };
  });

  // ---- Guardian side ------------------------------------------------------------------

  app.get("/guardian/children", async (req) => {
    const s = await requireUser(db, config, hub, req, "/guardian");
    return (await listFor(db, "guardian", s.user.id)).rows.map((r) => toLink(r, "student"));
  });

  app.post("/guardian/children", async (req, reply) => {
    const s = await requireUser(db, config, hub, req, "/guardian");
    const body = z
      .object({ contact: z.string().trim().min(3).max(120), code: z.string().max(40) })
      .safeParse(req.body);
    if (!body.success)
      throw new ApiError("validation", "Enter your child's email or phone and the link code");
    const code = normalizeCode(body.data.code);

    const result = await tx(db, async (c) => {
      // One link attempt at a time per guardian, so the child limit and failure count hold.
      await c.query("select pg_advisory_xact_lock(4243, hashtext($1))", [s.user.id]);
      const failures = Number(
        (
          await c.query(
            "select count(*) from guardian_link_failures where guardian_id = $1 and at > now() - interval '1 hour'",
            [s.user.id],
          )
        ).rows[0].count,
      );
      if (failures >= MAX_FAILURES_PER_HOUR)
        return {
          error: new ApiError("rate_limited", "Too many wrong codes. Try again in an hour."),
        };

      const student = await findStudent(c, body.data.contact);
      // Before the code is used up: a guardian who also studies can't link themselves.
      if (student?.id === s.user.id)
        return { error: new ApiError("validation", "You can't link yourself") };
      const consumed =
        student && /^[A-Z0-9]{6,12}$/.test(code)
          ? (
              await c.query(
                "delete from guardian_link_codes where student_id = $1 and code_hash = $2 and expires_at > now() returning student_id",
                [student.id, sha256(code)],
              )
            ).rowCount
          : 0;
      if (!student || !consumed) {
        await c.query("insert into guardian_link_failures (guardian_id) values ($1)", [s.user.id]);
        return { error: new ApiError("not_found", NOT_MATCHED) };
      }
      const existing = (
        await c.query<{ student_id: string }>(
          "select student_id from guardian_links where guardian_id = $1",
          [s.user.id],
        )
      ).rows;
      // Errors after this point roll back, so the student's code stays usable.
      if (existing.some((e) => e.student_id === student.id))
        throw new ApiError("conflict", `${student.name} is already linked`);
      if (existing.length >= MAX_CHILDREN)
        throw new ApiError("validation", `You can link up to ${MAX_CHILDREN} children`);
      await c.query("insert into guardian_links (guardian_id, student_id) values ($1, $2)", [
        s.user.id,
        student.id,
      ]);
      await audit(c, {
        actorId: s.user.id,
        action: "guardian.linked",
        target: student.id,
        ip: req.ip,
      });
      return { student };
    });
    // Failure rows must persist, so expected refusals are returned (commit) and thrown here.
    if ("error" in result) throw result.error;
    const { student } = result;
    await notifyBoth("guardian.linked", { id: s.user.id, name: s.user.name }, student);
    const row = (await listFor(db, "guardian", s.user.id)).rows.find(
      (x) => x.student_id === student.id,
    )!;
    return reply.code(201).send(toLink(row, "student"));
  });

  app.delete<{ Params: { studentId: string } }>("/guardian/children/:studentId", async (req) => {
    const s = await requireUser(db, config, hub, req, "/guardian");
    const r = await db.query<{ student_id: string; name: string }>(
      `delete from guardian_links l using users u where l.student_id = u.id
        and l.guardian_id = $1 and l.student_id::text = $2 returning l.student_id, u.name`,
      [s.user.id, req.params.studentId],
    );
    const st = r.rows[0];
    if (!st) throw new ApiError("not_found", "This child is not linked to you");
    await audit(db, {
      actorId: s.user.id,
      action: "guardian.unlinked",
      target: st.student_id,
      details: { by: "guardian" },
      ip: req.ip,
    });
    await notifyBoth(
      "guardian.unlinked",
      { id: s.user.id, name: s.user.name },
      { id: st.student_id, name: st.name },
    );
    return { ok: true };
  });
};
