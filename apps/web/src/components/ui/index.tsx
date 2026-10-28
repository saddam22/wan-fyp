import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Inbox, Star } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Tone } from "@/lib/labels";

type Variant =
  "primary" | "secondary" | "ghost" | "success" | "danger" | "outline" | "accent" | "white";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand shadow-sm",
  accent: "bg-[var(--color-accent)] text-white hover:brightness-95 shadow-sm",
  secondary: "bg-brand-50 text-brand hover:bg-brand-100",
  ghost: "text-ink hover:bg-slate-100",
  success: "bg-success text-white hover:brightness-95 shadow-sm",
  danger: "bg-danger text-white hover:brightness-95 shadow-sm",
  outline: "border border-line bg-white text-ink hover:bg-slate-50",
  white: "bg-white text-brand hover:bg-brand-50 shadow-sm",
};
const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center rounded-[10px] font-semibold whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-50",
    VARIANT[variant],
    SIZE[size],
    extra,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...rest} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}

const TONE: Record<Tone, string> = {
  gray: "bg-slate-100 text-slate-700",
  blue: "bg-blue-50 text-blue-700",
  green: "bg-green-50 text-green-700",
  amber: "bg-amber-50 text-amber-800",
  red: "bg-rose-50 text-rose-700",
  violet: "bg-violet-50 text-violet-700",
  teal: "bg-teal-50 text-teal-700",
};

export function Badge({
  tone = "gray",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({ className, children, ...rest }: ComponentProps<"div">) {
  return (
    <div className={cn("card", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  action,
  sub,
}: {
  title: ReactNode;
  action?: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <h2 className="text-[15px] font-bold text-ink">{title}</h2>
        {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
      </div>
      {action && <div className="shrink-0 text-sm">{action}</div>}
    </div>
  );
}

function initials(name: string) {
  return name
    .replace(/^(Dr\.|Mr\.|Ms\.)\s*/, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

/** Generated avatar (no stock photos in the demo). */
export function Avatar({
  name,
  hue = 210,
  size = 40,
  ring,
  className,
}: {
  name: string;
  hue?: number;
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white select-none",
        ring && "ring-2 ring-white",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.36),
        background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 40) % 360} 75% 40%))`,
      }}
    >
      {initials(name)}
    </span>
  );
}

export function Stars({
  rating,
  size = 13,
  showValue = true,
  count,
}: {
  rating: number;
  size?: number;
  showValue?: boolean;
  count?: number;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs"
      aria-label={`Rated ${rating} out of 5`}
    >
      <span className="inline-flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            width={size}
            height={size}
            className={
              i <= Math.round(rating)
                ? "fill-amber-400 text-amber-400"
                : "fill-slate-200 text-slate-200"
            }
          />
        ))}
      </span>
      {showValue && <span className="font-semibold text-ink">{rating.toFixed(1)}</span>}
      {count !== undefined && <span className="text-muted">({count})</span>}
    </span>
  );
}

export function SectionTitle({
  title,
  href,
  linkLabel,
  icon,
}: {
  title: ReactNode;
  href?: string;
  linkLabel?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-base font-bold text-ink sm:text-lg">
        {icon}
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          className="shrink-0 text-xs font-semibold text-brand-600 hover:underline sm:text-sm"
        >
          {linkLabel} →
        </Link>
      )}
    </div>
  );
}

export function PageHeader({
  title,
  sub,
  actions,
  crumbs,
}: {
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  crumbs?: { label: string; href?: string }[];
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {crumbs && (
          <nav
            aria-label="Breadcrumb"
            className="mb-1 flex flex-wrap items-center gap-1 text-xs text-muted"
          >
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {c.href ? (
                  <Link href={c.href} className="hover:text-ink hover:underline">
                    {c.label}
                  </Link>
                ) : (
                  <span>{c.label}</span>
                )}
                {i < crumbs.length - 1 && <span aria-hidden>/</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon,
  delta,
  tone = "blue",
  href,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  delta?: string;
  tone?: Tone;
  href?: string;
}) {
  const body = (
    <Card className="flex items-center gap-3 p-4 transition hover:shadow-md">
      <span
        className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", TONE[tone])}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-muted">{label}</p>
        <p className="text-xl font-bold text-ink">{value}</p>
        {delta && <p className="text-[11px] text-muted">{delta}</p>}
      </div>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        {icon ?? <Inbox size={22} />}
      </span>
      <p className="font-semibold text-ink">{title}</p>
      {body && <p className="max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Progress({
  value,
  tone = "blue",
  className,
}: {
  value: number;
  tone?: "blue" | "green" | "amber" | "accent";
  className?: string;
}) {
  const color = {
    blue: "bg-brand-600",
    green: "bg-success",
    amber: "bg-warning",
    accent: "bg-[var(--color-accent)]",
  }[tone];
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-100", className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full", color)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  required,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  required?: boolean;
  htmlFor?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function DemoNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      {children}
    </p>
  );
}

export function KeyValue({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs text-muted">{k}</dt>
          <dd className="font-medium break-words text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
