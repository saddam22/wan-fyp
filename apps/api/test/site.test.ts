import { describe, expect, it } from "vitest";
import { grant, signIn, student, useHarness, WEB } from "./harness.ts";
import { deliverWork, paidOrder } from "./market.ts";

const ctx = useHarness();

async function admin(name: string) {
  const a = await signIn(ctx, name);
  await grant(ctx, a.sub, "admin");
  return a;
}
const contact = (body: object, ip = "10.252.0.1") =>
  ctx.app.inject({
    method: "POST",
    url: "/contact",
    remoteAddress: ip,
    headers: { origin: WEB },
    payload: body,
  });

describe("website", () => {
  it("contact messages: validated, honeypot, rate-limited, handled by admins with a note", async () => {
    const msg = {
      name: "Dhaka College office",
      contact: "office@example.edu",
      topic: "institution",
      message: "We would like to talk about academic integrity.",
    };
    expect((await contact({ ...msg, contact: "nope" })).statusCode).toBe(400);
    expect((await contact(msg)).statusCode).toBe(201);
    expect((await contact({ ...msg, name: "Bot", website: "http://spam" })).statusCode).toBe(201);
    const codes = [];
    for (let i = 0; i < 6; i++) codes.push((await contact(msg, "10.252.0.9")).statusCode);
    expect(codes).toContain(429);

    const s = await student(ctx, "Nosy Student");
    expect((await s.b.get("/admin/messages")).statusCode).toBe(403);
    const a = await admin("Messages Admin");
    const list = (await a.b.get("/admin/messages?status=open")).json() as {
      id: string;
      name: string;
    }[];
    expect(list.some((m) => m.name === "Bot")).toBe(false);
    const m = list.find((x) => x.name === "Dhaka College office")!;
    expect((await a.b.post(`/admin/messages/${m.id}`, { status: "handled" })).statusCode).toBe(400);
    expect(
      (await a.b.post(`/admin/messages/${m.id}`, { status: "handled", note: "Called the office" }))
        .statusCode,
    ).toBe(200);
    const after = (await a.b.get("/admin/messages")).json() as {
      id: string;
      status: string;
      handledBy: string;
    }[];
    expect(after.find((x) => x.id === m.id)).toMatchObject({
      status: "handled",
      handledBy: "Messages Admin",
    });
  });

  it("banners: admins manage and order them; links stay on this site or https; public sees active ones", async () => {
    const a = await admin("Banner Admin");
    expect(
      (
        await a.b.post("/admin/banners", {
          main: "Bad link",
          ctaLabel: "Go",
          ctaHref: "javascript:alert(1)",
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await a.b.post("/admin/banners", { main: "Protocol-relative", ctaHref: "//evil.example" }))
        .statusCode,
    ).toBe(400);
    const one = (
      await a.b.post("/admin/banners", {
        pre: "Eid",
        main: "15% off",
        ctaLabel: "Order",
        ctaHref: "/order/new",
      })
    ).json() as { id: string };
    const two = (
      await a.b.post("/admin/banners", { main: "Hidden one", active: false })
    ).json() as { id: string };
    const three = (
      await a.b.post("/admin/banners", { main: "Second slide", tone: "teal" })
    ).json() as { id: string };
    expect(
      (await a.b.post("/admin/banners/order", { ids: [three.id, one.id, two.id] })).statusCode,
    ).toBe(200);
    const pub = (await (await student(ctx, "Banner Viewer")).b.get("/content/banners")).json() as {
      id: string;
    }[];
    const ours = pub.filter((b) => [one.id, two.id, three.id].includes(b.id)).map((b) => b.id);
    expect(ours).toEqual([three.id, one.id]);
    const s = await student(ctx, "Banner Student");
    expect((await s.b.post("/admin/banners", { main: "Mine" })).statusCode).toBe(403);
  });

  it("leaderboard: earned points only; students appear only if they opt in, with a short name", async () => {
    const { m, s, o } = await paidOrder(ctx);
    await deliverWork(ctx, m, o.id);
    await s.b.post(`/orders/${o.id}/approve`);
    await m.b.post(`/mentor/orders/${o.id}/confirm`);
    const lb1 = (await s.b.get("/leaderboard")).json() as {
      mentors: { id: string; points: number }[];
      students: { name: string }[];
    };
    expect(lb1.mentors.find((x) => x.id === m.id)?.points).toBe(10);
    const me = (await s.b.get("/me/student-profile")).json();
    expect(me.showOnLeaderboard).toBe(false);
    expect(lb1.students.some((x) => x.name.startsWith("Paying"))).toBe(false);
    expect(
      (await s.b.put("/me/student-profile", { ...me, showOnLeaderboard: true })).statusCode,
    ).toBe(200);
    const lb2 = (await s.b.get("/leaderboard")).json() as {
      students: { name: string; points: number }[];
    };
    const row = lb2.students.find((x) => x.name.startsWith("Paying"));
    expect(row).toMatchObject({ points: 10 });
    // Full names never appear: "Paying <subject>" → "Paying <initial>."
    expect(row!.name).toMatch(/^Paying [A-Z0-9]\.$/);

    // The homepage figures are real counts, with real reviews only.
    const home = (await s.b.get("/home")).json();
    expect(home.stats.ordersCompleted).toBeGreaterThanOrEqual(1);
    expect(home.stats.mentors).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(home.testimonials)).toBe(true);
    expect(home.topStudents.some((x: { name: string }) => x.name.startsWith("Paying"))).toBe(true);
  });
});
