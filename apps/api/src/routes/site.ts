import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { Deps } from "../deps.ts";
import { audit } from "../lib/audit.ts";
import { ApiError } from "../lib/errors.ts";
import { currentSession, requireUser } from "../lib/session.ts";

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body ?? {});
  if (!r.success)
    throw new ApiError("validation", r.error.issues[0]?.message, r.error.issues[0]?.path.join("."));
  return r.data;
}

/** "Nusrat Jahan" → "Nusrat J." — the public leaderboard never shows full names of students. */
const shortName = (n: string) => {
  const [first, ...rest] = n.trim().split(/\s+/);
  return rest.length ? `${first} ${rest.at(-1)![0]!.toUpperCase()}.` : (first ?? "");
};

interface BannerRow {
  id: string;
  pre: string;
  main: string;
  post: string;
  cta_label: string | null;
  cta_href: string | null;
  tone: string;
  active: boolean;
  sort: number;
}
const bannerDto = (b: BannerRow) => ({
  id: b.id,
  pre: b.pre,
  main: b.main,
  post: b.post,
  ctaLabel: b.cta_label,
  ctaHref: b.cta_href,
  tone: b.tone,
  active: b.active,
  sort: b.sort,
});

/** Student profile, leaderboard, website messages, homepage banners. */
export const siteRoutes: FastifyPluginAsync<Deps> = async (
  app,
  { db, config, hub, notifications },
) => {
  // ---- Student profile ----------------------------------------------------------------

  app.get("/me/student-profile", async (req) => {
    const s = await requireUser(db, config, hub, req, "/student");
    const p = (
      await db.query<{
        institution: string;
        class_level: string;
        board: string | null;
        subjects: string[];
        show_on_leaderboard: boolean;
      }>("select * from student_profiles where user_id = $1", [s.user.id])
    ).rows[0];
    if (!p) throw new ApiError("not_found", "No student profile");
    return {
      institution: p.institution,
      classLevel: p.class_level,
      board: p.board,
      subjects: p.subjects,
      showOnLeaderboard: p.show_on_leaderboard,
    };
  });

  app.put("/me/student-profile", async (req) => {
    const s = await requireUser(db, config, hub, req, "/student");
    const b = parse(
      z.object({
        institution: z.string().trim().min(2).max(120),
        classLevel: z.string().trim().min(2).max(40),
        board: z.string().trim().max(40).nullable().default(null),
        subjects: z.array(z.string().max(40)).max(12).default([]),
        showOnLeaderboard: z.boolean(),
      }),
      req.body,
    );
    const r = await db.query(
      `update student_profiles set institution = $2, class_level = $3, board = $4, subjects = $5,
         show_on_leaderboard = $6, updated_at = now() where user_id = $1`,
      [s.user.id, b.institution, b.classLevel, b.board, b.subjects, b.showOnLeaderboard],
    );
    if (!r.rowCount) throw new ApiError("not_found", "No student profile");
    return b;
  });

  // ---- Leaderboard --------------------------------------------------------------------

  /**
   * Earned rankings only. Mentors: 10 points per completed order + average rating × number
   * of published reviews. Students who opted in: 10 per completed order, 3 per review
   * written. Paid promotions never count.
   */
  app.get("/leaderboard", async () => {
    const mentors = (
      await db.query<{
        id: string;
        name: string;
        subjects: string[];
        verified: boolean;
        completed: number;
        reviews: number;
        rating: string | null;
      }>(
        `select u.id, u.name, p.subjects, p.verified_at is not null as verified,
           (select count(*)::int from orders o where o.mentor_id = u.id and o.status in ('approved', 'closed')) as completed,
           (select count(*)::int from reviews v where v.mentor_id = u.id and v.status = 'published') as reviews,
           (select avg(rating) from reviews v where v.mentor_id = u.id and v.status = 'published') as rating
         from users u join mentor_profiles p on p.user_id = u.id
         where u.status = 'active' and exists (select 1 from user_roles r where r.user_id = u.id and r.role = 'mentor')`,
      )
    ).rows
      .map((m) => ({
        id: m.id,
        name: m.name,
        subjects: m.subjects,
        verified: m.verified,
        completedOrders: m.completed,
        reviewCount: m.reviews,
        rating: m.rating === null ? null : Math.round(Number(m.rating) * 10) / 10,
        points: m.completed * 10 + Math.round(Number(m.rating ?? 0) * m.reviews),
      }))
      .filter((m) => m.points > 0)
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
      .slice(0, 20);
    const students = (
      await db.query<{
        name: string;
        institution: string;
        class_level: string;
        completed: number;
        reviews: number;
      }>(
        `select u.name, p.institution, p.class_level,
           (select count(*)::int from orders o where o.student_id = u.id and o.status = 'closed') as completed,
           (select count(*)::int from reviews v where v.student_id = u.id and v.status = 'published') as reviews
         from users u join student_profiles p on p.user_id = u.id
         where u.status = 'active' and p.show_on_leaderboard`,
      )
    ).rows
      .map((s) => ({
        name: shortName(s.name),
        institution: s.institution,
        classLevel: s.class_level,
        points: s.completed * 10 + s.reviews * 3,
      }))
      .filter((s) => s.points > 0)
      .sort((a, b) => b.points - a.points)
      .slice(0, 20);
    return { mentors, students };
  });

  /**
   * Live figures for the homepage: real counts, the top of the leaderboard, real published
   * reviews (4–5 stars, short student names), active banners, the latest posts.
   */
  app.get("/home", async () => {
    const [stats, reviews, banners, posts, board] = await Promise.all([
      db.query<{
        students: number;
        mentors: number;
        completed: number;
        reviews: number;
        positive: number;
      }>(
        `select (select count(distinct user_id)::int from user_roles where role = 'student') as students,
           (select count(*)::int from mentor_profiles p join users u on u.id = p.user_id
              where u.status = 'active' and exists (select 1 from user_roles r where r.user_id = u.id and r.role = 'mentor')) as mentors,
           (select count(*)::int from orders where status = 'closed') as completed,
           (select count(*)::int from reviews where status = 'published') as reviews,
           (select count(*)::int from reviews where status = 'published' and rating >= 4) as positive`,
      ),
      db.query<{
        id: string;
        rating: number;
        text: string;
        name: string;
        institution: string | null;
      }>(
        `select v.id, v.rating, v.text, u.name, p.institution from reviews v join users u on u.id = v.student_id
           left join student_profiles p on p.user_id = v.student_id
          where v.status = 'published' and v.rating >= 4 and length(v.text) >= 20
          order by v.created_at desc limit 3`,
      ),
      db.query<BannerRow>(
        "select * from home_banners where active order by sort, created_at limit 6",
      ),
      db.query<{ slug: string; title: string; category: string; published_at: Date; body: string }>(
        `select slug, title, category, published_at, body from content_posts
          where kind = 'blog' and status = 'published' order by published_at desc limit 4`,
      ),
      app.inject({ method: "GET", url: "/leaderboard" }),
    ]);
    const st = stats.rows[0]!;
    const lb = board.json() as { mentors: unknown[]; students: unknown[] };
    return {
      stats: {
        students: st.students,
        mentors: st.mentors,
        ordersCompleted: st.completed,
        reviews: st.reviews,
        positivePct: st.reviews ? Math.round((st.positive / st.reviews) * 100) : null,
      },
      topMentors: lb.mentors.slice(0, 5),
      topStudents: lb.students.slice(0, 5),
      testimonials: reviews.rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        text: r.text,
        name: shortName(r.name),
        institution: r.institution ?? "",
      })),
      banners: banners.rows.map(bannerDto),
      posts: posts.rows.map((p) => ({
        slug: p.slug,
        title: p.title,
        tag: p.category.replace(/-/g, " "),
        at: p.published_at.toISOString(),
        readMinutes: Math.max(1, Math.round(p.body.split(/\s+/).length / 200)),
      })),
    };
  });

  // ---- Website messages ---------------------------------------------------------------

  app.post(
    "/contact",
    { config: { rateLimit: { max: 5, timeWindow: "10 minutes" } } },
    async (req, reply) => {
      const b = parse(
        z.object({
          name: z.string().trim().min(2).max(80),
          contact: z.string().trim().min(5).max(120),
          topic: z.enum(["order", "payment", "mentor", "copyright", "institution", "other"]),
          message: z.string().trim().min(10).max(3000),
          /** Honeypot: people never fill it. */
          website: z.string().max(200).optional(),
        }),
        req.body,
      );
      const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.contact);
      const phone = /^(\+?880|0)1[3-9]\d{8}$/.test(b.contact.replace(/[\s-]/g, ""));
      if (!email && !phone)
        throw new ApiError(
          "validation",
          "Enter an email or a Bangladeshi mobile number",
          "contact",
        );
      // Bots get the same answer and nothing is stored.
      if (b.website) return reply.code(201).send({ ok: true });
      const s = await currentSession(db, config, hub, req).catch(() => null);
      await db.query(
        "insert into contact_messages (name, contact, topic, message, user_id, ip) values ($1, $2, $3, $4, $5, $6)",
        [b.name, b.contact, b.topic, b.message, s?.user.id ?? null, req.ip],
      );
      const staff = (
        await db.query<{ user_id: string }>(
          "select distinct user_id from user_roles where role in ('admin', 'super_admin')",
        )
      ).rows.map((r) => r.user_id);
      await notifications.service
        .notify({
          type: "contact.received",
          recipientIds: staff,
          actorId: null,
          payload: { link: "/admin/messages" },
          data: { code: b.topic, title: b.name, institution: b.topic === "institution" },
        })
        .catch(() => undefined);
      return reply.code(201).send({ ok: true });
    },
  );

  app.get<{ Querystring: { status?: string } }>("/admin/messages", async (req) => {
    await requireUser(db, config, hub, req, "/admin/messages");
    const rows = (
      await db.query<{
        id: string;
        name: string;
        contact: string;
        topic: string;
        message: string;
        status: string;
        note: string | null;
        handled_by_name: string | null;
        handled_at: Date | null;
        created_at: Date;
      }>(
        `select m.*, u.name as handled_by_name from contact_messages m left join users u on u.id = m.handled_by
          where ($1::text is null or m.status = $1) order by m.created_at desc limit 300`,
        [req.query.status ?? null],
      )
    ).rows;
    return rows.map((m) => ({
      id: m.id,
      name: m.name,
      contact: m.contact,
      topic: m.topic,
      message: m.message,
      status: m.status,
      note: m.note,
      handledBy: m.handled_by_name,
      handledAt: m.handled_at?.toISOString() ?? null,
      createdAt: m.created_at.toISOString(),
    }));
  });

  /** Record what was done (EduKhata has no email provider yet: replies go by phone or email). */
  app.post<{ Params: { id: string } }>("/admin/messages/:id", async (req) => {
    const s = await requireUser(db, config, hub, req, "/admin/messages");
    const b = parse(
      z.object({
        status: z.enum(["open", "handled", "spam"]),
        note: z.string().trim().max(1000).default(""),
      }),
      req.body,
    );
    if (b.status === "handled" && b.note.length < 3)
      throw new ApiError("validation", "Note what was answered", "note");
    const r = await db.query(
      `update contact_messages set status = $2, note = $3,
         handled_by = case when $2 = 'open' then null else $4::uuid end,
         handled_at = case when $2 = 'open' then null else now() end
       where id::text = $1`,
      [req.params.id, b.status, b.note || null, s.user.id],
    );
    if (!r.rowCount) throw new ApiError("not_found");
    await audit(db, {
      actorId: s.user.id,
      action: "contact.update",
      target: req.params.id,
      details: { status: b.status },
      ip: req.ip,
    });
    return { ok: true };
  });

  // ---- Homepage banners ---------------------------------------------------------------

  app.get("/content/banners", async () =>
    (
      await db.query<BannerRow>("select * from home_banners where active order by sort, created_at")
    ).rows.map(bannerDto),
  );

  const bannerBody = z.object({
    pre: z.string().trim().max(60).default(""),
    main: z.string().trim().min(2).max(60),
    post: z.string().trim().max(80).default(""),
    ctaLabel: z.string().trim().max(30).nullable().default(null),
    ctaHref: z
      .string()
      .trim()
      .max(300)
      .regex(/^(\/[^/]|https:\/\/)/, "Use a path on this site (/…) or an https:// link")
      .nullable()
      .default(null),
    tone: z.enum(["blue", "violet", "teal", "rose", "amber"]).default("blue"),
    active: z.boolean().default(true),
  });

  app.get("/admin/banners", async (req) => {
    await requireUser(db, config, hub, req, "/admin/banners");
    return (
      await db.query<BannerRow>("select * from home_banners order by sort, created_at")
    ).rows.map(bannerDto);
  });

  app.post("/admin/banners", async (req, reply) => {
    const s = await requireUser(db, config, hub, req, "/admin/banners");
    const b = parse(bannerBody, req.body);
    const row = (
      await db.query<BannerRow>(
        `insert into home_banners (pre, main, post, cta_label, cta_href, tone, active, sort)
         values ($1, $2, $3, $4, $5, $6, $7, coalesce((select max(sort) + 1 from home_banners), 0)) returning *`,
        [b.pre, b.main, b.post, b.ctaLabel, b.ctaHref, b.tone, b.active],
      )
    ).rows[0]!;
    await audit(db, { actorId: s.user.id, action: "banner.create", target: row.id, ip: req.ip });
    return reply.code(201).send(bannerDto(row));
  });

  app.put<{ Params: { id: string } }>("/admin/banners/:id", async (req) => {
    const s = await requireUser(db, config, hub, req, "/admin/banners");
    const b = parse(bannerBody, req.body);
    const row = (
      await db.query<BannerRow>(
        `update home_banners set pre = $2, main = $3, post = $4, cta_label = $5, cta_href = $6, tone = $7,
           active = $8, updated_at = now() where id::text = $1 returning *`,
        [req.params.id, b.pre, b.main, b.post, b.ctaLabel, b.ctaHref, b.tone, b.active],
      )
    ).rows[0];
    if (!row) throw new ApiError("not_found");
    await audit(db, { actorId: s.user.id, action: "banner.update", target: row.id, ip: req.ip });
    return bannerDto(row);
  });

  /** New display order: all banner ids, first shown first. */
  app.post("/admin/banners/order", async (req) => {
    const s = await requireUser(db, config, hub, req, "/admin/banners");
    const b = parse(z.object({ ids: z.array(z.uuid()).max(50) }), req.body);
    for (const [i, id] of b.ids.entries())
      await db.query("update home_banners set sort = $2 where id = $1", [id, i]);
    await audit(db, { actorId: s.user.id, action: "banner.reorder", ip: req.ip });
    return { ok: true };
  });
};
