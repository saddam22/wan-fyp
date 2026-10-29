import Link from "next/link";
import type { ReactNode } from "react";

export function PageHero({
  title,
  sub,
  crumbs,
  children,
}: {
  title: ReactNode;
  sub?: ReactNode;
  crumbs: { label: string; href?: string }[];
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-navy via-[#12306e] to-brand text-white">
      <div
        aria-hidden
        className="absolute -top-20 -right-16 h-64 w-64 rounded-full bg-white/10 blur-2xl"
      />
      <div className="container-x relative py-8 sm:py-10">
        <nav
          aria-label="Breadcrumb"
          className="mb-2 flex flex-wrap items-center gap-1 text-xs text-blue-200"
        >
          <Link href="/" className="hover:text-white">
            Home
          </Link>
          {crumbs.map((c) => (
            <span key={c.label} className="flex items-center gap-1">
              <span aria-hidden>/</span>
              {c.href ? (
                <Link href={c.href} className="hover:text-white">
                  {c.label}
                </Link>
              ) : (
                <span aria-current="page" className="text-white">
                  {c.label}
                </span>
              )}
            </span>
          ))}
        </nav>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {sub && <p className="mt-2 max-w-2xl text-sm text-blue-100 sm:text-base">{sub}</p>}
        {children && <div className="mt-4">{children}</div>}
      </div>
    </section>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4 text-[15px] leading-7 text-slate-700 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
      {children}
    </div>
  );
}

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <>
      <PageHero
        title={title}
        crumbs={[{ label: title }]}
        sub={`Last updated ${updated}. Draft for legal review — not yet final.`}
      />
      <div className="container-x py-8">
        <article className="card mx-auto max-w-3xl p-6 sm:p-10">
          <Prose>{children}</Prose>
        </article>
      </div>
    </>
  );
}
