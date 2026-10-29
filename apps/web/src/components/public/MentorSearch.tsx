"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { fixtures, mockApi, type MentorQuery } from "@edukhata/contracts";
import { EmptyState } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import { MentorCard } from "./MentorCard";

export function MentorSearch() {
  const params = useSearchParams();
  const router = useRouter();
  const { lang } = useT();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [subject, setSubject] = useState(params.get("subject") ?? "all");
  const [sort, setSort] = useState<NonNullable<MentorQuery["sort"]>>(
    (params.get("sort") as MentorQuery["sort"]) ?? "rating",
  );
  const [verifiedOnly, setVerified] = useState(params.get("verified") === "1");
  const [availableOnly, setAvailable] = useState(false);
  const list = useMemo(
    () => mockApi.mentors({ q, subject, sort, verifiedOnly, availableOnly }),
    [q, subject, sort, verifiedOnly, availableOnly],
  );

  const sync = (next: Record<string, string>) => {
    const sp = new URLSearchParams(params.toString());
    Object.entries(next).forEach(([k, v]) => (v ? sp.set(k, v) : sp.delete(k)));
    router.replace(`/mentors?${sp.toString()}`, { scroll: false });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="card h-fit space-y-4 p-4 lg:sticky lg:top-32">
        <p className="flex items-center gap-2 text-sm font-bold">
          <SlidersHorizontal size={16} /> Filters
        </p>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-muted">Keyword</span>
          <input
            className="input"
            value={q}
            onChange={(e) => (setQ(e.target.value), sync({ q: e.target.value }))}
            placeholder="Name, subject, institution"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-muted">Subject</span>
          <select
            className="input"
            value={subject}
            onChange={(e) => (
              setSubject(e.target.value),
              sync({ subject: e.target.value === "all" ? "" : e.target.value })
            )}
          >
            <option value="all">All subjects</option>
            {fixtures.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {lang === "bn" ? s.nameBn : s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-muted">Sort by</span>
          <select
            className="input"
            value={sort}
            onChange={(e) => (
              setSort(e.target.value as typeof sort),
              sync({ sort: e.target.value })
            )}
          >
            <option value="rating">Highest rated</option>
            <option value="orders">Most orders</option>
            <option value="price">Lowest price</option>
            <option value="delivery">Fastest delivery</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(e) => (
              setVerified(e.target.checked),
              sync({ verified: e.target.checked ? "1" : "" })
            )}
            className="h-4 w-4 accent-brand-600"
          />
          Verified mentors only
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(e) => setAvailable(e.target.checked)}
            className="h-4 w-4 accent-brand-600"
          />
          Available now
        </label>
        <p className="rounded-lg bg-slate-50 p-2.5 text-[11px] text-muted">
          Ranking uses rating, completed orders and on-time delivery only. Paid <b>Featured</b>/
          <b>Pro</b> labels never change the order.
        </p>
      </aside>
      <div>
        <p className="mb-3 text-sm text-muted" aria-live="polite">
          {list.length} mentor{list.length === 1 ? "" : "s"} found
        </p>
        {list.length === 0 ? (
          <div className="card">
            <EmptyState
              title="No mentors match these filters"
              body="Try another subject or remove a filter."
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {list.map((m) => (
              <MentorCard key={m.id} m={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
