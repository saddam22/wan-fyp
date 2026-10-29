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

export async function accountant(ctx: Ctx, name: string) {
  const a = await student(ctx, name);
  await grant(ctx, a.sub, "accountant");
  return a;
}

/** A receiving account (bKash personal by default). */
export async function account(ctx: Ctx, by: Person, extra: Record<string, unknown> = {}) {
  const r = await by.b.post("/accountant/payment-accounts", {
    method: "bkash",
    channel: "personal",
    name: "bKash",
    number: "01700000000",
    instructions: ["Send Money to this number"],
    ...extra,
  });
  expect(r.statusCode, r.body).toBe(201);
  return r.json() as { key: string };
}

let trx = 0;
/** A TrxID nobody used yet. */
export const newTrx = () => `TX${Date.now().toString(36).toUpperCase()}${++trx}`;

/** An order that was paid (approved by an accountant) and accepted + started by a mentor. */
export async function paidOrder(ctx: Ctx, extra: Record<string, unknown> = {}) {
  const acc = await accountant(ctx, `Acct ${Date.now() % 100000}`);
  const bk = await account(ctx, acc);
  const subject = await freshSubject(ctx);
  const m = await mentor(ctx, `Earning Mentor ${subject}`, { subjects: [subject] });
  const s = await student(ctx, `Paying ${subject}`);
  const o = await placeOrder(s, { subjectId: subject, ...extra });
  const pid = (await s.b.get(`/orders/${o.id}/payment`)).json().due.id as string;
  expect(
    (
      await s.b.post(`/payments/${pid}/submit`, {
        accountId: bk.key,
        sender: "01766666666",
        trxId: newTrx(),
      })
    ).statusCode,
  ).toBe(200);
  expect(
    (await acc.b.post(`/accountant/payments/${pid}/decision`, { approve: true })).statusCode,
  ).toBe(200);
  const offer = (await m.b.get("/mentor/offers")).json()[0];
  expect((await m.b.post(`/mentor/offers/${offer.id}/accept`)).statusCode).toBe(200);
  expect((await m.b.post(`/mentor/orders/${o.id}/start`)).statusCode).toBe(200);
  return { acc, bk, m, s, o, pid };
}

/** The mentor delivers a preview and a final file. */
export async function deliverWork(ctx: Ctx, m: Person, orderId: string) {
  const sharp = (await import("sharp")).default;
  const png = await sharp({ create: { width: 40, height: 40, channels: 3, background: "#fff" } })
    .png()
    .toBuffer();
  await upload(ctx, m, orderId, "preview", png, "image/png");
  await upload(ctx, m, orderId, "final", PDF, "application/pdf");
  const r = await m.b.post(`/mentor/orders/${orderId}/deliver`, {});
  expect(r.statusCode, r.body).toBe(200);
}
