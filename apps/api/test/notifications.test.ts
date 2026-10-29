import { describe, expect, it } from "vitest";
import { Browser, grant, signIn, student, useHarness } from "./harness.ts";

const ctx = useHarness();

describe("notifications (WAN social module on PostgreSQL)", () => {
  it("onboarding sends one welcome notification (deduplicated)", async () => {
    const s = await student(ctx, "Welcome Student");
    // Completing onboarding again doesn't add a second welcome.
    await s.b.post("/me/onboarding", {
      kind: "student",
      institution: "Notre Dame College",
      classLevel: "HSC 2nd year",
      subjects: ["ict"],
    });
    const list = (await s.b.get("/me/notifications")).json();
    const welcomes = list.items.filter((n: { type: string }) => n.type === "account.welcome");
    expect(welcomes).toHaveLength(1);
    expect(welcomes[0].link).toBe("/student");
    expect(welcomes[0].data.role).toBe("Student");
    expect(list.counts).toEqual({ unread: 1, unseen: 1 });
  });

  it("role changes notify the person; seen, read, open and read-all work and stay private", async () => {
    const admin = await signIn(ctx, "Notif Admin");
    await grant(ctx, admin.sub, "admin");
    const s = await student(ctx, "Future Mentor");
    expect(
      (await admin.b.put(`/admin/users/${s.id}/roles`, { roles: ["student", "mentor"] }))
        .statusCode,
    ).toBe(200);

    const list = (await s.b.get("/me/notifications")).json();
    const change = list.items.find((n: { type: string }) => n.type === "account.roles_changed");
    expect(change.data.added).toBe("Mentor");
    expect(change.link).toBe("/mentor");

    expect((await s.b.post("/me/notifications/seen")).statusCode).toBe(200);
    expect((await s.b.get("/me/notifications/counts")).json()).toEqual({ unread: 2, unseen: 0 });

    // Another user can't open or read it.
    expect((await admin.b.post(`/me/notifications/${change.id}/open`)).statusCode).toBe(404);
    expect(
      (await admin.b.post("/me/notifications/read", { ids: [change.id] })).json().changed,
    ).toBe(0);

    const open = await s.b.post(`/me/notifications/${change.id}/open`);
    expect(open.json()).toEqual({ link: "/mentor" });
    expect((await s.b.get("/me/notifications?filter=unread")).json().items).toHaveLength(1);
    expect((await s.b.post("/me/notifications/read-all")).json().changed).toBe(1);
    expect((await s.b.get("/me/notifications/counts")).json().unread).toBe(0);
    expect((await s.b.post("/me/notifications/read", { ids: [] })).statusCode).toBe(400);
  });

  it("paginates with a cursor", async () => {
    const s = await student(ctx, "Pager");
    const sid = (await ctx.db.query("select id from users where name = 'Pager'")).rows[0].id;
    for (let i = 0; i < 5; i++) {
      await ctx.db.query(
        `insert into notifications (id, recipient_id, type, category, link, data, created_at, updated_at)
         values (gen_random_uuid(), $1, 'referral.joined', 'referral', '/student/referrals', $2, now() - make_interval(secs => $3), now() - make_interval(secs => $3))`,
        [sid, JSON.stringify({ friend: `F${i}` }), i * 10],
      );
    }
    const p1 = (await s.b.get("/me/notifications?limit=4")).json();
    expect(p1.items).toHaveLength(4);
    expect(p1.nextCursor).toBeTruthy();
    const p2 = (
      await s.b.get(`/me/notifications?limit=4&cursor=${encodeURIComponent(p1.nextCursor)}`)
    ).json();
    expect(p2.items).toHaveLength(2);
    const ids = [...p1.items, ...p2.items].map((x: { id: string }) => x.id);
    expect(new Set(ids).size).toBe(6);
  });

  it("preferences: optional categories can be turned off, mandatory ones still arrive", async () => {
    const admin = await signIn(ctx, "Pref Admin");
    await grant(ctx, admin.sub, "admin");
    const s = await student(ctx, "Pref Student");
    const off = { enabled: false, push: false, email: false };
    const put = await s.b.put("/me/notification-preferences", { categories: { account: off } });
    expect(put.statusCode).toBe(200);
    await admin.b.put(`/admin/users/${s.id}/roles`, { roles: ["student", "guardian"] });
    const types = (await s.b.get("/me/notifications"))
      .json()
      .items.map((n: { type: string }) => n.type);
    expect(types).toContain("account.roles_changed"); // mandatory
    expect(
      (
        await s.b.put("/me/notification-preferences", {
          quietHours: { start: "25:00", end: "07:00", timezone: "Asia/Dhaka" },
        })
      ).statusCode,
    ).toBe(400);
  });

  it("push is off without VAPID keys; subscribing needs a valid https endpoint", async () => {
    expect((await new Browser(ctx).get("/push/config")).json()).toEqual({
      enabled: false,
      vapidPublicKey: null,
    });
    const s = await student(ctx, "Push Student");
    const bad = await s.b.post("/me/push-subscriptions", {
      endpoint: "http://evil.example/x",
      keys: { p256dh: "a", auth: "b" },
    });
    expect(bad.statusCode).toBeGreaterThanOrEqual(400);
    expect((await new Browser(ctx).get("/me/notifications")).statusCode).toBe(401);
  });
});
