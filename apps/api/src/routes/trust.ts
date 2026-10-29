import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import sharp from "sharp";
import { z } from "zod";
import { verifyContent } from "@chat-module/server";
import { tx, type Queryable } from "../db.ts";
import type { Deps } from "../deps.ts";
import { audit } from "../lib/audit.ts";
import { diskStorage } from "../lib/disk-storage.ts";
import { ApiError } from "../lib/errors.ts";
import { requireUser } from "../lib/session.ts";
import { badgesFor } from "../market/badges.ts";
import { getSettings } from "../market/settings.ts";

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body ?? {});
  if (!r.success)
    throw new ApiError("validation", r.error.issues[0]?.message, r.error.issues[0]?.path.join("."));
  return r.data;
}

const DOC_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
const DOC_MAX = 8 * 1024 * 1024;
const REVIEWERS = ["admin", "super_admin"];

interface VerificationRow {
  id: string;
  mentor_id: string;
  status: string;
  note: string;
  decision_note: string | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  created_at: Date;
}
interface FileRow {
  id: string;
  verification_id: string | null;
  mentor_id: string;
  kind: string;
  name: string;
  content_type: string;
  byte_size: number;
  storage_key: string;
  uploaded: boolean;
  created_at: Date;
}

const fileDto = (f: FileRow) => ({
  id: f.id,
  kind: f.kind,
  name: f.name,
  contentType: f.content_type,
  byteSize: f.byte_size,
  uploaded: f.uploaded,
  createdAt: f.created_at.toISOString(),
});

