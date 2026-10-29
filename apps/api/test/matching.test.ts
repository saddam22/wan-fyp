import { describe, expect, it } from "vitest";
import { grant, signIn, student, useHarness } from "./harness.ts";
import { freshSubject, mentor, placeOrder, type Person } from "./market.ts";

const ctx = useHarness();
const matching = () => ctx.app.edkDeps.matching;

async function setup(n: number, profile: Record<string, unknown> = {}) {
  const subject = await freshSubject(ctx);
  const mentors: Person[] = [];
  for (let i = 0; i < n; i++)
    mentors.push(await mentor(ctx, `Mentor ${subject} ${i}`, { subjects: [subject], ...profile }));
  const s = await student(ctx, `Student ${subject}`);
  return { subject, mentors, s };
}
async function matchingOrder(s: Person, subject: string, extra: Record<string, unknown> = {}) {
  const o = await placeOrder(s, { subjectId: subject, ...extra });
  await matching().startMatching(o.id, null);
  return o;
}
const offers = async (m: Person) =>
  (await m.b.get("/mentor/offers")).json() as {
    id: string;
    orderId: string;
    payout: { amountMinor: number };
  }[];
const expireAll = (orderId: string) =>
  ctx.db.query(
    "update order_offers set expires_at = now() - interval '1 second' where order_id = $1 and status = 'offered'",
    [orderId],
  );

