import Link from "next/link";
import {
  Award,
  BadgeCheck,
  BookOpen,
  Brush,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  CreditCard,
  FileText,
  Gift,
  Globe2,
  GraduationCap,
  Headphones,
  Landmark,
  Layers,
  type LucideIcon,
  MessageSquareText,
  PenLine,
  Search,
  Star,
  Trophy,
  Users,
  Wallet,
  Wrench,
  Zap,
} from "lucide-react";
import {
  fixtures,
  formatMoney,
  formatNumber,
  type Category,
  type Lang,
  mockApi,
} from "@edukhata/contracts";
import { Avatar, buttonClass, Card, SectionTitle, Stars } from "@/components/ui";
import { CopyButton } from "@/components/ui/client";
import type { Messages } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { LEVEL, subjectName } from "@/lib/labels";

export const CATEGORY_ICON: Record<string, LucideIcon> = {
  GraduationCap,
  BookOpen,
  Landmark,
  PenLine,
  FileText,
  Wrench,
  Brush,
};
export const TONE_BG: Record<Category["tone"], string> = {
  blue: "bg-blue-100 text-blue-700",
  indigo: "bg-indigo-100 text-indigo-700",
  green: "bg-green-100 text-green-700",
  amber: "bg-amber-100 text-amber-700",
  violet: "bg-violet-100 text-violet-700",
  rose: "bg-rose-100 text-rose-700",
  teal: "bg-teal-100 text-teal-700",
};
const TONE_CARD: Record<Category["tone"], string> = {
  blue: "from-blue-50",
  indigo: "from-indigo-50",
  green: "from-green-50",
  amber: "from-amber-50",
  violet: "from-violet-50",
  rose: "from-rose-50",
  teal: "from-teal-50",
};

const RANK_MEDAL = ["text-amber-500", "text-slate-400", "text-orange-600"];

function Rank({ i }: { i: number }) {
  return i < 3 ? (
    <Trophy size={16} className={cn("shrink-0", RANK_MEDAL[i])} aria-label={`Rank ${i + 1}`} />
  ) : (
    <span className="w-4 shrink-0 text-center text-xs font-bold text-muted">{i + 1}</span>
  );
}

