import { describe, expect, it } from "vitest";
import { grant, signIn, student, useHarness } from "./harness.ts";
import { deliverWork, mentor, paidOrder, placeOrder } from "./market.ts";

const ctx = useHarness();

async function staff(name: string, role = "admin") {
  const a = await signIn(ctx, name);
  await grant(ctx, a.sub, role);
  return a;
}

describe("promotions (paid, labelled, from earnings)", () => {
  it("bought from the available balance through the ledger; never changes organic order", async () => {
    // Earn ৳400 (80% of a ৳500 order) and make it available.
    const { m, s, o } = await paidOrder(ctx);
    await deliverWork(ctx, m, o.id);
    expect((await s.b.post(`/orders/${o.id}/approve`)).statusCode).toBe(200);
    const su = await staff("Promo Super", "super_admin");
    expect((await m.b.post(`/mentor/orders/${o.id}/confirm`)).statusCode).toBe(200);

    const before = (await m.b.get("/mentor/promotions")).json() as {
      availableMinor: number;
      plans: { kind: string; priceMinor: number }[];
    };
    expect(before.availableMinor).toBe(40000);
    expect(before.plans.find((p) => p.kind === "boost")!.priceMinor).toBe(20000);
    // Pro yearly (৳3,000) is more than the balance.
    expect((await m.b.post("/mentor/promotions", { kind: "pro_yearly" })).statusCode).toBe(400);
    const boost = await m.b.post("/mentor/promotions", { kind: "boost" });
    expect(boost.statusCode, boost.body).toBe(201);
    // A second boost starts when the first ends.
    const b2 = (await m.b.post("/mentor/promotions", { kind: "boost" })).json() as {
      startsAt: string;
    };
    expect(new Date(b2.startsAt).getTime()).toBe(
      new Date((boost.json() as { endsAt: string }).endsAt).getTime(),
    );
    expect(
      ((await m.b.get("/mentor/earnings")).json() as { availableMinor: number }).availableMinor,
    ).toBe(0);
    const bal = (await su.b.get("/accountant/balances")).json() as { trialBalanceMinor: number };
    expect(bal.trialBalanceMinor).toBe(0);

    // Shown as paid, separately; verification isn't implied.
    const badges = (await m.b.get(`/mentors/${m.id}/badges`)).json() as {
      id: string;
      paid: boolean;
    }[];
    expect(badges).toContainEqual({ id: "featured", label: "Featured · paid", paid: true });
    expect(badges.map((b) => b.id)).not.toContain("verified");
    const featured = (await s.b.get("/mentors/featured")).json() as { id: string }[];
    expect(featured.map((f) => f.id)).toContain(m.id);

    // An admin stops the first boost: unused days go back.
    const promos = (await su.b.get("/admin/promotions")).json() as {
      id: string;
      mentorId: string;
    }[];
    const first = promos.find((p) => p.id === (boost.json() as { id: string }).id)!;
    expect(
      (await su.b.post(`/admin/promotions/${first.id}/cancel`, { note: "Misleading profile" }))
        .statusCode,
    ).toBe(200);
    const after = ((await m.b.get("/mentor/earnings")).json() as { availableMinor: number })
      .availableMinor;
    expect(after).toBeGreaterThanOrEqual(19900);
    expect(after).toBeLessThanOrEqual(20000);
    // Others can't see or stop promotions.
    expect((await s.b.get("/admin/promotions")).statusCode).toBe(403);
  });
});

