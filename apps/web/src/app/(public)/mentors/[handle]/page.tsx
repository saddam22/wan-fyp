import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  Briefcase,
  Clock,
  GraduationCap,
  Languages,
  MessageCircle,
  Play,
  ShieldCheck,
  Timer,
  TrendingUp,
} from "lucide-react";
import { fixtures, formatMoney, formatNumber, mockApi } from "@edukhata/contracts";
import { MentorThumb } from "@/components/public/MentorCard";
import { Avatar, Badge, buttonClass, Card, CardHeader, Stars } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { BADGE, subjectName, WORK_TYPE } from "@/lib/labels";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const m = mockApi.mentor((await params).handle);
  return m
    ? { title: `${m.name} — ${subjectName(m.primarySubject)} mentor`, description: m.headline }
    : { title: "Mentor not found" };
}

export default async function MentorProfile({ params }: { params: Promise<{ handle: string }> }) {
  const m = mockApi.mentor((await params).handle);
  if (!m) notFound();
  const { t, lang } = await getT();
  const services = fixtures.services.filter((s) => s.mentorId === m.id);
  const reviews = fixtures.reviews.filter((r) => r.mentorId === m.id && r.status === "published");
  const portfolio = m.id === "m1" ? fixtures.portfolio : fixtures.portfolio.slice(0, 3);
  const stats: [typeof Briefcase, string, string][] = [
    [Briefcase, formatNumber(m.completedOrders, lang), "Orders completed"],
    [Timer, `${Math.round(m.onTimeRate * 100)}%`, "On-time delivery"],
    [MessageCircle, `~${m.responseHours} h`, "Response time"],
    [TrendingUp, formatNumber(m.rankPoints, lang), "Rank points"],
  ];
  return (
    <div className="container-x py-6">
      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-muted">
        <Link href="/" className="hover:underline">
          Home
        </Link>{" "}
        /{" "}
        <Link href="/mentors" className="hover:underline">
          Mentors
        </Link>{" "}
        / <span className="text-ink">{m.name}</span>
      </nav>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <Card className="overflow-hidden">
            <div className="h-28 bg-gradient-to-r from-brand-600 via-indigo-600 to-violet-600 sm:h-36" />
            <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end">
              <Avatar name={m.name} hue={m.hue} size={104} className="-mt-14 ring-4 ring-white" />
              <div className="min-w-0 flex-1">
                <h1 className="flex flex-wrap items-center gap-2 text-xl font-extrabold text-ink sm:text-2xl">
                  {m.name}
                  {m.verified && (
                    <Badge tone="green">
                      <BadgeCheck size={12} /> Verified
                    </Badge>
                  )}
                </h1>
                <p className="text-sm text-muted">{m.headline}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Stars rating={m.rating} count={m.reviewCount} />
                  {m.badges
                    .filter((b) => b !== "verified")
                    .map((b) => (
                      <Badge key={b} tone={BADGE[b].tone}>
                        {BADGE[b].label}
                        {BADGE[b].paid && " · Paid promotion"}
                      </Badge>
                    ))}
                </div>
              </div>
            </div>
            <ul className="grid grid-cols-2 border-t border-line sm:grid-cols-4">
              {stats.map(([Icon, v, l]) => (
                <li
                  key={l}
                  className="flex items-center gap-2.5 border-line p-4 [&:not(:last-child)]:sm:border-r"
                >
                  <Icon size={18} className="text-brand-600" />
                  <div>
                    <p className="font-bold text-ink">{v}</p>
                    <p className="text-[11px] text-muted">{l}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="About" />
            <div className="grid gap-5 p-5 md:grid-cols-[1fr_220px]">
              <div className="space-y-3 text-sm text-slate-700">
                <p>{m.bio}</p>
                <ul className="space-y-1.5">
                  <li className="flex items-center gap-2">
                    <GraduationCap size={15} className="text-muted" /> {m.education},{" "}
                    {m.institution}
                  </li>
                  <li className="flex items-center gap-2">
                    <Languages size={15} className="text-muted" /> {m.languages.join(", ")}
                  </li>
                  <li className="flex items-center gap-2">
                    <ShieldCheck size={15} className="text-muted" />{" "}
                    {m.verified
                      ? "Identity & qualification reviewed by EduKhata"
                      : "Verification in progress"}
                  </li>
                </ul>
                <div className="flex flex-wrap gap-1.5">
                  {m.subjects.map((s) => (
                    <Badge key={s} tone="blue">
                      {subjectName(s, lang)}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="overflow-hidden rounded-xl ring-1 ring-line">
                <div className="relative">
                  <MentorThumb m={{ ...m, badges: [] }} />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white">
                      <Play size={13} className="fill-current" /> Video intro
                    </span>
                  </span>
                </div>
                <p className="bg-slate-50 px-3 py-2 text-[11px] text-muted">
                  Video player connects to storage in Phase 4.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Services"
              sub="Prices are per page; the final price is shown before payment."
            />
            <ul className="divide-y divide-line">
              {(services.length
                ? services
                : [
                    {
                      id: "x",
                      title: `${subjectName(m.primarySubject)} assignment`,
                      workType: "digital" as const,
                      pricePerPage: m.startingPrice,
                      discountPct: 0,
                      deliveryDays: m.deliveryDays,
                      active: true,
                    },
                  ]
              )
                .filter((s) => s.active)
                .map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-ink">{s.title}</p>
                      <p className="text-xs text-muted">
                        {WORK_TYPE[s.workType]} · <Clock size={11} className="inline" />{" "}
                        {s.deliveryDays} day{s.deliveryDays > 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-right">
                        <span className="block font-bold text-ink">
                          {formatMoney(s.pricePerPage, lang)}
                          <span className="text-xs font-normal text-muted">/page</span>
                        </span>
                        {s.discountPct > 0 && (
                          <span className="text-[11px] font-semibold text-success">
                            {s.discountPct}% off
                          </span>
                        )}
                      </span>
                      <Link
                        href={`/order/new?mentor=${m.handle}&service=${s.id}`}
                        className={buttonClass("primary", "sm")}
                      >
                        Order
                      </Link>
                    </div>
                  </li>
                ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Portfolio" sub="Handwriting samples, practical pages and drawings" />
            <ul className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
              {portfolio.map((p) => (
                <li key={p.id} className="overflow-hidden rounded-xl ring-1 ring-line">
                  <div className="ruled watermark relative h-32 bg-white">
                    <span
                      className="absolute inset-4 rounded-full opacity-30"
                      style={{
                        background: `radial-gradient(circle, hsl(${p.hue} 70% 55%), transparent 70%)`,
                      }}
                    />
                  </div>
                  <p className="truncate px-3 py-2 text-xs font-semibold">{p.title}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title={`Reviews (${m.reviewCount})`} />
            {reviews.length === 0 ? (
              <p className="p-5 text-sm text-muted">Reviews appear here after completed orders.</p>
            ) : (
              <ul className="divide-y divide-line">
                {reviews.map((r) => (
                  <li key={r.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">{r.studentName}</p>
                      <Stars rating={r.rating} showValue={false} size={12} />
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{r.text}</p>
                    <p className="mt-1 text-[11px] text-muted">Verified order {r.orderCode}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-32 lg:h-fit">
          <Card className="space-y-3 p-5">
            <p className="text-xs text-muted">Starting from</p>
            <p className="text-3xl font-extrabold text-ink">{formatMoney(m.startingPrice, lang)}</p>
            <ul className="space-y-1.5 text-sm text-slate-700">
              <li>
                ✓ Delivery in {m.deliveryDays} day{m.deliveryDays > 1 ? "s" : ""}
              </li>
              <li>✓ 2–3 free revisions</li>
              <li>✓ Paid to mentor only after you approve</li>
            </ul>
            <Link
              href={`/order/new?mentor=${m.handle}`}
              className={buttonClass("primary", "lg", "w-full")}
            >
              {t.home.orderNowBtn}
            </Link>
            <Link
              href={`/login?next=/student/messages`}
              className={buttonClass("outline", "md", "w-full")}
            >
              <MessageCircle size={16} /> Message mentor
            </Link>
            {!m.available && (
              <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
                Fully booked right now ({m.activeOrders}/{m.capacity} orders). You can still order —
                it will be offered when capacity frees up, or to other matching mentors.
              </p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
