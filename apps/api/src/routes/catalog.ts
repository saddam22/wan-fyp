import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { tx } from "../db.ts";
import type { Deps } from "../deps.ts";
import { audit } from "../lib/audit.ts";
import { ApiError } from "../lib/errors.ts";
import { requireUser } from "../lib/session.ts";
import { getSettings, SETTINGS_SCHEMA } from "../market/settings.ts";

export const WORK_TYPES = [
  "digital",
  "handwritten",
  "practical_khata",
  "biology_drawing",
  "pencil_sketch",
  "diagram",
] as const;
export const LEVELS = ["school", "ssc", "hsc", "university", "vocational"] as const;

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success)
    throw new ApiError("validation", r.error.issues[0]?.message, r.error.issues[0]?.path.join("."));
  return r.data;
}

const text = (max: number) => z.string().trim().min(1).max(max);
const subjectBody = z.object({
  name: text(60),
  nameBn: text(60),
  levels: z.array(z.enum(LEVELS)).max(LEVELS.length),
  active: z.boolean(),
  sort: z.number().int().min(0).max(1000).default(0),
});
const categoryBody = z.object({
  name: text(80),
  nameBn: text(80),
  description: z.string().trim().max(200).default(""),
  icon: z
    .string()
    .regex(/^[A-Za-z0-9]{2,40}$/)
    .default("BookOpen"),
  tone: z.enum(["blue", "indigo", "green", "amber", "violet", "rose", "teal"]).default("blue"),
  kind: z.enum(["assignment", "practical", "project"]),
  active: z.boolean(),
  sort: z.number().int().min(0).max(1000).default(0),
});
const SLUG = /^[a-z0-9-]{2,40}$/;

export async function loadCatalog(db: Deps["db"], all = false) {
  const where = all ? "" : "where active";
  const [subjects, categories, prices, settings] = await Promise.all([
    db.query(
      `select id, name, name_bn, levels, active, sort from subjects ${where} order by sort, name`,
    ),
    db.query(
      `select slug, name, name_bn, description, icon, tone, kind, active, sort from categories ${where} order by sort, name`,
    ),
    db.query<{ work_type: string; per_page_minor: string; currency: string }>(
      "select work_type, per_page_minor, currency from price_list",
    ),
    getSettings(db),
  ]);
  return {
    subjects: subjects.rows.map((s) => ({
      id: s.id,
      name: s.name,
      nameBn: s.name_bn,
      levels: s.levels,
      active: s.active,
      sort: s.sort,
    })),
    categories: categories.rows.map((c) => ({
      slug: c.slug,
      name: c.name,
      nameBn: c.name_bn,
      description: c.description,
      icon: c.icon,
      tone: c.tone,
      kind: c.kind,
      active: c.active,
      sort: c.sort,
    })),
    priceList: Object.fromEntries(
      prices.rows.map((p) => [
        p.work_type,
        { amountMinor: Number(p.per_page_minor), currency: p.currency },
      ]),
    ),
    rules: {
      freeRevisions: settings.free_revisions,
      courierFeeMinor: settings.courier_fee_minor,
      minDeadlineHours: settings.min_deadline_hours,
    },
  };
}

/** Catalog (public), its administration (admin) and business rules (super admin). */
export const catalogRoutes: FastifyPluginAsync<Deps> = async (app, { db, config, hub }) => {
  app.get("/catalog", async () => loadCatalog(db));

  app.get("/admin/catalog", async (req) => {
    await requireUser(db, config, hub, req, "/admin/catalog");
    return loadCatalog(db, true);
  });

  app.put<{ Params: { id: string } }>("/admin/catalog/subjects/:id", async (req) => {
    const s = await requireUser(db, config, hub, req, "/admin/catalog");
    if (!SLUG.test(req.params.id))
      throw new ApiError("validation", "Use lowercase letters, digits and dashes", "id");
    const b = parse(subjectBody, req.body);
    await tx(db, async (c) => {
      await c.query(
        `insert into subjects (id, name, name_bn, levels, active, sort) values ($1, $2, $3, $4, $5, $6)
         on conflict (id) do update set name = excluded.name, name_bn = excluded.name_bn, levels = excluded.levels,
           active = excluded.active, sort = excluded.sort`,
        [req.params.id, b.name, b.nameBn, b.levels, b.active, b.sort],
      );
      await audit(c, {
        actorId: s.user.id,
        action: "catalog.subject",
        target: req.params.id,
        details: b,
        ip: req.ip,
      });
    });
    return loadCatalog(db, true);
  });

  app.put<{ Params: { slug: string } }>("/admin/catalog/categories/:slug", async (req) => {
    const s = await requireUser(db, config, hub, req, "/admin/catalog");
    if (!SLUG.test(req.params.slug))
      throw new ApiError("validation", "Use lowercase letters, digits and dashes", "slug");
    const b = parse(categoryBody, req.body);
    await tx(db, async (c) => {
      await c.query(
        `insert into categories (slug, name, name_bn, description, icon, tone, kind, active, sort) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         on conflict (slug) do update set name = excluded.name, name_bn = excluded.name_bn, description = excluded.description,
           icon = excluded.icon, tone = excluded.tone, kind = excluded.kind, active = excluded.active, sort = excluded.sort`,
        [
          req.params.slug,
          b.name,
          b.nameBn,
          b.description,
          b.icon,
          b.tone,
          b.kind,
          b.active,
          b.sort,
        ],
      );
      await audit(c, {
        actorId: s.user.id,
        action: "catalog.category",
        target: req.params.slug,
        details: b,
        ip: req.ip,
      });
    });
    return loadCatalog(db, true);
  });

  app.put<{ Params: { workType: string } }>("/admin/price-list/:workType", async (req) => {
    const s = await requireUser(db, config, hub, req, "/admin/catalog");
    const workType = parse(z.enum(WORK_TYPES), req.params.workType);
    const b = parse(
      z.object({ perPageMinor: z.number().int().min(100).max(10_000_000) }),
      req.body,
    );
    await tx(db, async (c) => {
      await c.query(
        "update price_list set per_page_minor = $2, updated_at = now() where work_type = $1",
        [workType, b.perPageMinor],
      );
      await audit(c, {
        actorId: s.user.id,
        action: "price_list.update",
        target: workType,
        details: b,
        ip: req.ip,
      });
    });
    return loadCatalog(db, true);
  });

  /** Business rules (commission, revisions, matching timings): super admin only. */
  app.get("/admin/settings", async (req) => {
    await requireUser(db, config, hub, req, "/admin/settings");
    return getSettings(db);
  });

  app.put("/admin/settings", async (req) => {
    const s = await requireUser(db, config, hub, req, "/admin/settings");
    const patch = parse(SETTINGS_SCHEMA.partial().strict(), req.body);
    if (Object.keys(patch).length === 0) throw new ApiError("validation", "Nothing to change");
    await tx(db, async (c) => {
      for (const [key, value] of Object.entries(patch)) {
        await c.query(
          "update platform_settings set value = $2, updated_by = $3, updated_at = now() where key = $1",
          [key, JSON.stringify(value), s.user.id],
        );
      }
      await audit(c, { actorId: s.user.id, action: "settings.update", details: patch, ip: req.ip });
    });
    return getSettings(db);
  });
};