describe("automatic order matching", () => {
  it("offers a wave to eligible mentors only, with the mentor's 80% payout", async () => {
    const { subject, mentors, s } = await setup(4);
    const busy = await mentor(ctx, `Unavailable ${subject}`, {
      subjects: [subject],
      available: false,
    });
    const wrongType = await mentor(ctx, `Wrong type ${subject}`, {
      subjects: [subject],
      workTypes: ["digital"],
    });
    const o = await matchingOrder(s, subject);
    const offered = [];
    for (const m of [...mentors, busy, wrongType]) offered.push((await offers(m)).length);
    // Wave size 3 among the 4 eligible; the unavailable and wrong-type mentors get nothing.
    expect(offered.slice(0, 4).reduce((a, b) => a + b, 0)).toBe(3);
    expect(offered.slice(4)).toEqual([0, 0]);
    const anyOffer = (await Promise.all(mentors.map(offers))).flat()[0]!;
    expect(anyOffer.orderId).toBe(o.id);
    expect(anyOffer.payout.amountMinor).toBe(40000); // 80% of ৳500
    expect(JSON.stringify(anyOffer)).not.toContain(`Student ${subject}`);
  });

  it("exactly one of several simultaneous acceptances wins", async () => {
    for (let round = 0; round < 5; round++) {
      const { subject, mentors, s } = await setup(3);
      const o = await matchingOrder(s, subject);
      const mine = await Promise.all(
        mentors.map(async (m) => ({ m, offer: (await offers(m))[0]! })),
      );
      const results = await Promise.all(
        mine.map(({ m, offer }) => m.b.post(`/mentor/offers/${offer.id}/accept`)),
      );
      expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409, 409]);
      const winner = mine[results.findIndex((r) => r.statusCode === 200)]!.m;
      const order = (await s.b.get(`/orders/${o.id}`)).json();
      expect(order).toMatchObject({ status: "assigned", mentorId: winner.id });
      const rows = (
        await ctx.db.query("select status from order_offers where order_id = $1 order by status", [
          o.id,
        ])
      ).rows.map((r) => r.status);
      expect(rows).toEqual(["accepted", "withdrawn", "withdrawn"]);
      for (const { m } of mine) expect(await offers(m)).toEqual([]);
    }
  });

  it("a mentor at capacity can't take a second order, even with simultaneous accepts", async () => {
    const { subject, mentors, s } = await setup(1, { capacity: 1 });
    const m = mentors[0]!;
    const o1 = await matchingOrder(s, subject);
    const o2 = await matchingOrder(s, subject);
    const mine = await offers(m);
    expect(mine.map((x) => x.orderId).sort()).toEqual([o1.id, o2.id].sort());
    const r = await Promise.all(mine.map((x) => m.b.post(`/mentor/offers/${x.id}/accept`)));
    expect(r.map((x) => x.statusCode).sort()).toEqual([200, 409]);
  });

  it("declines and expiry move to the next wave; after the last wave an admin is asked", async () => {
    const { subject, mentors, s } = await setup(5);
    const admin = await signIn(ctx, `Matching Admin ${subject}`);
    await grant(ctx, admin.sub, "admin");
    const o = await matchingOrder(s, subject);
    let open = (await Promise.all(mentors.map(async (m) => ({ m, list: await offers(m) })))).filter(
      (x) => x.list.length,
    );
    expect(open).toHaveLength(3);
    // Everyone in wave 1 declines → wave 2 goes out at once to the remaining two.
    for (const { m, list } of open)
      expect((await m.b.post(`/mentor/offers/${list[0]!.id}/decline`)).statusCode).toBe(200);
    open = (await Promise.all(mentors.map(async (m) => ({ m, list: await offers(m) })))).filter(
      (x) => x.list.length,
    );
    expect(open).toHaveLength(2);
    // Wave 2 expires → the sweep finds no one left → admin queue + notification.
    await expireAll(o.id);
    await matching().sweep();
    const staffView = (await admin.b.get(`/orders/${o.id}`)).json();
    expect(staffView).toMatchObject({ status: "matching", needsManualAssignment: true });
    expect(staffView.timeline.map((e: { kind: string }) => e.kind)).toEqual([
      "created",
      "matching",
      "offered",
      "offered",
      "needs_assignment",
    ]);
    await new Promise((r) => setTimeout(r, 50));
    const n = (await admin.b.get("/me/notifications"))
      .json()
      .items.find((x: { type: string }) => x.type === "order.needs_assignment");
    expect(n.link).toBe(`/admin/orders/${o.id}`);
    // Expired offers can't be accepted.
    const old = (
      await ctx.db.query(
        "select id, mentor_id from order_offers where order_id = $1 and status = 'expired' limit 1",
        [o.id],
      )
    ).rows[0];
    const late = mentors.find((m) => m.id === old.mentor_id)!;
    expect((await late.b.post(`/mentor/offers/${old.id}/accept`)).statusCode).toBe(409);
  });

  it("the student's chosen mentor gets the first, exclusive offer", async () => {
    const { subject, mentors, s } = await setup(3);
    const chosen = mentors[2]!;
    const o = await matchingOrder(s, subject, { preferredMentorId: chosen.id });
    expect((await offers(chosen)).map((x) => x.orderId)).toEqual([o.id]);
    expect((await offers(mentors[0]!)).length + (await offers(mentors[1]!)).length).toBe(0);
    await chosen.b.post(`/mentor/offers/${(await offers(chosen))[0]!.id}/decline`);
    // Then normal matching among the others.
    expect((await offers(mentors[0]!)).length + (await offers(mentors[1]!)).length).toBe(2);
  });

  it("admins assign and reassign; mentors start or release; offers are private", async () => {
    const { subject, mentors, s } = await setup(2);
    const [a, b] = mentors as [Person, Person];
    const admin = await signIn(ctx, `Assign Admin ${subject}`);
    await grant(ctx, admin.sub, "admin");
    const o = await matchingOrder(s, subject);
    // Someone else can't accept a's offer.
    const offerA = (await offers(a))[0]!;
    expect((await b.b.post(`/mentor/offers/${offerA.id}/accept`)).statusCode).toBe(404);
    expect((await s.b.post(`/admin/orders/${o.id}/assign`, { mentorId: a.id })).statusCode).toBe(
      403,
    );
    const cands = (await admin.b.get(`/admin/orders/${o.id}/candidates`)).json();
    expect(cands.map((c: { id: string }) => c.id).sort()).toEqual([a.id, b.id].sort());

    const r = await admin.b.post(`/admin/orders/${o.id}/assign`, {
      mentorId: a.id,
      note: "Urgent",
    });
    expect(r.statusCode, r.body).toBe(200);
    expect((await a.b.post(`/mentor/orders/${o.id}/start`)).json().status).toBe("in_progress");
    expect((await a.b.post(`/mentor/orders/${o.id}/release`)).statusCode).toBe(409); // already started
    // Reassign to b: a loses the order and is told.
    expect(
      (
        await admin.b.post(`/admin/orders/${o.id}/assign`, { mentorId: b.id, note: "a is ill" })
      ).json(),
    ).toMatchObject({ mentorId: b.id, status: "assigned" });
    expect((await a.b.get(`/orders/${o.id}`)).statusCode).toBe(404);
    await new Promise((x) => setTimeout(x, 50));
    expect(
      (await a.b.get("/me/notifications")).json().items.map((x: { type: string }) => x.type),
    ).toContain("order.unassigned");
    // b releases before starting → back to matching (nobody left: admin queue).
    expect((await b.b.post(`/mentor/orders/${o.id}/release`, {})).statusCode).toBe(200);
    expect((await admin.b.get(`/orders/${o.id}`)).json()).toMatchObject({
      status: "matching",
      needsManualAssignment: true,
    });
    const history = (await admin.b.get(`/admin/orders/${o.id}/offers`)).json();
    expect(history.map((h: { status: string }) => h.status).sort()).toEqual([
      "accepted",
      "accepted",
    ]);
    const actions = (
      await ctx.db.query("select action from audit_log where target = $1", [o.id])
    ).rows.map((x) => x.action);
    expect(actions).toEqual(["order.assign", "order.assign"]);
  });
});