describe("coupons", () => {
  it("percent with a cap, minimum order, per-person and total limits; released on cancellation", async () => {
    const a = await staff("Coupon Admin");
    const s = await student(ctx, "Coupon Student");
    expect(
      (await s.b.post("/admin/coupons", { code: "MINE", kind: "fixed", value: 100 })).statusCode,
    ).toBe(403);
    const c = await a.b.post("/admin/coupons", {
      code: "exam10",
      kind: "percent",
      value: 10,
      maxDiscountMinor: 5000,
      minOrderMinor: 30000,
      maxUses: 2,
    });
    expect(c.statusCode, c.body).toBe(201);
    expect(
      (await a.b.post("/admin/coupons", { code: "EXAM10", kind: "fixed", value: 100 })).statusCode,
    ).toBe(409);
    expect(
      (await a.b.post("/admin/coupons", { code: "BIG", kind: "percent", value: 150 })).statusCode,
    ).toBe(400);

    // Quote: 10 pages × ৳50 = ৳500 → 10% = ৳50 (cap ৳50).
    const q = (
      await s.b.post("/orders/quote", {
        workType: "practical_khata",
        pages: 10,
        deliveryMethod: "digital",
        couponCode: "exam10",
      })
    ).json();
    expect(q).toMatchObject({ discountMinor: 5000, totalMinor: 45000, couponCode: "EXAM10" });
    // 20 pages: 10% would be ৳100, capped at ৳50.
    expect(
      (
        await s.b.post("/orders/quote", {
          workType: "practical_khata",
          pages: 20,
          deliveryMethod: "digital",
          couponCode: "EXAM10",
        })
      ).json(),
    ).toMatchObject({ discountMinor: 5000 });
    // Below the minimum order.
    expect(
      (
        await s.b.post("/orders/quote", {
          workType: "practical_khata",
          pages: 2,
          deliveryMethod: "digital",
          couponCode: "EXAM10",
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await s.b.post("/orders/quote", {
          workType: "practical_khata",
          pages: 10,
          deliveryMethod: "digital",
          couponCode: "NOPE",
        })
      ).statusCode,
    ).toBe(400);

    const o = await placeOrder(s, { couponCode: "EXAM10" });
    expect(o.price.amountMinor).toBe(45000);
    // The payment due is the discounted price.
    expect(
      (
        (await s.b.get(`/orders/${o.id}/payment`)).json() as {
          due: { amount: { amountMinor: number } };
        }
      ).due.amount.amountMinor,
    ).toBe(45000);
    // Once per person.
    const again = await s.b.post("/orders", { ...orderBody(), couponCode: "EXAM10" });
    expect(again.statusCode).toBe(400);
    // Cancelling gives the use back.
    expect((await s.b.post(`/orders/${o.id}/cancel`, {})).statusCode).toBe(200);
    expect((await placeOrder(s, { couponCode: "EXAM10" })).price.amountMinor).toBe(45000);

    // Two others race for the last use: exactly one wins.
    const [x, y] = await Promise.all([student(ctx, "Racer X"), student(ctx, "Racer Y")]);
    const rs = await Promise.all(
      [x, y].map((p) => p.b.post("/orders", { ...orderBody(), couponCode: "EXAM10" })),
    );
    expect(rs.map((r) => r.statusCode).sort()).toEqual([201, 400]);
    const list = (await a.b.get("/admin/coupons")).json() as { code: string; uses: number }[];
    expect(list.find((l) => l.code === "EXAM10")!.uses).toBe(2);

    // Switched off: refused.
    const id = (c.json() as { id: string }).id;
    expect(
      (
        await a.b.put(`/admin/coupons/${id}`, {
          maxUses: 5,
          perUser: 1,
          startsAt: null,
          endsAt: null,
          active: false,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await s.b.post("/orders/quote", {
          workType: "practical_khata",
          pages: 10,
          deliveryMethod: "digital",
          couponCode: "EXAM10",
        })
      ).statusCode,
    ).toBe(400);
  });

  it("a fixed coupon never makes an order cheaper than ৳10", async () => {
    const a = await staff("Fixed Coupon Admin");
    await a.b.post("/admin/coupons", { code: "FREEBIE", kind: "fixed", value: 1_000_000 });
    const s = await student(ctx, "Freebie Student");
    const o = await placeOrder(s, { pages: 1, couponCode: "FREEBIE" });
    expect(o.price.amountMinor).toBe(1000);
  });
});

function orderBody() {
  return {
    categorySlug: "practical-khata",
    subjectId: "biology",
    level: "hsc",
    workType: "practical_khata",
    pages: 10,
    deliveryMethod: "digital",
    title: "Biology practical khata, chapter 4",
    instructions: "Board: Dhaka. Chapter 4 experiments with labelled drawings, neat handwriting.",
    deadline: new Date(Date.now() + 3 * 86_400_000).toISOString(),
  };
}

describe("blog and pages", () => {
  const post = {
    title: "How to draw a neat amoeba",
    excerpt: "Three steps",
    body: "Start with a light outline. Then add the nucleus and label every part clearly.",
    category: "practical-khata",
  };

  it("mentor drafts → submits → another admin publishes; public sees only published", async () => {
    const m = await mentor(ctx, "Blogging Mentor");
    const s = await student(ctx, "Blog Reader");
    expect((await s.b.post("/me/posts", post)).statusCode).toBe(403);
    const d = await m.b.post("/me/posts", post);
    expect(d.statusCode, d.body).toBe(201);
    const p = d.json() as { id: string; slug: string; status: string };
    expect(p).toMatchObject({ slug: "how-to-draw-a-neat-amoeba", status: "draft" });
    expect((await s.b.get(`/content/posts/${p.slug}`)).statusCode).toBe(404);
    expect((await m.b.post(`/me/posts/${p.id}/submit`)).statusCode).toBe(200);
    // Pending posts can't be edited by the author.
    expect((await m.b.put(`/me/posts/${p.id}`, post)).statusCode).toBe(409);

    const a = await staff("Blog Admin");
    expect((await a.b.post(`/admin/content/${p.id}/review`, { publish: false })).statusCode).toBe(
      400,
    );
    expect(
      (await a.b.post(`/admin/content/${p.id}/review`, { publish: false, note: "Add a diagram" }))
        .statusCode,
    ).toBe(200);
    expect(
      (await m.b.put(`/me/posts/${p.id}`, { ...post, body: `${post.body} Diagram attached.` }))
        .statusCode,
    ).toBe(200);
    await m.b.post(`/me/posts/${p.id}/submit`);
    expect((await a.b.post(`/admin/content/${p.id}/review`, { publish: true })).statusCode).toBe(
      200,
    );
    const pub = (await s.b.get(`/content/posts/${p.slug}`)).json();
    expect(pub).toMatchObject({
      title: post.title,
      authorName: "Blogging Mentor",
      status: "published",
    });
    expect(
      ((await s.b.get("/content/posts")).json() as { slug: string }[]).map((x) => x.slug),
    ).toContain(p.slug);

    // Same title again gets its own slug; admins write pages; nobody reviews their own post.
    expect(((await m.b.post("/me/posts", post)).json() as { slug: string }).slug).toBe(
      "how-to-draw-a-neat-amoeba-2",
    );
    const page = await a.b.post("/admin/content", {
      kind: "page",
      title: "Refund policy",
      body: "Full refund before a mentor starts work. Disputes are decided by EduKhata.",
      slug: "refund-policy",
      publish: true,
    });
    expect(page.statusCode, page.body).toBe(201);
    expect((await s.b.get("/content/pages/refund-policy")).json()).toMatchObject({
      title: "Refund policy",
    });
    const own = (
      await a.b.post("/admin/content", {
        kind: "blog",
        title: "Admin's own post",
        body: "A post written by an admin for review.",
      })
    ).json() as { id: string };
    await ctx.db.query("update content_posts set status = 'pending' where id = $1", [own.id]);
    expect((await a.b.post(`/admin/content/${own.id}/review`, { publish: true })).statusCode).toBe(
      403,
    );
  });
});
