import type { Metadata } from "next";
import { fixtures, formatNumber, mockApi } from "@edukhata/contracts";
import { PageHero } from "@/components/public/kit";
import { Avatar, Card, CardHeader, Stars } from "@/components/ui";
import { BadgeCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";
import { getT } from "@/lib/i18n/server";
import { subjectName } from "@/lib/labels";

export const metadata: Metadata = { title: "Leaderboard" };

export default async function LeaderboardPage() {
  const { lang } = await getT();
  if (authMode() === "wan") return <LiveLeaderboard lang={lang} />;
  return (
    <>
      <PageHero
        title="Leaderboard"
        sub="Rankings are earned: completed orders, ratings and on-time delivery for mentors; activity points for students who opt in."
        crumbs={[{ label: "Leaderboard" }]}
      />
      <div className="container-x grid gap-5 py-8 lg:grid-cols-2">
        <Card>
          <CardHeader title="Top mentors" />
          <ol className="divide-y divide-line">
            {mockApi.topMentors(9).map((m, i) => (
              <li key={m.id} className="flex items-center gap-3 p-4">
                <span className="w-6 text-center font-bold text-muted">{i + 1}</span>
                <Avatar name={m.name} hue={m.hue} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{m.name}</p>
                  <p className="text-xs text-muted">{subjectName(m.primarySubject, lang)}</p>
                </div>
                <div className="text-right">
                  <Stars rating={m.rating} size={10} />
                  <p className="text-xs text-muted">{formatNumber(m.rankPoints, lang)} pts</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
        <Card>
          <CardHeader title="Top students" sub="Only students who choose to appear are listed." />
          <ol className="divide-y divide-line">
            {fixtures.topStudents.map((s, i) => (
              <li key={s.id} className="flex items-center gap-3 p-4">
                <span className="w-6 text-center font-bold text-muted">{i + 1}</span>
                <Avatar name={s.name} hue={s.hue} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{s.name}</p>
                  <p className="text-xs text-muted">
                    {s.classLevel} · {s.institution}
                  </p>
                </div>
                <p className="text-sm font-bold">{formatNumber(s.points, lang)}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </>
  );
}

interface Board {
  mentors: {
    id: string;
    name: string;
    subjects: string[];
    verified: boolean;
    completedOrders: number;
    reviewCount: number;
    rating: number | null;
    points: number;
  }[];
  students: { name: string; institution: string; classLevel: string; points: number }[];
}

/** Earned points only; paid promotions never count. Students appear only if they opt in. */
async function LiveLeaderboard({ lang }: { lang: "en" | "bn" }) {
  const res = await apiFetch("/leaderboard").catch(() => null);
  const b: Board = res?.ok ? ((await res.json()) as Board) : { mentors: [], students: [] };
  return (
    <>
      <PageHero
        title="Leaderboard"
        sub="Mentors: 10 points per completed order plus their rating × reviews. Students who opt in: 10 per completed order, 3 per review written. Promotions never count."
        crumbs={[{ label: "Leaderboard" }]}
      />
      <div className="container-x grid gap-5 py-8 lg:grid-cols-2">
        <Card>
          <CardHeader title="Top mentors" />
          {b.mentors.length === 0 ? (
            <p className="p-5 text-sm text-muted">No rankings yet.</p>
          ) : (
            <ol className="divide-y divide-line">
              {b.mentors.map((m, i) => (
                <li key={m.id} className="flex items-center gap-3 p-4">
                  <span className="w-6 text-center font-bold text-muted">{i + 1}</span>
                  <Avatar name={m.name} hue={(i * 53) % 360} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 truncate font-semibold">
                      {m.name}
                      {m.verified && (
                        <BadgeCheck size={14} className="text-success" aria-label="Verified" />
                      )}
                    </p>
                    <p className="text-xs text-muted">
                      {m.subjects[0] ? subjectName(m.subjects[0], lang) : ""} · {m.completedOrders}{" "}
                      orders
                    </p>
                  </div>
                  <div className="text-right">
                    {m.rating !== null && <Stars rating={m.rating} size={10} />}
                    <p className="text-xs text-muted">{formatNumber(m.points, lang)} pts</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
        <Card>
          <CardHeader
            title="Top students"
            sub="Only students who choose to appear (in their profile)."
          />
          {b.students.length === 0 ? (
            <p className="p-5 text-sm text-muted">No students have opted in yet.</p>
          ) : (
            <ol className="divide-y divide-line">
              {b.students.map((s, i) => (
                <li key={`${s.name}-${i}`} className="flex items-center gap-3 p-4">
                  <span className="w-6 text-center font-bold text-muted">{i + 1}</span>
                  <Avatar name={s.name} hue={(i * 67) % 360} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{s.name}</p>
                    <p className="text-xs text-muted">
                      {s.classLevel} · {s.institution}
                    </p>
                  </div>
                  <p className="text-sm font-bold">{formatNumber(s.points, lang)}</p>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </>
  );
}
