"use client";

import Link from "next/link";
import { BadgeCheck, Clock, Heart, Play } from "lucide-react";
import { formatMoney, type Mentor } from "@edukhata/contracts";
import { Avatar, Badge, buttonClass, Stars } from "@/components/ui";
import { useDemoToast } from "@/components/ui/client";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { BADGE, subjectName } from "@/lib/labels";

/** The first earned ribbon wins; paid ribbons ("Pro", "Featured") are always labelled as promotions. */
function ribbonOf(m: Mentor) {
  const order = ["top_rated", "trusted", "popular", "fast_delivery", "featured", "pro"] as const;
  const b = order.find((x) => m.badges.includes(x));
  return b ? BADGE[b] : null;
}

const RIBBON_BG = {
  blue: "bg-brand-600",
  teal: "bg-teal-600",
  red: "bg-danger",
  amber: "bg-amber-500",
  violet: "bg-violet-600",
  green: "bg-success",
  gray: "bg-slate-600",
};

export function MentorThumb({ m, className }: { m: Mentor; className?: string }) {
  const ribbon = ribbonOf(m);
  return (
    <div
      className={cn("relative aspect-[4/3] overflow-hidden", className)}
      style={{
        background: `linear-gradient(160deg, hsl(${m.hue} 70% 92%), hsl(${(m.hue + 30) % 360} 60% 80%))`,
      }}
    >
      <div className="absolute inset-x-0 bottom-0 flex justify-center">
        <Avatar
          name={m.name}
          hue={m.hue}
          size={84}
          className="translate-y-3 shadow-lg ring-4 ring-white/70"
        />
      </div>
      {ribbon && (
        <span
          className={cn(
            "absolute top-2 left-2 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase",
            RIBBON_BG[ribbon.tone],
          )}
        >
          {ribbon.label}
          {ribbon.paid && <span className="ml-1 font-medium normal-case opacity-90">· Paid</span>}
        </span>
      )}
      {m.hasVideoIntro && (
        <span
          className="absolute top-1/2 left-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-[85%] items-center justify-center rounded-full bg-white/90 text-brand-600 shadow"
          aria-label="Has video introduction"
        >
          <Play size={16} className="ml-0.5 fill-current" />
        </span>
      )}
    </div>
  );
}

export function MentorCard({ m }: { m: Mentor }) {
  const { t, lang } = useT();
  const demo = useDemoToast();
  return (
    <article className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <Link href={`/mentors/${m.handle}`} aria-label={m.name}>
        <MentorThumb m={m} />
      </Link>
      <div className="flex flex-1 flex-col gap-1.5 p-3 pt-4">
        <div className="flex items-start justify-between gap-1">
          <Link href={`/mentors/${m.handle}`} className="min-w-0">
            <h3 className="flex items-center gap-1 truncate text-sm font-bold text-ink group-hover:text-brand-600">
              <span className="truncate">{m.name}</span>
              {m.verified && (
                <BadgeCheck
                  size={15}
                  className="shrink-0 fill-brand-600 text-white"
                  aria-label="Verified"
                />
              )}
            </h3>
          </Link>
          <button
            aria-label={`Save ${m.name}`}
            onClick={() => demo(`Saved ${m.name} to favourites`)}
            className="text-slate-300 hover:text-danger"
          >
            <Heart size={16} />
          </button>
        </div>
        <p className="truncate text-xs text-muted">
          {subjectName(m.primarySubject, lang)} {lang === "bn" ? "বিশেষজ্ঞ" : "Expert"}
        </p>
        <Stars rating={m.rating} count={m.reviewCount} />
        <div className="mt-auto flex items-center justify-between pt-1 text-xs">
          <span className="text-sm font-bold text-ink">{formatMoney(m.startingPrice, lang)}</span>
          <span className="flex items-center gap-1 text-muted">
            <Clock size={12} />
            {m.deliveryDays} {m.deliveryDays === 1 ? t.home.day : t.home.days}
          </span>
        </div>
        {!m.available && <Badge tone="gray">Fully booked</Badge>}
        <Link
          href={`/order/new?mentor=${m.handle}`}
          className={buttonClass("primary", "sm", "mt-1 w-full")}
        >
          {t.home.orderNowBtn}
        </Link>
      </div>
    </article>
  );
}
