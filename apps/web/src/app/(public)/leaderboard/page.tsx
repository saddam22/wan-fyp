import type { Metadata } from "next";
import { fixtures, formatNumber, mockApi } from "@edukhata/contracts";
import { PageHero } from "@/components/public/kit";
import { Avatar, Card, CardHeader, Stars } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { subjectName } from "@/lib/labels";

export const metadata: Metadata = { title: "Leaderboard" };

export default async function LeaderboardPage() {
  const { lang } = await getT();
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
