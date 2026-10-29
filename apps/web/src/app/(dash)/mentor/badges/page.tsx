import { Award, Lock, Trophy } from "lucide-react";
import { fixtures, mockApi } from "@edukhata/contracts";
import { Badge, Card, CardHeader, PageHeader, Progress } from "@/components/ui";
import { cn } from "@/lib/cn";

export default function MentorBadges() {
  const rank = mockApi.topMentors(9).findIndex((m) => m.id === fixtures.meMentor.id) + 1;
  return (
    <>
      <PageHeader title="Badges & Ranking" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fixtures.badges.map((b) => (
            <Card key={b.id} className={cn("flex flex-col gap-2 p-5", !b.earned && "opacity-70")}>
              <span
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full",
                  b.earned ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-muted",
                )}
              >
                {b.earned ? <Award size={22} /> : <Lock size={20} />}
              </span>
              <p className="font-bold">
                {b.name} {b.paid && <Badge tone="violet">Paid promotion</Badge>}
              </p>
              <p className="text-sm text-muted">{b.description}</p>
              <p className="text-xs font-semibold">
                {b.earned ? "Earned" : b.paid ? "Available via Promote Profile" : "Not yet earned"}
              </p>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader title="Your ranking" />
          <div className="space-y-4 p-5">
            <p className="flex items-center gap-2 text-3xl font-extrabold">
              <Trophy className="text-amber-500" /> #{rank}
            </p>
            <p className="text-sm text-muted">Organic score — never affected by paid promotion.</p>
            {[
              ["Rating (4.9)", 98],
              ["On-time delivery (99%)", 99],
              ["Completed orders (1,240)", 92],
              ["Response time (~2 h)", 80],
              ["Revision rate (low)", 88],
            ].map(([l, v]) => (
              <div key={l as string}>
                <div className="mb-1 flex justify-between text-xs">
                  <span>{l}</span>
                  <span>{v}</span>
                </div>
                <Progress value={v as number} tone="accent" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
