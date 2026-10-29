/**
 * Performance check on a seeded database (opt-in: PERF=1 pnpm --filter @edukhata/api test perf).
 * Measures the API in-process (handler + PostgreSQL, no network) under concurrency.
 */
import { describe, expect, it } from "vitest";
import { Browser, grant, signIn, useHarness } from "./harness.ts";

const ctx = useHarness();
const RUN = process.env.PERF === "1";

async function measure(b: Browser, url: string, n = 200, concurrency = 20) {
  const times: number[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < n) {
        next++;
        const t = performance.now();
        const r = await b.get(url);
        times.push(performance.now() - t);
        if (r.statusCode !== 200) throw new Error(`${url} → ${r.statusCode}`);
      }
    }),
  );
  times.sort((a, b) => a - b);
  const p = (q: number) => Math.round(times[Math.floor(q * (times.length - 1))]!);
  return { url, p50: p(0.5), p95: p(0.95), max: p(1) };
}

describe.skipIf(!RUN)("performance on seeded data", () => {
  it("hot endpoints stay fast with 300 mentors, 1,000 students and 10,000 orders", async () => {
    const db = ctx.db;
    const tag = Date.now().toString(36);
    // Seed in SQL (much faster than through the API).
    await db.query(
      `insert into users (wan_sub, name) select 'perf-m-${tag}-' || g, 'Perf Mentor ' || g from generate_series(1, 300) g`,
    );
    await db.query(
      `insert into users (wan_sub, name) select 'perf-s-${tag}-' || g, 'Perf Student ' || g from generate_series(1, 1000) g`,
    );
    await db.query(
      `insert into user_roles (user_id, role) select id, 'mentor' from users where wan_sub like 'perf-m-${tag}-%'`,
    );
    await db.query(
      `insert into user_roles (user_id, role) select id, 'student' from users where wan_sub like 'perf-s-${tag}-%'`,
    );
    await db.query(
      `insert into mentor_profiles (user_id, subjects, work_types, levels, available, capacity)
       select id, '{biology}', '{practical_khata}', '{hsc}', true, 20 from users where wan_sub like 'perf-m-${tag}-%'`,
    );
    await db.query(
      `with m as (select id, row_number() over () as n from users where wan_sub like 'perf-m-${tag}-%'),
            s as (select id, row_number() over () as n from users where wan_sub like 'perf-s-${tag}-%')
       insert into orders (student_id, mentor_id, category_slug, subject_id, level, work_type, title, instructions, pages,
         delivery_method, deadline, price_minor, commission_rate, free_revisions, status, delivered_at)
       select s.id, m.id, 'practical-khata', 'biology', 'hsc', 'practical_khata', 'Perf order ' || g, 'Seeded order for the performance check.', 10,
         'digital', now() + interval '3 days', 50000, 0.2, 2,
         (array['closed','approved','in_progress','delivered','awaiting_payment'])[1 + g % 5],
         case when g % 5 in (0, 1, 3) then now() - interval '1 day' else null end
       from generate_series(1, 10000) g
       join s on s.n = 1 + g % 1000 join m on m.n = 1 + g % 300`,
    );
    await db.query(
      `insert into reviews (order_id, student_id, mentor_id, rating, text, status)
       select id, student_id, mentor_id, 3 + (random() * 2)::int, 'Seeded review text', 'published'
       from orders where title like 'Perf order %' and status = 'closed' and mentor_id is not null limit 2000`,
    );
    await db.query("analyze");

    const su = await signIn(ctx, "Perf Super");
    await grant(ctx, su.sub, "super_admin", "accountant");
    const student = (
      await db.query<{ wan_sub: string }>(
        `select wan_sub from users where wan_sub = 'perf-s-${tag}-1'`,
      )
    ).rows[0]!;
    void student;
    const order = (
      await db.query<{ id: string }>(
        "select id from orders where title like 'Perf order %' and status = 'awaiting_payment' limit 1",
      )
    ).rows[0]!;

    const results = [];
    for (const url of [
      "/catalog",
      "/mentors",
      "/mentors?subject=biology",
      "/orders?as=staff",
      `/admin/orders/${order.id}/candidates`,
      "/accountant/balances",
      "/accountant/ledger",
      "/content/posts",
    ]) {
      // A fresh client address per endpoint (the API allows 600 requests a minute per client).
      const b = new Browser(ctx);
      b.cookies = new Map(su.b.cookies);
      results.push(await measure(b, url, 100, 10));
    }
    console.table(results);
    // Generous ceilings for a shared CI machine; the table above is the evidence.
    for (const r of results) expect(r.p95, r.url).toBeLessThan(1500);
  }, 600_000);
});
