import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { grant, signIn, student, useHarness, type Ctx } from "./harness.ts";
import { freshSubject, mentor, PDF, placeOrder, type Person } from "./market.ts";

const ctx = useHarness();

async function admin(name: string) {
  const a = await signIn(ctx, name);
  await grant(ctx, a.sub, "admin");
  return a;
}

/** Uploads one verification document the way the browser does. */
async function doc(c: Ctx, m: Person, kind: string, body: Buffer, contentType: string) {
  const start = await m.b.post("/mentor/verification/files", {
    kind,
    name: `${kind}.file`,
    contentType,
    byteSize: body.length,
  });
  expect(start.statusCode, start.body).toBe(200);
  const { fileId, uploadUrl } = start.json() as { fileId: string; uploadUrl: string };
  const put = await c.app.inject({
    method: "PUT",
    url: uploadUrl.replace(/^\/api/, ""),
    headers: { "content-type": contentType, origin: "http://localhost:3200" },
    payload: body,
  });
  return { fileId, put };
}

const jpegWithExif = () =>
  sharp({ create: { width: 30, height: 30, channels: 3, background: "#ccc" } })
    .withExif({ IFD0: { Make: "SecretPhone" } })
    .jpeg()
    .toBuffer();

describe("mentor verification", () => {
  it("documents → request → a different admin approves → verified badge; rejection needs a reason", async () => {
    const m = await mentor(ctx, "Verifying Mentor");
    // Nothing to submit yet.
    expect((await m.b.post("/mentor/verification", {})).statusCode).toBe(400);
    const id = await doc(ctx, m, "identity", await jpegWithExif(), "image/jpeg");
    expect(id.put.statusCode).toBe(200);
    // Fake content is refused.
    const fake = await doc(ctx, m, "qualification", Buffer.from("not a pdf"), "application/pdf");
    expect(fake.put.statusCode).toBe(400);
    // Only identity uploaded so far: a qualification is still required.
    expect((await m.b.post("/mentor/verification", {})).statusCode).toBe(400);
    expect((await doc(ctx, m, "qualification", PDF, "application/pdf")).put.statusCode).toBe(200);
    const req = await m.b.post("/mentor/verification", { note: "HSC 2020, BSc Botany" });
    expect(req.statusCode, req.body).toBe(201);
    const v = req.json() as { id: string; files: { id: string }[] };
    expect(v.files).toHaveLength(2);
    // One pending request at a time.
    expect((await doc(ctx, m, "identity", PDF, "application/pdf")).put.statusCode).toBe(200);
    expect((await m.b.post("/mentor/verification", {})).statusCode).toBe(409);

    // Documents are private: others get 404; EXIF is gone for reviewers.
    const other = await student(ctx, "Curious Student");
    expect((await other.b.get(`/verification-files/${id.fileId}`)).statusCode).toBe(404);
    expect((await other.b.get("/admin/verifications")).statusCode).toBe(403);
    const a = await admin("Reviewing Admin");
    const file = await a.b.get(`/verification-files/${id.fileId}`);
    expect(file.statusCode).toBe(200);
    expect(file.headers["content-security-policy"]).toContain("sandbox");
    expect((await sharp(file.rawPayload).metadata()).exif).toBeUndefined();

    // Rejection needs a reason; approval makes the mentor verified.
    expect(
      (await a.b.post(`/admin/verifications/${v.id}/decision`, { approve: false })).statusCode,
    ).toBe(400);
    const ok = await a.b.post(`/admin/verifications/${v.id}/decision`, { approve: true });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(
      (await a.b.post(`/admin/verifications/${v.id}/decision`, { approve: true })).statusCode,
    ).toBe(409);
    const status = (await m.b.get("/mentor/verification")).json();
    expect(status).toMatchObject({ verified: true, latest: { status: "approved" } });
    const badges = (await m.b.get(`/mentors/${m.id}/badges`)).json() as {
      id: string;
      paid: boolean;
    }[];
    expect(badges).toContainEqual({ id: "verified", label: "Verified mentor", paid: false });

    // Revoking is audited and removes the badge.
    expect(
      (await a.b.post(`/admin/mentors/${m.id}/unverify`, { note: "NID expired" })).statusCode,
    ).toBe(200);
    expect(
      ((await m.b.get(`/mentors/${m.id}/badges`)).json() as { id: string }[]).map((b) => b.id),
    ).not.toContain("verified");
    const audit = (await (await signInSuper()).b.get("/admin/audit")).json() as {
      action: string;
    }[];
    expect(audit.map((e) => e.action)).toEqual(
      expect.arrayContaining([
        "verification.approve",
        "verification.revoke",
        "verification.file_viewed",
      ]),
    );
  });

  it("documents are deleted 6 months after the decision; pending ones are kept", async () => {
    const { purgeVerificationDocs } = await import("../src/routes/trust.ts");
    const m = await mentor(ctx, "Retained Mentor");
    const idDoc = await doc(ctx, m, "identity", PDF, "application/pdf");
    await doc(ctx, m, "qualification", PDF, "application/pdf");
    const v = (await m.b.post("/mentor/verification", {})).json() as { id: string };
    const a = await admin("Retention Admin");
    // Pending: kept even when old.
    await ctx.db.query(
      "update mentor_verifications set created_at = now() - interval '400 days' where id = $1",
      [v.id],
    );
    await purgeVerificationDocs(ctx.db, ctx.app.edkDeps.config);
    expect((await a.b.get(`/verification-files/${idDoc.fileId}`)).statusCode).toBe(200);
    await a.b.post(`/admin/verifications/${v.id}/decision`, { approve: true });
    // Decided 5 months ago: kept; 7 months ago: deleted (bytes and access), status stays.
    await ctx.db.query(
      "update mentor_verifications set reviewed_at = now() - interval '150 days' where id = $1",
      [v.id],
    );
    await purgeVerificationDocs(ctx.db, ctx.app.edkDeps.config);
    expect((await a.b.get(`/verification-files/${idDoc.fileId}`)).statusCode).toBe(200);
    await ctx.db.query(
      "update mentor_verifications set reviewed_at = now() - interval '210 days' where id = $1",
      [v.id],
    );
    expect(await purgeVerificationDocs(ctx.db, ctx.app.edkDeps.config)).toBe(2);
    expect((await a.b.get(`/verification-files/${idDoc.fileId}`)).statusCode).toBe(404);
    const q = (await a.b.get("/admin/verifications")).json() as {
      id: string;
      files: { deletedAt?: string }[];
    }[];
    expect(q.find((x) => x.id === v.id)!.files.every((f) => f.deletedAt)).toBe(true);
    expect((await m.b.get("/mentor/verification")).json().verified).toBe(true);
  });

  it("an admin who is also the mentor can't approve their own request", async () => {
    const m = await mentor(ctx, "Admin Mentor");
    await grant(ctx, m.sub, "admin");
    await doc(ctx, m, "identity", PDF, "application/pdf");
    await doc(ctx, m, "qualification", PDF, "application/pdf");
    const v = (await m.b.post("/mentor/verification", {})).json() as { id: string };
    expect(
      (await m.b.post(`/admin/verifications/${v.id}/decision`, { approve: true })).statusCode,
    ).toBe(403);
  });

  it("verified mentors rank first; with 'verified only' unverified mentors get no offers", async () => {
    const subject = await freshSubject(ctx);
    const plain = await mentor(ctx, `Plain ${subject}`, { subjects: [subject] });
    const checked = await mentor(ctx, `Checked ${subject}`, { subjects: [subject] });
    await ctx.db.query("update mentor_profiles set verified_at = now() where user_id = $1", [
      checked.id,
    ]);
    const s = await student(ctx, `Ranking Student ${subject}`);
    const dir = (await s.b.get(`/mentors?subject=${subject}`)).json() as { id: string }[];
    expect(dir.map((d) => d.id)).toEqual([checked.id, plain.id]);

    const su = await signInSuper();
    expect((await su.b.put("/admin/settings", { require_verified_mentors: true })).statusCode).toBe(
      200,
    );
    try {
      const o = await placeOrder(s, { subjectId: subject });
      const cands = (await su.b.get(`/admin/orders/${o.id}/candidates`)).json() as { id: string }[];
      expect(cands.map((c) => c.id)).toEqual([checked.id]);
    } finally {
      await su.b.put("/admin/settings", { require_verified_mentors: false });
    }
  });
});

