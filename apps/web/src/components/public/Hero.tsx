"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  Headphones,
  Search,
  ShieldCheck,
} from "lucide-react";
import { fixtures } from "@edukhata/contracts";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";

/** Decorative scene: open practical khata, labelled diagram, pencil, flask. */
function Illustration({ variant }: { variant: number }) {
  return (
    <svg viewBox="0 0 420 300" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="h-page" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#f1f5ff" />
        </linearGradient>
      </defs>
      <ellipse cx="215" cy="268" rx="180" ry="18" fill="#000" opacity=".18" />
      <g transform="rotate(-6 210 160)">
        <rect x="40" y="40" width="170" height="220" rx="8" fill="url(#h-page)" />
        <rect x="210" y="40" width="170" height="220" rx="8" fill="url(#h-page)" />
        <rect x="205" y="40" width="10" height="220" fill="#cbd5e1" />
        {Array.from({ length: 12 }).map((_, i) => (
          <g key={i}>
            <line
              x1="52"
              x2="200"
              y1={70 + i * 15}
              y2={70 + i * 15}
              stroke="#93c5fd"
              strokeWidth="1"
            />
            <line
              x1="222"
              x2="370"
              y1={70 + i * 15}
              y2={70 + i * 15}
              stroke="#93c5fd"
              strokeWidth="1"
            />
          </g>
        ))}
        <line x1="66" x2="66" y1="48" y2="252" stroke="#fda4af" strokeWidth="1.5" />
        <text x="74" y="64" fontSize="12" fontWeight="700" fill="#1e3a8a" fontFamily="Inter">
          {variant === 1 ? "Experiment 4" : "Practical No. 3"}
        </text>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <rect
            key={i}
            x="74"
            y={78 + i * 15}
            width={90 + ((i * 37) % 40)}
            height="4"
            rx="2"
            fill="#334155"
            opacity=".55"
          />
        ))}
        {variant === 1 ? (
          <g transform="translate(240 70)">
            <path
              d="M10 140 C 40 30, 90 30, 120 140"
              fill="none"
              stroke="#1d4ed8"
              strokeWidth="2.5"
            />
            <line x1="0" x2="130" y1="140" y2="140" stroke="#334155" strokeWidth="1.5" />
            <line x1="5" x2="5" y1="10" y2="140" stroke="#334155" strokeWidth="1.5" />
            {[20, 45, 65, 85, 108].map((x, i) => (
              <circle key={x} cx={x} cy={[100, 55, 42, 58, 105][i]} r="3.5" fill="#e11d48" />
            ))}
          </g>
        ) : (
          <g transform="translate(250 72)">
            <path
              d="M55 10c28 0 45 22 45 50 0 34-24 62-45 82C34 122 10 94 10 60 10 32 27 10 55 10Z"
              fill="#fecdd3"
              stroke="#be123c"
              strokeWidth="2"
            />
            <path d="M55 30v95M30 60h50" stroke="#be123c" strokeWidth="1.5" strokeDasharray="4 3" />
            {[
              [100, 40, "Aorta"],
              [104, 90, "Ventricle"],
              [-6, 52, "Atrium"],
            ].map(([x, y, l]) => (
              <g key={String(l)}>
                <line
                  x1={Number(x) > 50 ? 80 : 30}
                  y1={Number(y)}
                  x2={Number(x) > 50 ? Number(x) - 2 : Number(x) + 34}
                  y2={Number(y)}
                  stroke="#334155"
                />
                <text
                  x={Number(x) > 50 ? Number(x) : Number(x) - 18}
                  y={Number(y) + 4}
                  fontSize="10"
                  fill="#0f172a"
                  fontFamily="Inter"
                >
                  {String(l)}
                </text>
              </g>
            ))}
          </g>
        )}
      </g>
      <g transform="rotate(32 340 220)">
        <rect x="270" y="210" width="130" height="14" rx="3" fill="#f59e0b" />
        <rect x="270" y="210" width="20" height="14" fill="#fda4af" />
        <path d="M400 210 418 217 400 224Z" fill="#fde68a" />
        <path d="M412 215 418 217 412 219Z" fill="#334155" />
      </g>
      <g transform="translate(330 20)">
        <path
          d="M20 0h24v8h-4v30l26 46a8 8 0 0 1-7 12H5a8 8 0 0 1-7-12l26-46V8h-4Z"
          fill="#dbeafe"
          stroke="#1d4ed8"
          strokeWidth="2"
        />
        <path d="M6 70 L58 70 L66 84a6 6 0 0 1-6 9H4a6 6 0 0 1-6-9Z" fill="#34d399" opacity=".8" />
        <circle cx="28" cy="78" r="3" fill="#fff" />
        <circle cx="40" cy="74" r="2" fill="#fff" />
      </g>
    </svg>
  );
}

const TONE_BG: Record<string, string> = {
  blue: "from-[#0b1b3f] via-[#12306e] to-[#1d4ed8]",
  violet: "from-[#1e1b4b] via-[#3b2a8c] to-[#6d28d9]",
  teal: "from-[#052e2b] via-[#0f5d55] to-[#0d9488]",
  rose: "from-[#3f0b1f] via-[#7a1d3d] to-[#e11d48]",
  amber: "from-[#3b2205] via-[#7a4a0b] to-[#d97706]",
};

export interface HeroSlide {
  pre: string;
  main: string;
  post: string;
  ctaLabel: string | null;
  ctaHref: string | null;
  tone: string;
}

