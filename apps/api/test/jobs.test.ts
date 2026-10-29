import { describe, expect, it } from "vitest";
import { grant, signIn, student, useHarness, WEB, type Ctx } from "./harness.ts";
import { mentor, PDF, type Person } from "./market.ts";

const ctx = useHarness();

/** CV upload through the module's signed URL, as the browser does it. */
async function uploadCv(c: Ctx, p: Person, body: Buffer) {
  const t = await p.b.post("/local/files", {
    purpose: "document",
    contentType: "application/pdf",
    byteSize: body.length,
    fileName: "cv.pdf",
  });
  expect(t.statusCode, t.body).toBe(201);
  const { id, uploadUrl } = t.json() as { id: string; uploadUrl: string };
  const put = await c.app.inject({
    method: "PUT",
    url: uploadUrl.replace(/^https?:\/\/[^/]+\/api/, ""),
    headers: { "content-type": "application/pdf", origin: WEB },
    payload: body,
  });
  expect(put.statusCode, put.body).toBe(200);
  const done = await p.b.post(`/local/files/${id}/complete`);
  return { id, done };
}

const job = (employerId: string) => ({
  employerId,
  title: "HSC Biology home tutor (Mirpur)",
  description: "Three days a week for an HSC 2nd year student. Practical khata guidance included.",
  category: "education",
  employmentType: "part_time",
  workMode: "onsite",
  salary: { min: 6000, max: 8000, period: "month" },
  deadline: new Date(Date.now() + 10 * 86_400_000).toISOString(),
});

describe("jobs and tuition board (marketplace-jobs module)", () => {
  it("post a job → public listing → a mentor applies with a private CV → status notifies the applicant", async () => {
    // Anyone may read published jobs; writing needs an EduKhata session.
    expect((await ctx.app.inject({ method: "GET", url: "/local/jobs" })).statusCode).toBe(200);
    expect(
      (
        await ctx.app.inject({
          method: "POST",
          url: "/local/jobs/employers",
          headers: { origin: WEB },
          payload: { name: "X" },
        })
      ).statusCode,
    ).toBe(401);

    const owner = await student(ctx, "Coaching Owner");
    const e = await owner.b.post("/local/jobs/employers", {
      name: "Udvash Coaching Mirpur",
      description: "Coaching centre for SSC and HSC science.",
      area: "Mirpur, Dhaka",
    });
    expect(e.statusCode, e.body).toBe(201);
    const employerId = (e.json() as { id: string }).id;
    const j = await owner.b.post("/local/jobs", job(employerId));
    expect(j.statusCode, j.body).toBe(201);
    const jobId = (j.json() as { id: string }).id;
    const list = (await ctx.app.inject({ method: "GET", url: "/local/jobs" })).json() as {
      items: { id: string }[];
    };
    expect(list.items.map((x) => x.id)).toContain(jobId);

    // A mentor applies with a CV; fake PDFs are refused by the module's content check.
    const m = await mentor(ctx, "Applying Mentor");
    const fake = await uploadCv(ctx, m, Buffer.from("not a pdf at all"));
    expect(fake.done.statusCode).not.toBe(200);
    const cv = await uploadCv(ctx, m, PDF);
    expect(cv.done.statusCode, cv.done.body).toBe(200);
    const a = await m.b.post(`/local/jobs/${jobId}/applications`, {
      coverLetter: "I teach HSC biology and practical khata.",
      cvFileId: cv.id,
    });
    expect(a.statusCode, a.body).toBe(201);
    const appId = (a.json() as { id: string }).id;

    // The CV is private: the employer can read it, someone else can't.
    expect((await owner.b.get(`/local/jobs/applications/${appId}/cv`)).statusCode).toBe(200);
    const other = await student(ctx, "Curious Other");
    expect([403, 404]).toContain(
      (await other.b.get(`/local/jobs/applications/${appId}/cv`)).statusCode,
    );

    // The employer shortlists; the mentor gets it in the EduKhata inbox.
    expect(
      (await owner.b.post(`/local/jobs/applications/${appId}/status`, { status: "shortlisted" }))
        .statusCode,
    ).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    const n = (await m.b.get("/me/notifications")).json() as {
      items: { type: string; link: string }[];
    };
    const note = n.items.find((x) => x.type === "jobs.update");
    expect(note).toBeTruthy();
    expect(note!.link.startsWith("/jobs")).toBe(true);
  });

  it("employer verification is for EduKhata admins; the module's own role management is closed", async () => {
    const owner = await student(ctx, "Verified Owner");
    const employerId = (
      (await owner.b.post("/local/jobs/employers", { name: "Notre Dame Tutors" })).json() as {
        id: string;
      }
    ).id;
    const body = { status: "verified", note: "Trade licence checked" };
    expect(
      (await owner.b.post(`/local/jobs/employers/${employerId}/verification`, body)).statusCode,
    ).toBe(403);
    const a = await signIn(ctx, "Jobs Admin");
    await grant(ctx, a.sub, "admin");
    const r = await a.b.post(`/local/jobs/employers/${employerId}/verification`, body);
    expect(r.statusCode, r.body).toBe(200);
    expect((r.json() as { verification: { status: string } }).verification.status).toBe("verified");
    expect((await a.b.get("/local/admin/jobs/verification-queue")).statusCode).toBe(200);
    expect((await owner.b.get("/local/admin/jobs/verification-queue")).statusCode).toBe(403);
    expect((await a.b.put(`/local/admin/roles/${owner.id}/admin`, {})).statusCode).toBe(403);
  });
});
