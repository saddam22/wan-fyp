import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { Queryable } from "../db.ts";
import type { Deps } from "../deps.ts";
import { ApiError } from "../lib/errors.ts";
import { requireUser } from "../lib/session.ts";
import { LEVELS, WORK_TYPES } from "./catalog.ts";

const profileBody = z.object({
  headline: z.string().trim().max(120),
  bio: z.string().trim().max(2000),
  institution: z.string().trim().max(120),
  education: z.string().trim().max(200),
  subjects: z.array(z.string()).max(10),
  workTypes: z.array(z.enum(WORK_TYPES)).max(WORK_TYPES.length),
  levels: z.array(z.enum(LEVELS)).max(LEVELS.length),
  available: z.boolean(),
  capacity: z.number().int().min(1).max(20),
});

interface ProfileRow {
  user_id: string;
  name: string;
  headline: string;
  bio: string;
  institution: string;
  education: string;
  subjects: string[];
  work_types: string[];
  levels: string[];
  available: boolean;
  capacity: number;
  active_orders: number;
  completed_orders: number;
}

/** Active orders count against capacity; completed ones are the public track record. */
export const PROFILE_SQL = `select u.id as user_id, u.name, coalesce(p.headline, '') as headline, coalesce(p.bio, '') as bio,
    coalesce(p.institution, '') as institution, coalesce(p.education, '') as education,
    coalesce(p.subjects, '{}') as subjects, coalesce(p.work_types, '{}') as work_types, coalesce(p.levels, '{}') as levels,
    coalesce(p.available, false) as available, coalesce(p.capacity, 3) as capacity,
    (select count(*)::int from orders o where o.mentor_id = u.id and o.status in ('assigned', 'in_progress', 'delivered', 'revision_requested')) as active_orders,
    (select count(*)::int from orders o where o.mentor_id = u.id and o.status in ('approved', 'closed')) as completed_orders
  from users u left join mentor_profiles p on p.user_id = u.id`;

const toProfile = (r: ProfileRow) => ({
  id: r.user_id,
  name: r.name,
  headline: r.headline,
  bio: r.bio,
  institution: r.institution,
  education: r.education,
  subjects: r.subjects,
  workTypes: r.work_types,
  levels: r.levels,
  available: r.available,
  capacity: r.capacity,
  activeOrders: r.active_orders,
  completedOrders: r.completed_orders,
});

async function profileOf(db: Queryable, userId: string) {
  const r = (await db.query<ProfileRow>(`${PROFILE_SQL} where u.id = $1`, [userId])).rows[0];
  if (!r) throw new ApiError("not_found");
  return toProfile(r);
}

/** Mentor profiles: the mentor edits their own; anyone can browse active mentors. */
export const mentorRoutes: FastifyPluginAsync<Deps> = async (app, { db, config, hub }) => {
  app.get("/mentor/profile", async (req) => {
    const s = await requireUser(db, config, hub, req, "/mentor");
    return profileOf(db, s.user.id);
  });

  app.put("/mentor/profile", async (req) => {
    const s = await requireUser(db, config, hub, req, "/mentor");
    const parsed = profileBody.safeParse(req.body);
    if (!parsed.success)
      throw new ApiError(
        "validation",
        parsed.error.issues[0]?.message,
        parsed.error.issues[0]?.path.join("."),
      );
    const b = parsed.data;
    const subjects = [...new Set(b.subjects)];
    const known = (
      await db.query<{ id: string }>(
        "select id from subjects where active and id = any($1::text[])",
        [subjects],
      )
    ).rows;
    if (known.length !== subjects.length)
      throw new ApiError("validation", "Unknown subject", "subjects");
    // Taking orders needs at least one subject and one type of work.
    if (b.available && (subjects.length === 0 || b.workTypes.length === 0))
      throw new ApiError(
        "validation",
        "Choose your subjects and types of work before taking orders",
        "available",
      );
    await db.query(
      `insert into mentor_profiles (user_id, headline, bio, institution, education, subjects, work_types, levels, available, capacity)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       on conflict (user_id) do update set headline = excluded.headline, bio = excluded.bio, institution = excluded.institution,
         education = excluded.education, subjects = excluded.subjects, work_types = excluded.work_types, levels = excluded.levels,
         available = excluded.available, capacity = excluded.capacity, updated_at = now()`,
      [
        s.user.id,
        b.headline,
        b.bio,
        b.institution,
        b.education,
        subjects,
        [...new Set(b.workTypes)],
        [...new Set(b.levels)],
        b.available,
        b.capacity,
      ],
    );
    return profileOf(db, s.user.id);
  });

  /** Public directory: active mentors only, names and work details (no contact data). */
  app.get<{ Querystring: { subject?: string; workType?: string } }>("/mentors", async (req) => {
    const rows = (
      await db.query<ProfileRow>(
        `${PROFILE_SQL}
          where u.status = 'active' and exists (select 1 from user_roles r where r.user_id = u.id and r.role = 'mentor')
            and p.user_id is not null
            and ($1::text is null or $1 = any(p.subjects)) and ($2::text is null or $2 = any(p.work_types))
          order by p.available desc, u.name limit 100`,
        [req.query.subject ?? null, req.query.workType ?? null],
      )
    ).rows;
    return rows.map((r) => {
      const { capacity: _c, activeOrders: _a, ...pub } = toProfile(r);
      return pub;
    });
  });
};
