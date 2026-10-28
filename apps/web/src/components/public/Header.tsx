"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  Bell,
  ChevronDown,
  ClipboardList,
  ExternalLink,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  UserPlus,
  X,
} from "lucide-react";
import { fixtures, homeFor, type Role } from "@edukhata/contracts";
import { Logo } from "@/components/Logo";
import { Avatar, buttonClass } from "@/components/ui";
import { setLanguage, signOut } from "@/lib/actions";
import { cn } from "@/lib/cn";
import { LANGS } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";
import { ICTSPARK_URL } from "@/lib/site";

export interface HeaderUser {
  name: string;
  hue: number;
  roles: Role[];
}

type NavItem = {
  label: string;
  href: string;
  external?: boolean;
  children?: { label: string; href: string; external?: boolean }[];
};

export function LanguageSwitch({ className, dark }: { className?: string; dark?: boolean }) {
  const { lang } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label
      className={cn(
        "relative inline-flex items-center gap-1 text-xs font-semibold",
        dark ? "text-blue-100" : "text-ink",
        className,
      )}
    >
      <Globe size={14} aria-hidden />
      <span className="sr-only">Language</span>
      <select
        className={cn(
          "cursor-pointer appearance-none bg-transparent pr-3 outline-none",
          pending && "opacity-50",
        )}
        value={lang}
        onChange={(e) => start(async () => (await setLanguage(e.target.value), router.refresh()))}
      >
        {LANGS.map((l) => (
          <option key={l.id} value={l.id} className="text-ink">
            {l.label}
          </option>
        ))}
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-0" aria-hidden />
    </label>
  );
}

