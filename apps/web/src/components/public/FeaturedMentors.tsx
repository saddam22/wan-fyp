"use client";

import Link from "next/link";
import { useState } from "react";
import { Gift } from "lucide-react";
import { mockApi } from "@edukhata/contracts";
import { CopyButton } from "@/components/ui/client";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { subjectName } from "@/lib/labels";
import { MentorCard } from "./MentorCard";

const TABS = [
  "all",
  "biology",
  "math",
  "ict",
  "english",
  "physics",
  "chemistry",
  "business",
  "others",
] as const;
const MAIN = new Set<string>(TABS.slice(1, -1));

export function FeaturedMentors() {
  const { t, lang } = useT();
  const [tab, setTab] = useState<(typeof TABS)[number]>("all");
  const list = mockApi
    .mentors({ sort: "rating" })
    .filter((m) =>
      tab === "all"
        ? true
        : tab === "others"
          ? !MAIN.has(m.primarySubject)
          : m.subjects.includes(tab),
    )
    .slice(0, 5);
  return (
    <section aria-labelledby="featured-mentors">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="featured-mentors" className="text-base font-bold text-ink sm:text-lg">
          {t.home.featuredMentors}
        </h2>
        <Link
          href="/mentors"
          className="text-xs font-semibold text-brand-600 hover:underline sm:text-sm"
        >
          {t.home.viewAllMentors} →
        </Link>
      </div>
      <div
        role="tablist"
        aria-label="Subjects"
        className="scrollbar-none mb-3 flex gap-1.5 overflow-x-auto"
      >
        {TABS.map((id) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition",
              tab === id
                ? "bg-brand-600 text-white"
                : "bg-white text-ink ring-1 ring-line hover:bg-brand-50",
            )}
          >
            {id === "all" ? t.home.all : id === "others" ? t.home.others : subjectName(id, lang)}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-6">
        {list.map((m) => (
          <MentorCard key={m.id} m={m} />
        ))}
        {list.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-muted">
            No mentors in this subject yet.
          </p>
        )}
        <div className="card col-span-2 flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-amber-50 to-white p-4 text-center sm:col-span-1">
          <Gift size={36} className="text-danger" />
          <p className="text-lg leading-tight font-extrabold text-danger">{t.home.promoTitle}</p>
          <p className="text-xs text-muted">{t.home.promoSub}</p>
          <div className="mt-1 rounded-lg border border-dashed border-amber-400 bg-white px-3 py-1.5">
            <p className="text-[10px] text-muted">{t.home.useCode}</p>
            <p className="font-mono text-sm font-bold tracking-wider text-ink">WELCOME20</p>
          </div>
          <CopyButton text="WELCOME20" />
        </div>
      </div>
    </section>
  );
}
