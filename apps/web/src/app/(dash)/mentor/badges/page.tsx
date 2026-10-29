import { ApiProblem } from "@/components/dash/ApiProblem";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";
import { Award, Lock, Trophy } from "lucide-react";
import { fixtures, mockApi } from "@edukhata/contracts";
import { Badge, Card, CardHeader, PageHeader, Progress } from "@/components/ui";
import { cn } from "@/lib/cn";

export default async function MentorBadges() {
  if (authMode() === "wan") return <LiveBadges />;
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

interface LiveProfile {
  rating: number | null;
  reviewCount: number;
  completedOrders: number;
  verified: boolean;
  badges: { id: string; label: string; paid: boolean }[];
}

/** Earned badges come from checked facts; paid ones are labelled and never affect ranking. */
async function LiveBadges() {
  const res = await apiFetch("/mentor/profile");
  if (!res.ok) return <ApiProblem status={res.status} />;
  const p = (await res.json()) as LiveProfile;
  const how = [
    ["Verified mentor", "Send your documents for review", "/mentor/verification"],
    ["Skill test passed", "Pass a subject test", "/mentor/skill-tests"],
    ["Top rated", "4.7+ average over 5+ published reviews", null],
    ["On-time delivery", "90%+ of 5+ deliveries before the deadline", null],
    ["20+ orders", "20 approved orders", null],
  ] as const;
  return (
    <>
      <PageHeader title="Badges & Ranking" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader title="Your badges" />
          {p.badges.length === 0 ? (
            <p className="p-5 text-sm text-muted">No badges yet.</p>
          ) : (
            <ul className="flex flex-wrap gap-2 p-5">
              {p.badges.map((b) => (
                <li key={b.id}>
                  <Badge tone={b.paid ? "violet" : "green"}>{b.label}</Badge>
                </li>
              ))}
            </ul>
          )}
          <ul className="divide-y divide-line border-t border-line text-sm">
            {how.map(([name, rule, href]) => (
              <li key={name} className="flex items-center gap-3 px-5 py-3">
                <Award size={16} className="text-amber-500" />
                <span className="flex-1">
                  <b>{name}</b> — {rule}
                </span>
                {href && (
                  <a href={href} className="text-xs font-semibold text-[var(--color-accent)]">
                    Go
                  </a>
                )}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Your organic ranking" />
          <div className="space-y-2 p-5 text-sm">
            <p>
              Rating: <b>{p.rating ?? "—"}</b> ({p.reviewCount} reviews)
            </p>
            <p>
              Approved orders: <b>{p.completedOrders}</b>
            </p>
            <p>
              Verified: <b>{p.verified ? "yes" : "no"}</b>
            </p>
            <p className="pt-2 text-xs text-muted">
              Matching ranks by rating, on-time delivery, free capacity, experience and
              verification. Paid promotions never change it.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