/** Staff (admins) review identity and qualification documents; skill tests are server-graded. */
export const trustRoutes: FastifyPluginAsync<Deps> = async (
  app,
  { db, config, hub, notifications },
) => {
  const storage = diskStorage(
    config.orderFilesDir,
    config.chatSecret,
    "/api/verification-files",
    "verification",
  );
  const reviewers = async () =>
    (
      await db.query<{ user_id: string }>(
        "select distinct user_id from user_roles where role = any($1::text[])",
        [REVIEWERS],
      )
    ).rows.map((r) => r.user_id);

  const verificationDto = async (c: Queryable, v: VerificationRow, staff: boolean) => {
    const files = (
      await c.query<FileRow>(
        "select * from verification_files where verification_id = $1 order by created_at",
        [v.id],
      )
    ).rows;
    const names = (
      await c.query<{ id: string; name: string }>(
        "select id, name from users where id = any($1::uuid[])",
        [[v.mentor_id, v.reviewed_by].filter(Boolean)],
      )
    ).rows;
    const name = (id: string | null) => names.find((n) => n.id === id)?.name ?? null;
    return {
      id: v.id,
      mentorId: v.mentor_id,
      mentorName: name(v.mentor_id),
      status: v.status,
      note: v.note,
      decisionNote: v.decision_note,
      ...(staff ? { reviewedBy: name(v.reviewed_by) } : {}),
      reviewedAt: v.reviewed_at?.toISOString() ?? null,
      createdAt: v.created_at.toISOString(),
      files: files.map(fileDto),
    };
  };

  // ---- Mentor side --------------------------------------------------------------------

  app.get("/mentor/verification", async (req) => {
    const s = await requireUser(db, config, hub, req, "/mentor");
    const p = (
      await db.query<{ verified_at: Date | null }>(
        "select verified_at from mentor_profiles where user_id = $1",
        [s.user.id],
      )
    ).rows[0];
    const latest = (
      await db.query<VerificationRow>(
        "select * from mentor_verifications where mentor_id = $1 order by created_at desc limit 1",
        [s.user.id],
      )
    ).rows[0];
    const drafts = (
      await db.query<FileRow>(
        "select * from verification_files where mentor_id = $1 and verification_id is null and uploaded order by created_at",
        [s.user.id],
      )
    ).rows;
    return {
      verified: !!p?.verified_at,
      verifiedAt: p?.verified_at?.toISOString() ?? null,
      latest: latest ? await verificationDto(db, latest, false) : null,
      draftFiles: drafts.map(fileDto),
    };
  });

  app.post("/mentor/verification/files", async (req) => {
    const s = await requireUser(db, config, hub, req, "/mentor");
    const b = parse(
      z.object({
        kind: z.enum(["identity", "qualification", "institution", "other"]),
        name: z.string().trim().min(1).max(120),
        contentType: z.enum(DOC_TYPES),
        byteSize: z.number().int().min(1).max(DOC_MAX),
      }),
      req.body,
    );
    const count = (
      await db.query<{ n: number }>(
        "select count(*)::int as n from verification_files where mentor_id = $1 and verification_id is null",
        [s.user.id],
      )
    ).rows[0]!.n;
    if (count >= 10) throw new ApiError("conflict", "Remove a file before adding another");
    const key = `verification/${s.user.id}/${randomUUID()}`;
    const f = (
      await db.query<FileRow>(
        `insert into verification_files (mentor_id, kind, name, content_type, byte_size, storage_key)
         values ($1, $2, $3, $4, $5, $6) returning *`,
        [s.user.id, b.kind, b.name.replace(/[<>/\\]/g, ""), b.contentType, b.byteSize, key],
      )
    ).rows[0]!;
    const put = await storage.presignPut(key, b.contentType, b.byteSize);
    return { fileId: f.id, uploadUrl: put.url, headers: put.headers };
  });

  await app.register(async (scope) => {
    scope.removeAllContentTypeParsers();
    scope.addContentTypeParser("*", { parseAs: "buffer", bodyLimit: DOC_MAX }, (_r, body, done) =>
      done(null, body),
    );
    scope.put<{
      Params: { "*": string };
      Querystring: { exp?: string; size?: string; sig?: string };
    }>("/verification-files/*", { bodyLimit: DOC_MAX }, async (req, reply) => {
      const key = req.params["*"];
      const { exp, size, sig } = req.query;
      const body = req.body as Buffer | undefined;
      const type = req.headers["content-type"] ?? "";
      if (
        !body ||
        !exp ||
        !size ||
        !sig ||
        !storage.verifyUpload(key, Number(exp), Number(size), type, sig) ||
        body.length !== Number(size)
      )
        throw new ApiError("forbidden", "Invalid upload URL");
      if (!verifyContent(type, body).ok)
        throw new ApiError("validation", "The file's content doesn't match its type");
      // Photos of documents lose their EXIF data (location, device).
      await storage.put(
        key,
        type.startsWith("image/")
          ? await sharp(body).rotate().webp({ quality: 88 }).toBuffer()
          : body,
      );
      await db.query("update verification_files set uploaded = true where storage_key = $1", [key]);
      return reply.code(200).send();
    });
  });

  app.delete<{ Params: { id: string } }>("/mentor/verification/files/:id", async (req) => {
    const s = await requireUser(db, config, hub, req, "/mentor");
    const f = (
      await db.query<FileRow>(
        "delete from verification_files where id::text = $1 and mentor_id = $2 and verification_id is null returning *",
        [req.params.id, s.user.id],
      )
    ).rows[0];
    if (!f) throw new ApiError("not_found", "File not found");
    await storage.delete(f.storage_key);
    return { ok: true };
  });

  /** Submit the uploaded documents for review (one pending request at a time). */
  app.post("/mentor/verification", async (req, reply) => {
    const s = await requireUser(db, config, hub, req, "/mentor");
    const b = parse(z.object({ note: z.string().trim().max(1000).default("") }), req.body);
    const v = await tx(db, async (c) => {
      const files = (
        await c.query<FileRow>(
          "select * from verification_files where mentor_id = $1 and verification_id is null and uploaded for update",
          [s.user.id],
        )
      ).rows;
      const pending = (
        await c.query(
          "select 1 from mentor_verifications where mentor_id = $1 and status = 'pending'",
          [s.user.id],
        )
      ).rowCount;
      if (pending) throw new ApiError("conflict", "Your documents are already being reviewed");
      if (!files.some((f) => f.kind === "identity"))
        throw new ApiError("validation", "Add your NID, birth certificate or passport", "files");
      if (!files.some((f) => f.kind === "qualification"))
        throw new ApiError("validation", "Add a certificate or transcript", "files");
      let row: VerificationRow;
      try {
        await c.query("savepoint v");
        row = (
          await c.query<VerificationRow>(
            "insert into mentor_verifications (mentor_id, note) values ($1, $2) returning *",
            [s.user.id, b.note],
          )
        ).rows[0]!;
      } catch (e) {
        if ((e as { code?: string }).code === "23505")
          throw new ApiError("conflict", "Your documents are already being reviewed");
        throw e;
      }
      await c.query(
        "update verification_files set verification_id = $1 where id = any($2::uuid[])",
        [row.id, files.map((f) => f.id)],
      );
      return row;
    });
    await notifications.service
      .notify({
        type: "verification.submitted",
        recipientIds: await reviewers(),
        actorId: null,
        payload: { link: "/admin/verification" },
        data: { code: "Verification", title: s.user.name },
      })
      .catch(() => undefined);
    return reply.code(201).send(await verificationDto(db, v, false));
  });

  // ---- Review (admins) ----------------------------------------------------------------

  app.get<{ Querystring: { status?: string } }>("/admin/verifications", async (req) => {
    await requireUser(db, config, hub, req, "/admin/verification");
    const rows = (
      await db.query<VerificationRow>(
        "select * from mentor_verifications where ($1::text is null or status = $1) order by created_at desc limit 200",
        [req.query.status ?? null],
      )
    ).rows;
    return Promise.all(rows.map((v) => verificationDto(db, v, true)));
  });

  /** A document: to reviewers, and to the mentor who uploaded it. Never public. */
  app.get<{ Params: { id: string } }>("/verification-files/:id", async (req, reply) => {
    const s = await requireUser(db, config, hub, req);
    const f = (
      await db.query<FileRow>("select * from verification_files where id::text = $1 and uploaded", [
        req.params.id,
      ])
    ).rows[0];
    const staff = s.roles.some((r) => REVIEWERS.includes(r));
    if (!f || (!staff && f.mentor_id !== s.user.id)) throw new ApiError("not_found", "No file");
    const body = await storage.get(f.storage_key);
    if (!body) throw new ApiError("not_found", "No file");
    if (staff && f.mentor_id !== s.user.id)
      await audit(db, {
        actorId: s.user.id,
        action: "verification.file_viewed",
        target: f.id,
        ip: req.ip,
      });
    return reply
      .header(
        "content-type",
        f.content_type === "application/pdf" ? "application/pdf" : "image/webp",
      )
      .header("x-content-type-options", "nosniff")
      .header("content-security-policy", "default-src 'none'; sandbox")
      .header("cache-control", "private, no-store")
      .send(body);
  });

  app.post<{ Params: { id: string } }>("/admin/verifications/:id/decision", async (req) => {
    const s = await requireUser(db, config, hub, req, "/admin/verification");
    const b = parse(
      z.object({ approve: z.boolean(), note: z.string().trim().max(500).default("") }),
      req.body,
    );
    if (!b.approve && b.note.length < 3)
      throw new ApiError("validation", "Tell the mentor what is missing", "note");
    const v = await tx(db, async (c) => {
      const v = (
        await c.query<VerificationRow>(
          "select * from mentor_verifications where id::text = $1 for update",
          [req.params.id],
        )
      ).rows[0];
      if (!v) throw new ApiError("not_found", "Request not found");
      if (v.status !== "pending") throw new ApiError("conflict", "Already decided");
      if (v.mentor_id === s.user.id)
        throw new ApiError("forbidden", "Someone else must review your documents");
      await c.query(
        "update mentor_verifications set status = $2, decision_note = $3, reviewed_by = $4, reviewed_at = now() where id = $1",
        [v.id, b.approve ? "approved" : "rejected", b.note || null, s.user.id],
      );
      if (b.approve)
        await c.query(
          `insert into mentor_profiles (user_id, verified_at, verified_by) values ($1, now(), $2)
           on conflict (user_id) do update set verified_at = now(), verified_by = $2, updated_at = now()`,
          [v.mentor_id, s.user.id],
        );
      await audit(c, {
        actorId: s.user.id,
        action: b.approve ? "verification.approve" : "verification.reject",
        target: v.mentor_id,
        details: { request: v.id, note: b.note },
        ip: req.ip,
      });
      return (
        await c.query<VerificationRow>("select * from mentor_verifications where id = $1", [v.id])
      ).rows[0]!;
    });
    await notifications.service.notify({
      type: b.approve ? "verification.approved" : "verification.rejected",
      recipientIds: [v.mentor_id],
      actorId: null,
      payload: { link: "/mentor/verification" },
      data: { code: "Verification", title: "", note: b.note },
    });
    return verificationDto(db, v, true);
  });

  /** Take the verified status away (documents expired, misuse). Audited. */
  app.post<{ Params: { id: string } }>("/admin/mentors/:id/unverify", async (req) => {
    const s = await requireUser(db, config, hub, req, "/admin/verification");
    const b = parse(z.object({ note: z.string().trim().min(3).max(500) }), req.body);
    const r = await db.query(
      "update mentor_profiles set verified_at = null, verified_by = null, updated_at = now() where user_id::text = $1 and verified_at is not null",
      [req.params.id],
    );
    if (!r.rowCount) throw new ApiError("conflict", "This mentor isn't verified");
    await audit(db, {
      actorId: s.user.id,
      action: "verification.revoke",
      target: req.params.id,
      details: { note: b.note },
      ip: req.ip,
    });
    return { ok: true };
  });

  // ---- Badges -------------------------------------------------------------------------

  app.get<{ Params: { id: string } }>("/mentors/:id/badges", async (req) => {
    const id = z.uuid().safeParse(req.params.id);
    if (!id.success) throw new ApiError("not_found");
    return (await badgesFor(db, [id.data])).get(id.data) ?? [];
  });

  // ---- Skill tests --------------------------------------------------------------------

  const questionBody = z.object({
    prompt: z.string().trim().min(3).max(500),
    options: z.array(z.string().trim().min(1).max(200)).min(2).max(6),
    correct: z.number().int().min(0),
  });
  const testBody = z.object({
    subjectId: z.string(),
    title: z.string().trim().min(3).max(120),
    passPct: z.number().int().min(1).max(100).default(70),
    durationMin: z.number().int().min(1).max(180).default(20),
    active: z.boolean().default(true),
    questions: z.array(questionBody).min(3).max(60),
  });

  const loadTest = async (c: Queryable, id: string) =>
    (
      await c.query<{
        id: string;
        subject_id: string;
        title: string;
        pass_pct: number;
        duration_min: number;
        active: boolean;
        subject: string;
        questions: number;
        attempts: number;
      }>(
        `select t.*, s.name as subject,
           (select count(*)::int from skill_questions q where q.test_id = t.id) as questions,
           (select count(*)::int from skill_attempts a where a.test_id = t.id) as attempts
         from skill_tests t join subjects s on s.id = t.subject_id where t.id::text = $1`,
        [id],
      )
    ).rows[0];
  const testDto = (t: NonNullable<Awaited<ReturnType<typeof loadTest>>>) => ({
    id: t.id,
    subjectId: t.subject_id,
    subject: t.subject,
    title: t.title,
    passPct: t.pass_pct,
    durationMin: t.duration_min,
    active: t.active,
    questionCount: t.questions,
    attemptCount: t.attempts,
  });

  const saveQuestions = async (
    c: Queryable,
    testId: string,
    qs: z.infer<typeof questionBody>[],
  ) => {
    for (const [i, q] of qs.entries()) {
      if (q.correct >= q.options.length)
        throw new ApiError("validation", `Question ${i + 1}: mark the right answer`, "questions");
      await c.query(
        "insert into skill_questions (test_id, prompt, options, correct, sort) values ($1, $2, $3, $4, $5)",
        [testId, q.prompt, q.options, q.correct, i],
      );
    }
  };

  app.get("/admin/skill-tests", async (req) => {
    await requireUser(db, config, hub, req, "/admin/catalog");
    const ids = (await db.query<{ id: string }>("select id from skill_tests order by created_at"))
      .rows;
    return Promise.all(ids.map(async ({ id }) => testDto((await loadTest(db, id))!)));
  });

  app.get<{ Params: { id: string } }>("/admin/skill-tests/:id", async (req) => {
    await requireUser(db, config, hub, req, "/admin/catalog");
    const t = await loadTest(db, req.params.id);
    if (!t) throw new ApiError("not_found");
    const qs = (
      await db.query<{ prompt: string; options: string[]; correct: number }>(
        "select prompt, options, correct from skill_questions where test_id = $1 order by sort",
        [t.id],
      )
    ).rows;
    return { ...testDto(t), questions: qs };
  });

  app.post("/admin/skill-tests", async (req, reply) => {
    const s = await requireUser(db, config, hub, req, "/admin/catalog");
    const b = parse(testBody, req.body);
    const id = await tx(db, async (c) => {
      const sub = (await c.query("select 1 from subjects where id = $1", [b.subjectId])).rowCount;
      if (!sub) throw new ApiError("validation", "Unknown subject", "subjectId");
      const id = (
        await c.query<{ id: string }>(
          "insert into skill_tests (subject_id, title, pass_pct, duration_min, active, created_by) values ($1, $2, $3, $4, $5, $6) returning id",
          [b.subjectId, b.title, b.passPct, b.durationMin, b.active, s.user.id],
        )
      ).rows[0]!.id;
      await saveQuestions(c, id, b.questions);
      await audit(c, { actorId: s.user.id, action: "skill_test.create", target: id, ip: req.ip });
      return id;
    });
    return reply.code(201).send(testDto((await loadTest(db, id))!));
  });

  /** Edit a test. Its questions can be replaced only before anyone has taken it. */
  app.put<{ Params: { id: string } }>("/admin/skill-tests/:id", async (req) => {
    const s = await requireUser(db, config, hub, req, "/admin/catalog");
    const b = parse(testBody.partial({ questions: true, subjectId: true }), req.body);
    await tx(db, async (c) => {
      const t = (
        await c.query<{ id: string }>("select id from skill_tests where id::text = $1 for update", [
          req.params.id,
        ])
      ).rows[0];
      if (!t) throw new ApiError("not_found");
      await c.query(
        "update skill_tests set title = $2, pass_pct = $3, duration_min = $4, active = $5 where id = $1",
        [t.id, b.title, b.passPct, b.durationMin, b.active],
      );
      if (b.questions) {
        const taken = (
          await c.query("select 1 from skill_attempts where test_id = $1 limit 1", [t.id])
        ).rowCount;
        if (taken)
          throw new ApiError(
            "conflict",
            "Mentors have taken this test — make a new test instead of changing its questions",
          );
        await c.query("delete from skill_questions where test_id = $1", [t.id]);
        await saveQuestions(c, t.id, b.questions);
      }
      await audit(c, { actorId: s.user.id, action: "skill_test.update", target: t.id, ip: req.ip });
    });
    return testDto((await loadTest(db, req.params.id))!);
  });

  interface AttemptRow {
    id: string;
    test_id: string;
    mentor_id: string;
    question_ids: string[];
    started_at: Date;
    deadline: Date;
    submitted_at: Date | null;
    score_pct: number | null;
    passed: boolean | null;
  }

  /** Active tests with this mentor's status (passed, last score, when a retake is allowed). */
  app.get("/mentor/skill-tests", async (req) => {
    const s = await requireUser(db, config, hub, req, "/mentor");
    const settings = await getSettings(db);
    const ids = (
      await db.query<{ id: string }>("select id from skill_tests where active order by title")
    ).rows;
    return Promise.all(
      ids.map(async ({ id }) => {
        const t = (await loadTest(db, id))!;
        const attempts = (
          await db.query<AttemptRow>(
            "select * from skill_attempts where test_id = $1 and mentor_id = $2 order by started_at desc",
            [id, s.user.id],
          )
        ).rows;
        const last = attempts.find((a) => a.submitted_at);
        const open = attempts.find((a) => !a.submitted_at && a.deadline > new Date());
        const retakeAt =
          last && !last.passed
            ? new Date(last.submitted_at!.getTime() + settings.skill_retake_days * 86_400_000)
            : null;
        const { attemptCount: _a, ...pub } = testDto(t);
        return {
          ...pub,
          passed: attempts.some((a) => a.passed),
          lastScorePct: last?.score_pct ?? null,
          retakeAt: retakeAt && retakeAt > new Date() ? retakeAt.toISOString() : null,
          openAttemptId: open?.id ?? null,
        };
      }),
    );
  });

  const questionsOf = async (c: Queryable, ids: string[]) => {
    const rows = (
      await c.query<{ id: string; prompt: string; options: string[] }>(
        "select id, prompt, options from skill_questions where id = any($1::uuid[])",
        [ids],
      )
    ).rows;
    return ids.map((id) => rows.find((r) => r.id === id)!).filter(Boolean);
  };

  /** Start (or resume) an attempt. Questions come in random order, without answers. */
  app.post<{ Params: { id: string } }>("/mentor/skill-tests/:id/start", async (req) => {
    const s = await requireUser(db, config, hub, req, "/mentor");
    const settings = await getSettings(db);
    const a = await tx(db, async (c) => {
      await c.query("select pg_advisory_xact_lock(4247, hashtext($1))", [s.user.id]);
      const t = (
        await c.query<{ id: string; duration_min: number }>(
          "select id, duration_min from skill_tests where id::text = $1 and active",
          [req.params.id],
        )
      ).rows[0];
      if (!t) throw new ApiError("not_found", "Test not found");
      const attempts = (
        await c.query<AttemptRow>(
          "select * from skill_attempts where test_id = $1 and mentor_id = $2 order by started_at desc",
          [t.id, s.user.id],
        )
      ).rows;
      if (attempts.some((x) => x.passed))
        throw new ApiError("conflict", "You already passed this test");
      const open = attempts.find((x) => !x.submitted_at);
      if (open && open.deadline > new Date()) return open;
      if (open)
        // Time ran out without an answer sheet: a failed attempt.
        await c.query(
          "update skill_attempts set submitted_at = deadline, score_pct = 0, passed = false where id = $1",
          [open.id],
        );
      const last = (
        await c.query<AttemptRow>(
          "select * from skill_attempts where test_id = $1 and mentor_id = $2 and submitted_at is not null order by submitted_at desc limit 1",
          [t.id, s.user.id],
        )
      ).rows[0];
      if (
        last &&
        last.submitted_at!.getTime() + settings.skill_retake_days * 86_400_000 > Date.now()
      )
        throw new ApiError(
          "conflict",
          `You can retake this test after ${settings.skill_retake_days} days`,
        );
      const qs = (
        await c.query<{ id: string }>("select id from skill_questions where test_id = $1", [t.id])
      ).rows.map((q) => q.id);
      for (let i = qs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [qs[i], qs[j]] = [qs[j]!, qs[i]!];
      }
      return (
        await c.query<AttemptRow>(
          `insert into skill_attempts (test_id, mentor_id, question_ids, deadline)
           values ($1, $2, $3, now() + make_interval(mins => $4)) returning *`,
          [t.id, s.user.id, qs, t.duration_min],
        )
      ).rows[0]!;
    });
    return {
      attemptId: a.id,
      deadline: a.deadline.toISOString(),
      questions: await questionsOf(db, a.question_ids),
    };
  });

  /** Grade an attempt on the server. The right answers are never sent to the browser. */
  app.post<{ Params: { id: string } }>("/mentor/skill-attempts/:id/submit", async (req) => {
    const s = await requireUser(db, config, hub, req, "/mentor");
    const b = parse(
      z.object({ answers: z.record(z.string(), z.number().int().min(0).max(5)) }),
      req.body,
    );
    return tx(db, async (c) => {
      const a = (
        await c.query<AttemptRow>(
          "select * from skill_attempts where id::text = $1 and mentor_id = $2 for update",
          [req.params.id, s.user.id],
        )
      ).rows[0];
      if (!a) throw new ApiError("not_found", "Attempt not found");
      if (a.submitted_at) throw new ApiError("conflict", "Already submitted");
      // 30 s of grace for the network.
      const late = Date.now() > a.deadline.getTime() + 30_000;
      const key = (
        await c.query<{ id: string; correct: number }>(
          "select id, correct from skill_questions where id = any($1::uuid[])",
          [a.question_ids],
        )
      ).rows;
      const right = late ? 0 : key.filter((q) => b.answers[q.id] === q.correct).length;
      const score = key.length ? Math.round((right / key.length) * 100) : 0;
      const t = (
        await c.query<{ pass_pct: number }>("select pass_pct from skill_tests where id = $1", [
          a.test_id,
        ])
      ).rows[0]!;
      const passed = score >= t.pass_pct;
      await c.query(
        "update skill_attempts set submitted_at = now(), score_pct = $2, passed = $3 where id = $1",
        [a.id, score, passed],
      );
      return { scorePct: score, passed, passPct: t.pass_pct, late };
    });
  });
};