function SearchBar({ className }: { className?: string }) {
  const { t } = useT();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  return (
    <form
      role="search"
      className={cn(
        "flex h-10 w-full items-stretch overflow-hidden rounded-[10px] border border-line bg-white focus-within:border-brand-600",
        className,
      )}
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/search?q=${encodeURIComponent(q)}${cat !== "all" ? `&category=${cat}` : ""}`);
      }}
    >
      <label className="flex min-w-0 flex-1 items-center gap-2 pl-3">
        <Search size={16} className="shrink-0 text-muted" aria-hidden />
        <span className="sr-only">{t.header.search}</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.header.searchPlaceholder}
          className="w-full min-w-0 bg-transparent text-sm outline-none"
        />
      </label>
      <select
        aria-label={t.header.allCategories}
        value={cat}
        onChange={(e) => setCat(e.target.value)}
        className="hidden border-l border-line bg-slate-50 px-2 text-xs text-ink outline-none lg:block"
      >
        <option value="all">{t.header.allCategories}</option>
        {fixtures.categories.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="bg-brand-600 px-4 text-white hover:bg-brand"
        aria-label={t.header.search}
      >
        <Search size={16} />
      </button>
    </form>
  );
}

function Dropdown({ item, active }: { item: NavItem; active: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) =>
      ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <li
      ref={ref}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1 rounded-md px-2.5 py-2 text-[13px] font-semibold whitespace-nowrap hover:text-brand-600",
          active ? "text-brand-600" : "text-ink",
        )}
      >
        {item.label}
        <ChevronDown size={14} className={cn("transition", open && "rotate-180")} />
      </button>
      {open && (
        <ul className="animate-pop absolute top-full left-0 z-50 min-w-56 rounded-xl border border-line bg-white p-1.5 shadow-[var(--shadow-pop)]">
          {item.children!.map((c) => (
            <li key={c.href}>
              <Link
                href={c.href}
                target={c.external ? "_blank" : undefined}
                rel={c.external ? "noopener noreferrer" : undefined}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-ink hover:bg-brand-50 hover:text-brand-600"
              >
                {c.label}
                {c.external && <ExternalLink size={13} className="text-muted" />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function UserMenu({ user }: { user: HeaderUser }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) =>
      ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full p-0.5 pr-2 hover:bg-slate-100"
      >
        <Avatar name={user.name} hue={user.hue} size={32} />
        <span className="hidden max-w-28 truncate text-sm font-semibold xl:inline">
          {user.name}
        </span>
        <ChevronDown size={14} className="hidden xl:inline" />
      </button>
      {open && (
        <div className="animate-pop absolute top-full right-0 z-50 mt-2 w-56 rounded-xl border border-line bg-white p-1.5 shadow-[var(--shadow-pop)]">
          <Link
            href={homeFor(user.roles)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50"
          >
            <LayoutDashboard size={16} /> {t.header.dashboard}
          </Link>
          <form action={signOut}>
            <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-rose-50">
              <LogOut size={16} /> {t.header.signOut}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export function Header({ user }: { user: HeaderUser | null }) {
  const { t } = useT();
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setDrawer(false);
  }

  const nav: NavItem[] = [
    { label: t.nav.home, href: "/" },
    {
      label: t.nav.assignments,
      href: "/assignments",
      children: [
        ...fixtures.categories
          .filter((c) => c.kind !== "practical" || c.slug === "drawings")
          .map((c) => ({ label: c.name, href: `/assignments/${c.slug}` })),
        { label: t.home.viewAllCategories, href: "/assignments" },
      ],
    },
    { label: t.nav.practicalKhata, href: "/practical-khata" },
    {
      label: t.nav.mentors,
      href: "/mentors",
      children: [
        { label: t.nav.allMentors, href: "/mentors" },
        { label: t.nav.topRated, href: "/mentors?sort=rating" },
        { label: t.nav.verifiedOnly, href: "/mentors?verified=1" },
        { label: t.header.becomeMentor, href: "/become-a-mentor" },
      ],
    },
    {
      label: t.nav.liveClasses,
      href: `${ICTSPARK_URL}/live-classes`,
      children: [
        {
          label: `${t.nav.liveClasses} ${t.nav.onIctSpark}`,
          href: `${ICTSPARK_URL}/live-classes`,
          external: true,
        },
      ],
    },
    {
      label: t.nav.exams,
      href: `${ICTSPARK_URL}/exams`,
      children: [
        {
          label: `${t.nav.exams} ${t.nav.onIctSpark}`,
          href: `${ICTSPARK_URL}/exams`,
          external: true,
        },
      ],
    },
    { label: t.nav.orderNow, href: "/order/new" },
    { label: t.nav.howItWorks, href: "/how-it-works" },
    { label: t.nav.pricing, href: "/pricing" },
    { label: t.nav.blog, href: "/blog" },
    { label: t.nav.contact, href: "/contact" },
  ];
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const ordersHref = user
    ? user.roles.includes("student")
      ? "/student/orders"
      : homeFor(user.roles)
    : "/login?next=/student/orders";

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="container-x flex h-16 items-center gap-3 lg:gap-6">
        <button
          className="-ml-1 rounded-lg p-2 hover:bg-slate-100 lg:hidden"
          aria-label={t.header.menu}
          onClick={() => setDrawer(true)}
        >
          <Menu size={22} />
        </button>
        <Logo tagline={t.brand.tagline} />
        <SearchBar className="hidden max-w-2xl flex-1 md:flex" />
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <span
            className="hidden items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-ink xl:flex"
            title={t.header.country}
          >
            <span
              aria-hidden
              className="relative inline-block h-3.5 w-5 overflow-hidden rounded-[2px] bg-[#006a4e]"
            >
              <span className="absolute top-1/2 left-[42%] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f42a41]" />
            </span>
            BD (BDT)
          </span>
          <LanguageSwitch className="max-sm:hidden" />
          <Link
            href={ordersHref}
            className="rounded-lg p-2 text-ink hover:bg-slate-100 max-sm:hidden"
            aria-label={t.header.myOrders}
            title={t.header.myOrders}
          >
            <ClipboardList size={20} />
          </Link>
          <Link
            href={user ? `${homeFor(user.roles)}/notifications` : "/login"}
            className="relative rounded-lg p-2 text-ink hover:bg-slate-100"
            aria-label={t.header.notifications}
          >
            <Bell size={20} />
            {user && (
              <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                3
              </span>
            )}
          </Link>
          {user ? (
            <UserMenu user={user} />
          ) : (
            <>
              <Link href="/login" className={buttonClass("outline", "sm", "max-sm:hidden")}>
                {t.header.login}
              </Link>
              <Link href="/login?mode=register" className={buttonClass("primary", "sm")}>
                {t.header.register}
              </Link>
            </>
          )}
        </div>
      </div>
      <div className="container-x pb-3 md:hidden">
        <SearchBar />
      </div>
      <nav aria-label="Main" className="hidden border-t border-line lg:block">
        <div className="container-x flex h-12 items-center gap-2">
          <ul className="flex min-w-0 flex-1 items-center gap-0.5">
            {nav.map((item) =>
              item.children ? (
                <Dropdown key={item.label} item={item} active={isActive(item.href)} />
              ) : (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={cn(
                      "block rounded-md px-2.5 py-2 text-[13px] font-semibold whitespace-nowrap hover:text-brand-600",
                      isActive(item.href) ? "bg-brand-50 text-brand-600" : "text-ink",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ),
            )}
          </ul>
          <Link href="/become-a-mentor" className={buttonClass("success", "sm")}>
            <UserPlus size={15} /> {t.header.becomeMentor}
          </Link>
          <Link href="/order/new" className={buttonClass("danger", "sm")}>
            <Plus size={15} /> {t.header.postAssignment}
          </Link>
        </div>
      </nav>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setDrawer(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t.header.menu}
            className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-line p-4">
              <Logo />
              <button
                aria-label={t.header.close}
                onClick={() => setDrawer(false)}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>
            <ul className="flex-1 overflow-y-auto p-2">
              {nav.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.children?.[0]?.external ? item.children[0].href : item.href}
                    target={item.children?.[0]?.external ? "_blank" : undefined}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold",
                      isActive(item.href)
                        ? "bg-brand-50 text-brand-600"
                        : "text-ink hover:bg-slate-50",
                    )}
                  >
                    {item.label}
                    {item.children?.[0]?.external && (
                      <ExternalLink size={14} className="text-muted" />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="grid gap-2 border-t border-line p-4">
              <Link href="/order/new" className={buttonClass("danger", "md")}>
                <Plus size={16} /> {t.header.postAssignment}
              </Link>
              <Link href="/become-a-mentor" className={buttonClass("success", "md")}>
                <UserPlus size={16} /> {t.header.becomeMentor}
              </Link>
              <LanguageSwitch className="mt-2 justify-center" />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
