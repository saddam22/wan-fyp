import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { grant, guardian, signIn, student, useHarness } from "./harness.ts";
import { freshSubject, mentor, placeOrder, type Person } from "./market.ts";

const ctx = useHarness();
const token = async (p: Person) =>
  ((await p.b.get("/me/chat-token")).json() as { token: string }).token;
const chat = async (p: Person, method: string, url: string, body?: object) =>
  ctx.app.inject({
    method: method as "GET",
    url: `/chat${url}`,
    headers: {
      authorization: `Bearer ${await token(p)}`,
      ...(method !== "GET" ? { origin: "http://localhost:3200" } : {}),
    },
    ...(body ? { payload: body } : {}),
  });
const say = (p: Person, conv: string, body: string) =>
  chat(p, "POST", `/conversations/${conv}/messages`, {
    clientMessageId: randomUUID(),
    kind: "text",
    body,
  });

async function assigned(extraMentors = 0) {
  const subject = await freshSubject(ctx);
  const m = await mentor(ctx, `Chat Mentor ${subject}`, { subjects: [subject] });
  const others: Person[] = [];
  for (let i = 0; i < extraMentors; i++)
    others.push(await mentor(ctx, `Other Mentor ${subject} ${i}`, { subjects: [subject] }));
  const s = await student(ctx, `Chat Student ${subject}`);
  const o = await placeOrder(s, { subjectId: subject });
  await ctx.app.edkDeps.matching.startMatching(o.id, null);
  const admin = await signIn(ctx, `Chat Admin ${subject}`);
  await grant(ctx, admin.sub, "admin");
  expect((await admin.b.post(`/admin/orders/${o.id}/assign`, { mentorId: m.id })).statusCode).toBe(
    200,
  );
  return { o, m, s, admin, others };
}

describe("order chats (chat module) and reviews", () => {
  it("assignment opens the order chat between the student and the mentor; guardians don't see it", async () => {
    const { o, m, s } = await assigned();
    const view = (await s.b.get(`/orders/${o.id}`)).json();
    expect(view.conversationId).toBeTruthy();
    expect((await m.b.get(`/orders/${o.id}`)).json().conversationId).toBe(view.conversationId);
    expect((await say(s, view.conversationId, "Please use blue ink")).statusCode).toBe(201);
    expect((await say(m, view.conversationId, "Sure, noted")).statusCode).toBe(201);

    const g = await guardian(ctx, `Chat Guardian ${o.code}`);
    const code = (await s.b.post("/me/guardian-code")).json().code;
    await g.b.post("/guardian/children", { contact: `${s.sub.slice(0, 8)}@example.com`, code });
    expect((await g.b.get(`/orders/${o.id}`)).json()).not.toHaveProperty("conversationId");
    expect(
      (await chat(g as Person, "GET", `/conversations/${view.conversationId}`)).statusCode,
    ).toBe(404);
  });

  it("a replaced mentor can't message the student any more; the new mentor can", async () => {
    const { o, m, s, admin, others } = await assigned(1);
    const first = (await s.b.get(`/orders/${o.id}`)).json().conversationId;
    const next = others[0]!;
    expect(
      (await admin.b.post(`/admin/orders/${o.id}/assign`, { mentorId: next.id, note: "swap" }))
        .statusCode,
    ).toBe(200);
    expect((await say(m, first, "Can we continue on WhatsApp?")).statusCode).not.toBe(201);
    // The old chat stays readable for both, but marked read-only.
    const old = (await chat(m, "POST", "/conversations/direct", { userId: s.id })).json()
      .conversation;
    expect(old).toMatchObject({ id: first, canSend: false });
    const second = (await s.b.get(`/orders/${o.id}`)).json().conversationId;
    expect(second).not.toBe(first);
    expect((await say(next, second, "Hello, I'm taking over")).statusCode).toBe(201);
  });

  it("reviews after approval, once; contact details are held for moderation", async () => {
    const { o, m, s, admin } = await assigned();
    expect((await s.b.post(`/orders/${o.id}/review`, { rating: 5 })).statusCode).toBe(409);
    await ctx.db.query("update orders set status = 'approved', approved_at = now() where id = $1", [
      o.id,
    ]);
    expect((await s.b.post(`/orders/${o.id}/review`, { rating: 9 })).statusCode).toBe(400);
    expect(
      (
        await s.b.post(`/orders/${o.id}/review`, { rating: 5, text: "Beautiful labelled drawings" })
      ).json(),
    ).toEqual({ status: "published" });
    expect((await s.b.post(`/orders/${o.id}/review`, { rating: 1 })).statusCode).toBe(409);
    const pub = (await s.b.get(`/mentors/${m.id}/reviews`)).json();
    expect(pub).toMatchObject({
      rating: 5,
      count: 1,
      items: [{ rating: 5, studentName: "Chat", orderCode: o.code }],
    });
    const dir = (await s.b.get("/mentors")).json().find((x: { id: string }) => x.id === m.id);
    expect(dir).toMatchObject({ rating: 5, reviewCount: 1 });

    // A second order with a review that leaks a phone number.
    const o2 = await placeOrder(s, {
      subjectId: (await ctx.db.query("select subject_id from orders where id = $1", [o.id])).rows[0]
        .subject_id,
    });
    await ctx.db.query("update orders set status = 'approved', mentor_id = $2 where id = $1", [
      o2.id,
      m.id,
    ]);
    expect(
      (
        await s.b.post(`/orders/${o2.id}/review`, {
          rating: 4,
          text: "Call him directly on ০১৭১১-২২৩৩৪৪",
        })
      ).json(),
    ).toEqual({ status: "pending" });
    expect((await s.b.get(`/mentors/${m.id}/reviews`)).json().count).toBe(1);
    const pending = (await admin.b.get("/admin/reviews?status=pending"))
      .json()
      .find((r: { orderCode: string }) => r.orderCode === o2.code);
    expect(
      (await s.b.post(`/admin/reviews/${pending.id}/moderate`, { status: "published" })).statusCode,
    ).toBe(403);
    expect(
      (
        await admin.b.post(`/admin/reviews/${pending.id}/moderate`, {
          status: "hidden",
          note: "Contact details",
        })
      ).statusCode,
    ).toBe(200);
    expect((await s.b.get(`/mentors/${m.id}/reviews`)).json().count).toBe(1);
  });

  it("after closure the order chat is read-only", async () => {
    const { o, m, s } = await assigned();
    const conv = (await s.b.get(`/orders/${o.id}`)).json().conversationId;
    await ctx.db.query("update orders set status = 'closed', closed_at = now() where id = $1", [
      o.id,
    ]);
    expect((await say(s, conv, "Thanks again!")).statusCode).not.toBe(201);
    expect((await chat(s, "GET", `/conversations/${conv}/messages`)).statusCode).toBe(200);
    void m;
  });
});