export function TopStudents({ t, lang }: { t: Messages; lang: Lang }) {
  return (
    <Card className="p-4">
      <SectionTitle
        title={<span className="text-sm">{t.home.topStudents}</span>}
        href="/leaderboard"
        linkLabel={t.home.viewAll}
        icon={<Trophy size={16} className="text-amber-500" />}
      />
      <ol className="space-y-2.5">
        {fixtures.topStudents.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2.5">
            <Rank i={i} />
            <Avatar name={s.name} hue={s.hue} size={32} />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-ink">{s.name}</p>
              <p className="text-[11px] text-muted">
                {formatNumber(s.points, lang)} {t.home.points}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function TopMentors({ t, lang }: { t: Messages; lang: Lang }) {
  return (
    <Card className="p-4">
      <SectionTitle
        title={<span className="text-sm">{t.home.topMentors}</span>}
        href="/mentors?sort=rating"
        linkLabel={t.home.viewAll}
        icon={<Award size={16} className="text-brand-600" />}
      />
      <ol className="space-y-2.5">
        {mockApi.topMentors(5).map((m, i) => (
          <li key={m.id}>
            <Link
              href={`/mentors/${m.handle}`}
              className="flex items-center gap-2.5 rounded-lg hover:bg-slate-50"
            >
              <Rank i={i} />
              <Avatar name={m.name} hue={m.hue} size={32} />
              <div className="min-w-0">
                <p className="flex items-center gap-1 truncate text-[13px] font-semibold text-ink">
                  <span className="truncate">{m.name}</span>
                  {m.verified && (
                    <BadgeCheck size={13} className="shrink-0 fill-brand-600 text-white" />
                  )}
                </p>
                <p className="text-[11px] text-muted">{subjectName(m.primarySubject, lang)}</p>
                <Stars rating={m.rating} size={10} count={m.reviewCount} />
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function ReferralCard({ t }: { t: Messages }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 bg-gradient-to-r from-brand-600 to-indigo-600 px-4 py-3 text-white">
        <Gift size={22} />
        <div>
          <p className="text-sm font-bold">{t.home.referralTitle}</p>
          <p className="text-[11px] text-blue-100">{t.home.referralSub}</p>
        </div>
      </div>
      <div className="space-y-2 p-4">
        <p className="text-[11px] text-muted">{t.home.yourCode}</p>
        <div className="flex items-center justify-between rounded-lg border border-dashed border-brand-600/50 bg-brand-50 px-2 py-1.5">
          <span className="font-mono text-sm font-bold tracking-wide text-brand">EKHATA2026</span>
          <CopyButton text="EKHATA2026" />
        </div>
        <Link href="/student/referrals" className={buttonClass("primary", "sm", "w-full")}>
          {t.home.inviteNow}
        </Link>
      </div>
    </Card>
  );
}

export function PlatformStats({ t, lang }: { t: Messages; lang: Lang }) {
  const s = fixtures.platformStats;
  const rows: [LucideIcon, string, string, string][] = [
    [Users, `${formatNumber(s.students, lang)}+`, t.home.students, "bg-amber-100 text-amber-700"],
    [
      GraduationCap,
      `${formatNumber(s.mentors, lang)}+`,
      t.home.expertMentors,
      "bg-blue-100 text-blue-700",
    ],
    [
      ClipboardCheck,
      `${formatNumber(s.ordersCompleted, lang)}+`,
      t.home.completedOrders,
      "bg-rose-100 text-rose-700",
    ],
    [
      Star,
      `${formatNumber(s.positivePct, lang)}%`,
      t.home.positiveReviews,
      "bg-green-100 text-green-700",
    ],
  ];
  return (
    <Card className="p-4">
      <SectionTitle
        title={<span className="text-sm">{t.home.platformStats}</span>}
        icon={<Layers size={16} className="text-brand-600" />}
      />
      <ul className="space-y-3">
        {rows.map(([Icon, v, l, c]) => (
          <li key={l} className="flex items-center gap-3">
            <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", c)}>
              <Icon size={18} />
            </span>
            <div>
              <p className="text-sm font-bold text-ink">{v}</p>
              <p className="text-[11px] text-muted">{l}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[10px] text-muted">
        Demo figures — computed from live data in production.
      </p>
    </Card>
  );
}

export function WhyChoose({ t }: { t: Messages }) {
  const items = [
    t.home.why1,
    t.home.why2,
    t.home.why3,
    t.home.why4,
    t.home.why5,
    t.home.why6,
    t.home.why7,
  ];
  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-bold text-ink">{t.home.whyChoose}</h2>
      <ul className="space-y-2">
        {items.map((x) => (
          <li key={x} className="flex items-start gap-2 text-[13px] text-ink">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" />
            {x}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function NeedHelp({ t }: { t: Messages }) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-card)] bg-gradient-to-br from-brand-600 to-indigo-700 p-4 text-white shadow-md">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15">
        <Headphones size={24} />
      </span>
      <div className="min-w-0">
        <p className="font-bold">{t.home.needHelp}</p>
        <p className="text-xs text-blue-100">{t.home.needHelpSub}</p>
        <Link href="/contact" className={buttonClass("white", "sm", "mt-2")}>
          {t.home.contactSupport}
        </Link>
      </div>
    </div>
  );
}

export function FeatureStrip({ t }: { t: Messages }) {
  const items: [LucideIcon, string, string, string][] = [
    [BookOpen, t.home.featSubjects, t.home.featSubjectsSub, "text-rose-600 bg-rose-50"],
    [PenLine, t.home.featHandwritten, t.home.featHandwrittenSub, "text-green-600 bg-green-50"],
    [BadgeCheck, t.home.featVerified, t.home.featVerifiedSub, "text-blue-600 bg-blue-50"],
    [Zap, t.home.featFast, t.home.featFastSub, "text-amber-600 bg-amber-50"],
    [Globe2, t.home.featGlobal, t.home.featGlobalSub, "text-violet-600 bg-violet-50"],
  ];
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-3 2xl:grid-cols-5">
      {items.map(([Icon, title, sub, c], i) => (
        <li
          key={title}
          className={cn(
            "card flex items-center gap-2.5 p-3",
            i === 4 && "col-span-2 sm:col-span-1 xl:col-span-2 2xl:col-span-1",
          )}
        >
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", c)}>
            <Icon size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] leading-tight font-bold text-ink">{title}</p>
            <p className="text-[11px] leading-tight text-muted">{sub}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function CategoryCard({ c, lang }: { c: Category; lang: Lang }) {
  const Icon = CATEGORY_ICON[c.icon] ?? BookOpen;
  return (
    <Link
      href={`/assignments/${c.slug}`}
      className={cn(
        "card group flex items-center gap-3 bg-gradient-to-br to-white p-3 transition hover:-translate-y-0.5 hover:shadow-md",
        TONE_CARD[c.tone],
      )}
    >
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
          TONE_BG[c.tone],
        )}
      >
        <Icon size={22} />
      </span>
      <div className="min-w-0">
        <p className="line-clamp-2 text-[13px] leading-tight font-bold text-ink group-hover:text-brand-600">
          {lang === "bn" ? c.nameBn : c.name}
        </p>
        <p className="text-[11px] text-muted">{formatNumber(c.taskCount, lang)}+ tasks</p>
      </div>
    </Link>
  );
}

export function PopularCategories({ t, lang }: { t: Messages; lang: Lang }) {
  return (
    <section>
      <SectionTitle
        title={t.home.popularCategories}
        href="/assignments"
        linkLabel={t.home.viewAllCategories}
      />
      <div className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 2xl:grid-cols-6">
        {fixtures.categories.slice(0, 6).map((c) => (
          <div key={c.slug} className="w-56 shrink-0 snap-start sm:w-auto">
            <CategoryCard c={c} lang={lang} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function HowItWorks({ t }: { t: Messages }) {
  const steps: [LucideIcon, string, string, string][] = [
    [Search, t.home.step1, t.home.step1Sub, "bg-blue-100 text-blue-700"],
    [ClipboardCheck, t.home.step2, t.home.step2Sub, "bg-rose-100 text-rose-700"],
    [PenLine, t.home.step3, t.home.step3Sub, "bg-amber-100 text-amber-700"],
    [CheckCircle2, t.home.step4, t.home.step4Sub, "bg-violet-100 text-violet-700"],
    [Wallet, t.home.step5, t.home.step5Sub, "bg-green-100 text-green-700"],
    [Star, t.home.step6, t.home.step6Sub, "bg-orange-100 text-orange-700"],
  ];
  return (
    <section>
      <SectionTitle title={t.home.howItWorks} href="/how-it-works" linkLabel={t.home.readMore} />
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-6">
        {steps.map(([Icon, title, sub, c], i) => (
          <li key={title} className="card relative p-3 text-center">
            <span className="absolute top-2 left-2 text-[11px] font-bold text-muted">{i + 1}</span>
            <span
              className={cn(
                "mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full",
                c,
              )}
            >
              <Icon size={20} />
            </span>
            <p className="text-[13px] font-bold text-ink">{title}</p>
            <p className="text-[11px] text-muted">{sub}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function LatestAssignments({ t, lang }: { t: Messages; lang: Lang }) {
  const list = fixtures.orders.filter((o) => o.status !== "cancelled").slice(0, 6);
  return (
    <section>
      <SectionTitle
        title={t.home.latestAssignments}
        href="/assignments"
        linkLabel={t.home.viewAll}
      />
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((o) => (
          <li key={o.id} className="card flex gap-3 p-3">
            <div
              className="ruled h-16 w-14 shrink-0 rounded-md bg-white ring-1 ring-line"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-[13px] font-semibold text-ink">{o.title}</p>
              <p className="mt-0.5 text-[11px] text-muted">
                {LEVEL[o.level]} · {subjectName(o.subject, lang)} · {o.pages} pages
              </p>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-sm font-bold text-ink">{formatMoney(o.price, lang)}</span>
                <span className="flex items-center gap-1 text-[11px] text-muted">
                  <Clock size={11} />{" "}
                  {Math.max(
                    1,
                    Math.round(
                      (new Date(o.deadline).getTime() - new Date(o.createdAt).getTime()) / 86400000,
                    ),
                  )}{" "}
                  {t.home.days}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Testimonials({ t }: { t: Messages }) {
  return (
    <section>
      <SectionTitle title={t.home.testimonials} />
      <ul className="grid gap-3 md:grid-cols-3">
        {fixtures.testimonials.map((x) => (
          <li key={x.id} className="card flex flex-col gap-3 p-4">
            <MessageSquareText size={20} className="text-brand-600" />
            <p className="flex-1 text-sm text-ink">“{x.text}”</p>
            <div className="flex items-center gap-2.5">
              <Avatar name={x.name} hue={x.hue} size={34} />
              <div>
                <p className="text-[13px] font-semibold">{x.name}</p>
                <p className="text-[11px] text-muted">{x.institution}</p>
              </div>
              <span className="ml-auto">
                <Stars rating={x.rating} showValue={false} size={11} />
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function LatestBlog({ t, lang }: { t: Messages; lang: Lang }) {
  return (
    <section>
      <SectionTitle title={t.home.latestBlog} href="/blog" linkLabel={t.home.viewAll} />
      <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        {fixtures.blogPosts.map((p) => (
          <li key={p.slug}>
            <Link href={`/blog/${p.slug}`} className="card group block overflow-hidden">
              <BlogCover hue={p.hue} tag={p.tag} />
              <div className="p-3">
                <p className="line-clamp-2 text-[13px] font-bold text-ink group-hover:text-brand-600">
                  {p.title}
                </p>
                <p className="mt-1 text-[11px] text-muted">
                  {new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }).format(new Date(p.at))}{" "}
                  · {p.readMinutes} min
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function BlogCover({ hue, tag, tall }: { hue: number; tag: string; tall?: boolean }) {
  return (
    <div
      className={cn("relative flex items-end overflow-hidden p-3", tall ? "h-56" : "h-28")}
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 75% 55%), hsl(${(hue + 50) % 360} 70% 38%))`,
      }}
    >
      <div
        aria-hidden
        className="ruled absolute -right-6 -bottom-8 h-32 w-28 rotate-12 rounded-md bg-white/90 shadow-lg"
      />
      <span className="relative rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-ink">
        {tag}
      </span>
    </div>
  );
}

export function StatsBand({ t, lang }: { t: Messages; lang: Lang }) {
  const s = fixtures.platformStats;
  const items: [LucideIcon, string, string][] = [
    [ClipboardCheck, `${formatNumber(s.ordersCompleted, lang)}+`, t.home.statAssignments],
    [BadgeCheck, `${formatNumber(s.mentors, lang)}+`, t.home.statMentors],
    [Users, `${formatNumber(s.students, lang)}+`, t.home.statStudents],
    [Star, `${formatNumber(s.positivePct, lang)}%`, t.home.statReviews],
    [Headphones, "24/7", t.home.statSupport],
    [Globe2, t.home.statCountries, t.home.statCountriesSub],
  ];
  return (
    <section aria-label="Platform numbers" className="bg-navy text-white">
      <ul className="container-x grid grid-cols-2 gap-4 py-6 sm:grid-cols-3 lg:grid-cols-6">
        {items.map(([Icon, v, l]) => (
          <li key={l} className="flex items-center gap-3">
            <Icon size={26} className="shrink-0 text-amber-300" />
            <div>
              <p className="text-lg leading-tight font-extrabold">{v}</p>
              <p className="text-xs text-blue-200">{l}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Placeholder for a Central Ad Platform slot (`@adp/sdk` <AdSlot>). Always labelled.
 * Phase 3 replaces the placeholder with the SDK; with no ad, the SDK renders nothing.
 */
export function AdSlot({ t, placement }: { t: Messages; placement: string }) {
  return (
    <aside
      aria-label={t.home.sponsored}
      data-placement={placement}
      className="rounded-[var(--radius-card)] border border-dashed border-line bg-white p-3"
    >
      <p className="mb-1 text-[10px] font-bold tracking-wider text-muted uppercase">
        {t.home.sponsored}
      </p>
      <div className="flex h-16 items-center justify-center rounded-lg bg-slate-50 text-center text-xs text-muted">
        <CreditCard size={14} className="mr-1.5" />
        {t.home.adPlaceholder}
      </div>
    </aside>
  );
}
