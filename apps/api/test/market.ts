/** Helpers for marketplace tests: mentors with profiles, orders, file uploads. */
import { expect } from "vitest";
import { grant, student, type Ctx } from "./harness.ts";

export type Person = Awaited<ReturnType<typeof student>>;

export async function mentor(
  ctx: Ctx,
  name: string,
  profile: Partial<Record<string, unknown>> = {},
) {
  const m = await student(ctx, name);
  await grant(ctx, m.sub, "mentor");
  const r = await m.b.put("/mentor/profile", {
    headline: "",
    bio: "",
    institution: "",
    education: "",
    subjects: ["biology"],
    workTypes: ["practical_khata", "biology_drawing"],
    levels: ["hsc"],
    available: true,
    capacity: 3,
    ...profile,
  });
  expect(r.statusCode, r.body).toBe(200);
  return m;
}

export const inDays = (d: number) => new Date(Date.now() + d * 24 * 3600_000).toISOString();

export async function placeOrder(s: Person, extra: Record<string, unknown> = {}) {
  const r = await s.b.post("/orders", {
    categorySlug: "practical-khata",
    subjectId: "biology",
    level: "hsc",
    workType: "practical_khata",
    pages: 10,
    deliveryMethod: "digital",
    title: "Biology practical khata, chapter 3",
    instructions: "Board: Dhaka. Chapter 3 experiments with labelled drawings, neat handwriting.",
    deadline: inDays(3),
    ...extra,
  });
  expect(r.statusCode, r.body).toBe(201);
  return r.json() as { id: string; code: string; status: string; price: { amountMinor: number } };
}

/** Full three-step upload as the browser does it. */
export async function upload(
  ctx: Ctx,
  who: Person,
  orderId: string,
  stage: string,
  body: Buffer,
  contentType: string,
  name = "file",
) {
  const start = await who.b.post(`/orders/${orderId}/files`, {
    stage,
    name,
    contentType,
    byteSize: body.length,
  });
  if (start.statusCode !== 201) return { start };
  const { fileId, uploadUrl } = start.json() as { fileId: string; uploadUrl: string };
  const put = await ctx.app.inject({
    method: "PUT",
    url: uploadUrl.replace(/^\/api/, ""),
    headers: { "content-type": contentType, origin: "http://localhost:3200" },
    payload: body,
  });
  const done = await who.b.post(`/orders/${orderId}/files/${fileId}/complete`);
  return { start, put, done, fileId };
}

export const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

let subjects = 0;
/** A subject only this test uses, so mentors from other tests aren't candidates. */
export async function freshSubject(ctx: Ctx): Promise<string> {
  const id = `t-subject-${++subjects}-${Date.now() % 100000}`;
  await ctx.db.query(
    "insert into subjects (id, name, name_bn, levels) values ($1, $1, $1, '{hsc}')",
    [id],
  );
  return id;
}