/** `banners`: slides managed by admins (live); the built-in slides otherwise. */
export function Hero({ banners }: { banners?: HeroSlide[] } = {}) {
  const { t } = useT();
  const router = useRouter();
  const [slide, setSlide] = useState(0);
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState("all");
  const builtIn: { pre: string; main: string; post: string; bg: string; cta?: [string, string] }[] =
    [
      {
        pre: t.home.heroTitle1,
        main: t.home.heroTitle2,
        post: t.home.heroTitle3,
        bg: "from-[#0b1b3f] via-[#12306e] to-[#1d4ed8]",
      },
      {
        pre: "Handwritten",
        main: "Practical Khata",
        post: "delivered to your door",
        bg: "from-[#1e1b4b] via-[#3b2a8c] to-[#6d28d9]",
      },
      {
        pre: "Biology drawings,",
        main: "Diagrams & Sketches",
        post: "by verified mentors",
        bg: "from-[#052e2b] via-[#0f5d55] to-[#0d9488]",
      },
    ];
  const slides = banners?.length
    ? banners.map((b) => ({
        pre: b.pre,
        main: b.main,
        post: b.post,
        bg: TONE_BG[b.tone] ?? TONE_BG.blue!,
        cta: b.ctaLabel && b.ctaHref ? ([b.ctaLabel, b.ctaHref] as [string, string]) : undefined,
      }))
    : builtIn;
  useEffect(() => {
    const id = setInterval(() => setSlide((s) => (s + 1) % slides.length), 7000);
    return () => clearInterval(id);
  }, [slides.length]);
  const s = slides[slide]!;
  const chips = [
    { icon: <BadgeCheck size={14} />, label: t.home.chipMentors, c: "bg-emerald-500" },
    { icon: <ShieldCheck size={14} />, label: t.home.chipPayment, c: "bg-amber-500" },
    { icon: <Clock size={14} />, label: t.home.chipDelivery, c: "bg-rose-500" },
    { icon: <Headphones size={14} />, label: t.home.chipSupport, c: "bg-sky-500" },
  ];
  return (
    <section
      aria-roledescription="carousel"
      aria-label="Highlights"
      className={cn(
        "relative overflow-hidden rounded-2xl bg-gradient-to-br text-white shadow-lg transition-colors duration-700",
        s.bg,
      )}
    >
      <div
        aria-hidden
        className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/10 blur-2xl"
      />
      <div
        aria-hidden
        className="absolute -bottom-32 left-10 h-72 w-72 rounded-full bg-sky-400/20 blur-3xl"
      />
      <div className="relative grid items-center gap-4 p-5 sm:p-8 md:grid-cols-[1.15fr_1fr] md:gap-2">
        <div className="space-y-4">
          <h1
            className="text-[26px] leading-tight font-extrabold tracking-tight sm:text-4xl"
            aria-live="polite"
          >
            {s.pre}
            <br />
            <span className="text-amber-300">{s.main}</span>
            <br />
            {s.post}
          </h1>
          <p className="max-w-md text-sm text-blue-100 sm:text-base">{t.home.heroSub}</p>
          {s.cta && (
            <a
              href={s.cta[1]}
              {...(s.cta[1].startsWith("https://") ? { rel: "noopener noreferrer" } : {})}
              className="inline-flex h-10 items-center rounded-lg bg-amber-400 px-4 text-sm font-bold text-navy hover:bg-amber-300"
            >
              {s.cta[0]}
            </a>
          )}
          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold">
            {chips.map((c) => (
              <li key={c.label} className="flex items-center gap-1.5">
                <span className={cn("flex h-5 w-5 items-center justify-center rounded-full", c.c)}>
                  {c.icon}
                </span>
                {c.label}
              </li>
            ))}
          </ul>
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              router.push(
                `/search?q=${encodeURIComponent(q)}${subject !== "all" ? `&subject=${subject}` : ""}`,
              );
            }}
            className="flex max-w-xl flex-col gap-2 rounded-xl bg-white p-1.5 sm:flex-row"
          >
            <label className="flex flex-1 items-center gap-2 px-2">
              <Search size={18} className="text-muted" aria-hidden />
              <span className="sr-only">{t.header.search}</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t.header.searchPlaceholder}
                className="h-10 w-full bg-transparent text-sm text-ink outline-none"
              />
            </label>
            <select
              aria-label={t.home.allSubjects}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="h-10 rounded-lg border border-line bg-slate-50 px-2 text-sm text-ink sm:w-36"
            >
              <option value="all">{t.home.allSubjects}</option>
              {fixtures.subjects.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
            <button className="flex h-10 items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand">
              <Search size={16} /> {t.header.search}
            </button>
          </form>
        </div>
        <div className="relative hidden h-64 md:block lg:h-72">
          <Illustration variant={slide % 2} />
          <span className="absolute top-2 right-2 rotate-6 rounded-lg bg-white/95 px-3 py-2 font-[cursive] text-sm leading-tight text-brand shadow">
            Learn.
            <br />
            Submit.
            <br />
            Improve.
            <br />
            <span className="text-danger">Succeed!</span>
          </span>
        </div>
      </div>
      <div className="absolute right-4 bottom-3 flex items-center gap-2">
        <button
          aria-label="Previous slide"
          onClick={() => setSlide((slide + slides.length - 1) % slides.length)}
          className="rounded-full bg-white/20 p-1.5 hover:bg-white/30"
        >
          <ChevronLeft size={16} />
        </button>
        {slides.map((_, i) => (
          <button
            key={i}
            aria-label={`Slide ${i + 1}`}
            aria-current={i === slide}
            onClick={() => setSlide(i)}
            className={cn(
              "h-2 rounded-full transition-all",
              i === slide ? "w-6 bg-white" : "w-2 bg-white/50",
            )}
          />
        ))}
        <button
          aria-label="Next slide"
          onClick={() => setSlide((slide + 1) % slides.length)}
          className="rounded-full bg-white/20 p-1.5 hover:bg-white/30"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </section>
  );
}