async function signInSuper() {
  const s = await signIn(ctx, `Super ${Math.random()}`);
  await grant(ctx, s.sub, "super_admin");
  return s;
}

describe("skill tests", () => {
  const questions = [
    { prompt: "Chlorophyll is found in?", options: ["Mitochondria", "Chloroplast"], correct: 1 },
    { prompt: "Unit of heredity?", options: ["Gene", "Cell", "Tissue"], correct: 0 },
    { prompt: "Photosynthesis releases?", options: ["CO2", "O2"], correct: 1 },
    { prompt: "Plant cell wall is made of?", options: ["Cellulose", "Chitin"], correct: 0 },
  ];

  it("graded on the server, answers never sent; pass gives a badge; fail waits for the retake period", async () => {
    const a = await admin("Test Author");
    const subject = await freshSubject(ctx);
    const bad = await a.b.post("/admin/skill-tests", {
      subjectId: subject,
      title: "Broken",
      questions: [...questions.slice(0, 2), { prompt: "Bad one", options: ["a", "b"], correct: 5 }],
    });
    expect(bad.statusCode).toBe(400);
    const t = await a.b.post("/admin/skill-tests", {
      subjectId: subject,
      title: "Biology basics",
      passPct: 75,
      durationMin: 10,
      questions,
    });
    expect(t.statusCode, t.body).toBe(201);
    const testId = (t.json() as { id: string }).id;

    const m = await mentor(ctx, "Test Taker");
    const start = await m.b.post(`/mentor/skill-tests/${testId}/start`);
    expect(start.statusCode, start.body).toBe(200);
    const att = start.json() as {
      attemptId: string;
      questions: { id: string; prompt: string; options: string[]; correct?: number }[];
    };
    expect(att.questions).toHaveLength(4);
    expect(att.questions.every((q) => q.correct === undefined)).toBe(true);
    expect(start.body).not.toContain('"correct"');
    // Starting again resumes the same attempt.
    expect(
      ((await m.b.post(`/mentor/skill-tests/${testId}/start`)).json() as { attemptId: string })
        .attemptId,
    ).toBe(att.attemptId);

    // Half right: fails (75% needed).
    const answers = Object.fromEntries(
      att.questions.map((q, i) => {
        const right = questions.find((x) => x.prompt === q.prompt)!.correct;
        return [q.id, i < 2 ? right : (right + 1) % q.options.length];
      }),
    );
    const r = await m.b.post(`/mentor/skill-attempts/${att.attemptId}/submit`, { answers });
    expect(r.json()).toMatchObject({ scorePct: 50, passed: false });
    expect(
      (await m.b.post(`/mentor/skill-attempts/${att.attemptId}/submit`, { answers })).statusCode,
    ).toBe(409);
    // Retake waits for the period.
    expect((await m.b.post(`/mentor/skill-tests/${testId}/start`)).statusCode).toBe(409);
    const list = (await m.b.get("/mentor/skill-tests")).json() as {
      id: string;
      retakeAt: string | null;
      lastScorePct: number;
    }[];
    expect(list.find((x) => x.id === testId)).toMatchObject({ lastScorePct: 50 });
    expect(list.find((x) => x.id === testId)!.retakeAt).not.toBeNull();

    // After the period: all right → passed and badge; no more attempts.
    await ctx.db.query(
      "update skill_attempts set submitted_at = now() - interval '8 days' where id = $1",
      [att.attemptId],
    );
    const again = (await m.b.post(`/mentor/skill-tests/${testId}/start`)).json() as typeof att;
    const allRight = Object.fromEntries(
      again.questions.map((q) => [q.id, questions.find((x) => x.prompt === q.prompt)!.correct]),
    );
    expect(
      (
        await m.b.post(`/mentor/skill-attempts/${again.attemptId}/submit`, { answers: allRight })
      ).json(),
    ).toMatchObject({ scorePct: 100, passed: true });
    expect((await m.b.post(`/mentor/skill-tests/${testId}/start`)).statusCode).toBe(409);
    const badges = (await m.b.get(`/mentors/${m.id}/badges`)).json() as { id: string }[];
    expect(badges.some((b) => b.id.startsWith("skill:"))).toBe(true);

    // Someone else's attempt is not found; questions can't change once taken.
    const other = await mentor(ctx, "Other Taker");
    expect(
      (await other.b.post(`/mentor/skill-attempts/${again.attemptId}/submit`, { answers: {} }))
        .statusCode,
    ).toBe(404);
    expect(
      (
        await a.b.put(`/admin/skill-tests/${testId}`, {
          title: "Biology basics",
          passPct: 75,
          durationMin: 10,
          active: true,
          questions,
        })
      ).statusCode,
    ).toBe(409);
    // Mentors can't create tests.
    expect(
      (await m.b.post("/admin/skill-tests", { subjectId: subject, title: "Mine", questions }))
        .statusCode,
    ).toBe(403);
  });

  it("answers after the time limit score zero", async () => {
    const a = await admin("Timer Admin");
    const subject = await freshSubject(ctx);
    const testId = (
      (
        await a.b.post("/admin/skill-tests", {
          subjectId: subject,
          title: "Timed",
          durationMin: 1,
          questions,
        })
      ).json() as { id: string }
    ).id;
    const m = await mentor(ctx, "Slow Taker");
    const att = (await m.b.post(`/mentor/skill-tests/${testId}/start`)).json() as {
      attemptId: string;
      questions: { id: string; prompt: string }[];
    };
    await ctx.db.query(
      "update skill_attempts set deadline = now() - interval '5 minutes' where id = $1",
      [att.attemptId],
    );
    const allRight = Object.fromEntries(
      att.questions.map((q) => [q.id, questions.find((x) => x.prompt === q.prompt)!.correct]),
    );
    expect(
      (
        await m.b.post(`/mentor/skill-attempts/${att.attemptId}/submit`, { answers: allRight })
      ).json(),
    ).toMatchObject({ scorePct: 0, passed: false, late: true });
  });
});
