import type { Queryable } from "../db.ts";

/**
 * A badge shown on a mentor. Earned badges come from checked facts (verification by
 * staff, a passed skill test, the track record). Paid ones come from promotions and are
 * always labelled as paid; they never mean the mentor was verified and never change the
 * organic ranking or matching.
 */
export interface MentorBadge {
  id: string;
  label: string;
  paid: boolean;
}

interface BadgeRow {
  id: string;
  verified: boolean;
  completed: number;
  reviews: number;
  rating: string | null;
  delivered: number;
  on_time: string | null;
  skills: string[] | null;
  promos: string[] | null;
}

export async function badgesFor(
  db: Queryable,
  mentorIds: string[],
): Promise<Map<string, MentorBadge[]>> {
  const out = new Map<string, MentorBadge[]>();
  if (!mentorIds.length) return out;
  const rows = (
    await db.query<BadgeRow>(
      `select u.id, coalesce(p.verified_at is not null, false) as verified,
         (select count(*)::int from orders o where o.mentor_id = u.id and o.status in ('approved', 'closed')) as completed,
         (select count(*)::int from reviews v where v.mentor_id = u.id and v.status = 'published') as reviews,
         (select avg(rating) from reviews v where v.mentor_id = u.id and v.status = 'published') as rating,
         (select count(*)::int from orders o where o.mentor_id = u.id and o.delivered_at is not null) as delivered,
         (select avg(case when o.delivered_at <= o.deadline then 1 else 0 end) from orders o
            where o.mentor_id = u.id and o.delivered_at is not null) as on_time,
         (select array_agg(distinct s.name order by s.name) from skill_attempts a
            join skill_tests t on t.id = a.test_id join subjects s on s.id = t.subject_id
            where a.mentor_id = u.id and a.passed) as skills,
         (select array_agg(distinct m.kind) from mentor_promotions m
            where m.mentor_id = u.id and m.status = 'active' and now() between m.starts_at and m.ends_at) as promos
       from users u left join mentor_profiles p on p.user_id = u.id where u.id = any($1::uuid[])`,
      [mentorIds],
    )
  ).rows;
  for (const r of rows) {
    const b: MentorBadge[] = [];
    if (r.verified) b.push({ id: "verified", label: "Verified mentor", paid: false });
    for (const s of r.skills ?? [])
      b.push({ id: `skill:${s}`, label: `${s} skill test passed`, paid: false });
    if (r.reviews >= 5 && Number(r.rating) >= 4.7)
      b.push({ id: "top_rated", label: "Top rated", paid: false });
    if (r.delivered >= 5 && Number(r.on_time) >= 0.9)
      b.push({ id: "on_time", label: "On-time delivery", paid: false });
    if (r.completed >= 20) b.push({ id: "experienced", label: "20+ orders", paid: false });
    const promos = r.promos ?? [];
    if (promos.includes("boost")) b.push({ id: "featured", label: "Featured · paid", paid: true });
    if (promos.some((k) => k.startsWith("pro_")))
      b.push({ id: "pro", label: "Pro · paid", paid: true });
    out.set(r.id, b);
  }
  return out;
}
