import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { Queryable } from "../db.ts";
import type { Deps } from "../deps.ts";
import { audit } from "../lib/audit.ts";
import { ApiError } from "../lib/errors.ts";
import { requireUser } from "../lib/session.ts";

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body ?? {});
  if (!r.success)
    throw new ApiError("validation", r.error.issues[0]?.message, r.error.issues[0]?.path.join("."));
  return r.data;
}

export const BLOG_CATEGORIES = [
  "general",
  "study-tips",
  "practical-khata",
  "exams",
  "mentors",
] as const;
const AUTHORS = ["mentor", "admin", "super_admin", "supporter"];

interface PostRow {
  id: string;
  kind: "blog" | "page";
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  category: string;
  status: string;
  author_id: string | null;
  author_name?: string | null;
  review_note: string | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const slugify = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "post";

/** Plain text (paragraphs, "## " headings, "- " lists); the web renders it as text, never as HTML. */
const postBody = z.object({
  title: z.string().trim().min(5).max(160),
  excerpt: z.string().trim().max(300).default(""),
  body: z.string().trim().min(20).max(50_000),
  category: z.enum(BLOG_CATEGORIES).default("general"),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes")
    .max(80)
    .optional(),
});

const SELECT = `select p.*, u.name as author_name from content_posts p left join users u on u.id = p.author_id`;

const dto = (p: PostRow, full = true) => ({
  id: p.id,
  kind: p.kind,
  slug: p.slug,
  title: p.title,
  excerpt: p.excerpt,
  ...(full ? { body: p.body } : {}),
  category: p.category,
  status: p.status,
  authorName: p.author_name ?? "EduKhata",
  reviewNote: p.review_note,
  publishedAt: p.published_at?.toISOString() ?? null,
  updatedAt: p.updated_at.toISOString(),
  readMinutes: Math.max(1, Math.round(p.body.split(/\s+/).length / 200)),
});

/** A free slug for a new post: the title's, with -2, -3… when taken. */
async function freeSlug(c: Queryable, kind: string, base: string, exceptId?: string) {
  for (let i = 1; i < 50; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    const taken = (
      await c.query(
        "select 1 from content_posts where kind = $1 and slug = $2 and id::text <> $3",
        [kind, slug, exceptId ?? ""],
      )
    ).rowCount;
    if (!taken) return slug;
  }
  throw new ApiError("conflict", "Choose another slug", "slug");
}

/** Blog (mentors and staff write; admins publish, as in ICTSpark) and static pages (admins). */
export const contentRoutes: FastifyPluginAsync<Deps> = async (
  app,
  { db, config, hub, notifications },
) => {
  // ---- Public -------------------------------------------------------------------------

  app.get<{ Querystring: { category?: string } }>("/content/posts", async (req) => {
    const rows = (
      await db.query<PostRow>(
        `${SELECT} where p.kind = 'blog' and p.status = 'published' and ($1::text is null or p.category = $1)
          order by p.published_at desc limit 100`,
        [req.query.category ?? null],
      )
    ).rows;
    return rows.map((p) => dto(p, false));
  });

  app.get<{ Params: { kind: string; slug: string } }>("/content/:kind/:slug", async (req) => {
    const kind = req.params.kind === "posts" ? "blog" : req.params.kind === "pages" ? "page" : null;
    const p = kind
      ? (
          await db.query<PostRow>(
            `${SELECT} where p.kind = $1 and p.slug = $2 and p.status = 'published'`,
            [kind, req.params.slug],
          )
        ).rows[0]
      : undefined;
    if (!p) throw new ApiError("not_found", "Not found");
    return dto(p);
  });

  // ---- Authors (mentors, staff) -------------------------------------------------------

  const author = async (req: Parameters<typeof requireUser>[3]) => {
    const s = await requireUser(db, config, hub, req);
    if (!s.roles.some((r) => AUTHORS.includes(r)))
      throw new ApiError("forbidden", "Only mentors and staff write for the blog");
    return s;
  };

  app.get("/me/posts", async (req) => {
    const s = await author(req);
    const rows = (
      await db.query<PostRow>(
        `${SELECT} where p.author_id = $1 and p.kind = 'blog' order by p.updated_at desc`,
        [s.user.id],
      )
    ).rows;
    return rows.map((p) => dto(p));
  });

  app.post("/me/posts", async (req, reply) => {
    const s = await author(req);
    const b = parse(postBody, req.body);
    const slug = await freeSlug(db, "blog", b.slug ?? slugify(b.title));
    const p = (
      await db.query<PostRow>(
        `insert into content_posts (kind, slug, title, excerpt, body, category, author_id) values ('blog', $1, $2, $3, $4, $5, $6) returning *`,
        [slug, b.title, b.excerpt, b.body, b.category, s.user.id],
      )
    ).rows[0]!;
    return reply.code(201).send(dto({ ...p, author_name: s.user.name }));
  });

  /** Edit own draft or a post sent back for changes. */
  app.put<{ Params: { id: string } }>("/me/posts/:id", async (req) => {
    const s = await author(req);
    const b = parse(postBody, req.body);
    const p = (
      await db.query<PostRow>(
        `update content_posts set title = $3, excerpt = $4, body = $5, category = $6, updated_at = now()
          where id::text = $1 and author_id = $2 and status in ('draft', 'rejected') returning *`,
        [req.params.id, s.user.id, b.title, b.excerpt, b.body, b.category],
      )
    ).rows[0];
    if (!p) throw new ApiError("conflict", "Only drafts and posts sent back can be edited");
    return dto({ ...p, author_name: s.user.name });
  });

  app.post<{ Params: { id: string } }>("/me/posts/:id/submit", async (req) => {
    const s = await author(req);
    const p = (
      await db.query<PostRow>(
        `update content_posts set status = 'pending', updated_at = now()
          where id::text = $1 and author_id = $2 and status in ('draft', 'rejected') returning *`,
        [req.params.id, s.user.id],
      )
    ).rows[0];
    if (!p) throw new ApiError("conflict", "This post can't be sent for review now");
    const staff = (
      await db.query<{ user_id: string }>(
        "select distinct user_id from user_roles where role in ('admin', 'super_admin') and user_id <> $1",
        [s.user.id],
      )
    ).rows.map((r) => r.user_id);
    await notifications.service
      .notify({
        type: "content.submitted",
        recipientIds: staff,
        actorId: null,
        payload: { link: "/admin/blog" },
        data: { code: "Blog", title: p.title },
      })
      .catch(() => undefined);
    return dto({ ...p, author_name: s.user.name });
  });

  // ---- Admins -------------------------------------------------------------------------

  app.get<{ Querystring: { kind?: string; status?: string } }>("/admin/content", async (req) => {
    await requireUser(db, config, hub, req, "/admin/blog");
    const rows = (
      await db.query<PostRow>(
        `${SELECT} where ($1::text is null or p.kind = $1) and ($2::text is null or p.status = $2)
           and not (p.status = 'draft' and p.author_id is not null and p.kind = 'blog'
             and not exists (select 1 from user_roles r where r.user_id = p.author_id and r.role in ('admin', 'super_admin')))
          order by p.updated_at desc limit 300`,
        [req.query.kind ?? null, req.query.status ?? null],
      )
    ).rows;
    return rows.map((p) => dto(p));
  });

  /** Admins write pages and blog posts directly (published or not). */
  app.post("/admin/content", async (req, reply) => {
    const s = await requireUser(db, config, hub, req, "/admin/blog");
    const b = parse(
      postBody.extend({
        kind: z.enum(["blog", "page"]),
        publish: z.boolean().default(false),
      }),
      req.body,
    );
    const slug = await freeSlug(db, b.kind, b.slug ?? slugify(b.title));
    const p = (
      await db.query<PostRow>(
        `insert into content_posts (kind, slug, title, excerpt, body, category, author_id, status, published_at, reviewed_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $7) returning *`,
        [
          b.kind,
          slug,
          b.title,
          b.excerpt,
          b.body,
          b.category,
          s.user.id,
          b.publish ? "published" : "draft",
          b.publish ? new Date() : null,
        ],
      )
    ).rows[0]!;
    await audit(db, { actorId: s.user.id, action: "content.create", target: p.id, ip: req.ip });
    return reply.code(201).send(dto({ ...p, author_name: s.user.name }));
  });

  app.put<{ Params: { id: string } }>("/admin/content/:id", async (req) => {
    const s = await requireUser(db, config, hub, req, "/admin/blog");
    const b = parse(
      postBody.extend({ status: z.enum(["draft", "published", "hidden"]).optional() }),
      req.body,
    );
    const p = (
      await db.query<PostRow>(
        `update content_posts set title = $2, excerpt = $3, body = $4, category = $5,
           status = coalesce($6, status),
           published_at = case when $6 = 'published' then coalesce(published_at, now()) else published_at end,
           updated_at = now()
         where id::text = $1 returning *`,
        [req.params.id, b.title, b.excerpt, b.body, b.category, b.status ?? null],
      )
    ).rows[0];
    if (!p) throw new ApiError("not_found");
    await audit(db, {
      actorId: s.user.id,
      action: "content.update",
      target: p.id,
      details: { status: b.status },
      ip: req.ip,
    });
    return dto(p);
  });

  /** Publish a submitted post, or send it back with a note. Nobody reviews their own post. */
  app.post<{ Params: { id: string } }>("/admin/content/:id/review", async (req) => {
    const s = await requireUser(db, config, hub, req, "/admin/blog");
    const b = parse(
      z.object({ publish: z.boolean(), note: z.string().trim().max(500).default("") }),
      req.body,
    );
    if (!b.publish && b.note.length < 3)
      throw new ApiError("validation", "Tell the author what to change", "note");
    const cur = (
      await db.query<PostRow>("select * from content_posts where id::text = $1", [req.params.id])
    ).rows[0];
    if (!cur) throw new ApiError("not_found");
    if (cur.author_id === s.user.id)
      throw new ApiError("forbidden", "Someone else must review your post");
    const p = (
      await db.query<PostRow>(
        `update content_posts set status = $2, review_note = $3, reviewed_by = $4,
           published_at = case when $2 = 'published' then now() else published_at end, updated_at = now()
         where id = $1 and status = 'pending' returning *`,
        [cur.id, b.publish ? "published" : "rejected", b.note || null, s.user.id],
      )
    ).rows[0];
    if (!p) throw new ApiError("conflict", "This post isn't waiting for review");
    await audit(db, {
      actorId: s.user.id,
      action: b.publish ? "content.publish" : "content.send_back",
      target: p.id,
      ip: req.ip,
    });
    if (p.author_id)
      await notifications.service
        .notify({
          type: "content.reviewed",
          recipientIds: [p.author_id],
          actorId: null,
          payload: { link: b.publish ? `/blog/${p.slug}` : "/mentor/blog" },
          data: { code: "Blog", title: p.title, published: b.publish, note: b.note },
        })
        .catch(() => undefined);
    return dto(p);
  });
};
