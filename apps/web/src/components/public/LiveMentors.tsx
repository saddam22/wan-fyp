import Link from "next/link";
import { BadgeCheck, Star } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { apiFetch } from "@/lib/api";

interface DirMentor {
  id: string;
  name: string;
  headline: string;
  institution: string;
  subjects: string[];
  available: boolean;
  completedOrders: number;
  rating: number | null;
  reviewCount: number;
  verified: boolean;
  badges: { id: string; label: string; paid: boolean }[];
}

function MentorCard({ m }: { m: DirMentor }) {
  return (
    <Card className="flex h-full flex-col gap-2 p-4">
      <p className="flex items-center gap-1.5 font-bold">
        {m.name}
        {m.verified && <BadgeCheck size={16} className="text-success" aria-label="Verified" />}
      </p>
      <p className="text-sm text-muted">{m.headline || m.institution || "Mentor"}</p>
      <p className="flex items-center gap-1 text-xs">
        <Star size={13} className="text-amber-500" />
        {m.rating ?? "New"} {m.reviewCount > 0 && `(${m.reviewCount})`} · {m.completedOrders} orders
        · {m.available ? "available" : "busy"}
      </p>
      <ul className="flex flex-wrap gap-1">
        {m.badges.map((b) => (
          <li key={b.id}>
            <Badge tone={b.paid ? "violet" : "green"}>{b.label}</Badge>
          </li>
        ))}
      </ul>
      <Link
        href={`/order/new?mentor=${m.id}`}
        className="mt-auto text-sm font-semibold text-brand-600 hover:underline"
      >
        Order from {m.name.split(" ")[0]} →
      </Link>
    </Card>
  );
}

/** Live directory: organic order from the API; paid "featured" mentors in their own, labelled row. */
export async function LiveMentors() {
  const [dir, feat] = await Promise.all([apiFetch("/mentors"), apiFetch("/mentors/featured")]);
  const mentors = dir.ok ? ((await dir.json()) as DirMentor[]) : [];
  const featured = feat.ok ? ((await feat.json()) as DirMentor[]) : [];
  return (
    <div className="space-y-8">
      {featured.length > 0 && (
        <section aria-labelledby="featured">
          <h2 id="featured" className="mb-3 flex items-center gap-2 font-bold">
            Featured <Badge tone="violet">Paid promotion</Badge>
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((m) => (
              <li key={m.id}>
                <MentorCard m={m} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby="all">
        <h2 id="all" className="mb-1 font-bold">
          All mentors
        </h2>
        <p className="mb-3 text-xs text-muted">
          Ordered by availability, verification, rating and track record. Promotions don&apos;t
          change this order.
        </p>
        {mentors.length === 0 ? (
          <p className="py-10 text-center text-muted">No mentors yet.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {mentors.map((m) => (
              <li key={m.id}>
                <MentorCard m={m} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
