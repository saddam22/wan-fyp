"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpCircle,
  Award,
  BadgeCheck,
  Banknote,
  Bell,
  BookOpen,
  BookText,
  Briefcase,
  CalendarDays,
  ChartColumn,
  ChevronDown,
  ClipboardList,
  CreditCard,
  ExternalLink,
  FileCheck2,
  FileDown,
  FileText,
  Flag,
  GalleryHorizontal,
  Gift,
  GraduationCap,
  Heart,
  History,
  Images,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  type LucideIcon,
  Mail,
  Megaphone,
  Menu,
  MessageSquare,
  MessageSquareWarning,
  Newspaper,
  Percent,
  PlusCircle,
  Receipt,
  Rocket,
  Scale,
  ScrollText,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Star,
  Tags,
  Ticket,
  TicketPercent,
  Trophy,
  Undo2,
  UserCheck,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { AREA_ROLES, ROLE_LABEL, type Area, type Role } from "@edukhata/contracts";
import { Logo } from "@/components/Logo";
import { LanguageSwitch } from "@/components/public/Header";
import { Avatar } from "@/components/ui";
import { signOut } from "@/lib/actions";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { AREA_TITLE, NAV } from "@/lib/nav";

const ICONS: Record<string, LucideIcon> = {
  ArrowUpCircle,
  Award,
  BadgeCheck,
  Banknote,
  Bell,
  BookOpen,
  BookText,
  Briefcase,
  CalendarDays,
  ChartColumn,
  ClipboardList,
  CreditCard,
  FileCheck2,
  FileDown,
  FileText,
  Flag,
  GalleryHorizontal,
  Gift,
  GraduationCap,
  Heart,
  History,
  Images,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  Megaphone,
  MessageSquare,
  MessageSquareWarning,
  Newspaper,
  Percent,
  PlusCircle,
  Receipt,
  Rocket,
  Scale,
  ScrollText,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Star,
  Tags,
  Ticket,
  TicketPercent,
  Trophy,
  Undo2,
  UserCheck,
  UserRound,
  Users,
  Wallet,
};

const AREA_HOME: Record<Area, string> = {
  student: "/student",
  mentor: "/mentor",
  guardian: "/guardian",
  admin: "/admin",
  accountant: "/accountant",
  "support-desk": "/support-desk",
};

function areasFor(roles: Role[]): Area[] {
  return (Object.keys(AREA_ROLES) as Area[]).filter((a) =>
    roles.some((r) => (AREA_ROLES[a] as readonly Role[]).includes(r)),
  );
}

function useClickOutside(onOut: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onOut();
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onOut]);
  return ref;
}

function Sidebar({
  area,
  roles,
  onNavigate,
}: {
  area: Area;
  roles: Role[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isSuper = roles.includes("super_admin");
  const home = AREA_HOME[area];
  return (
    <nav aria-label={AREA_TITLE[area]} className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {NAV[area].map((g, gi) => (
        <div key={gi}>
          {g.title && (
            <p className="mb-1.5 px-3 text-[10px] font-bold tracking-wider text-muted uppercase">
              {g.title}
            </p>
          )}
          <ul className="space-y-0.5">
            {g.links
              .filter((l) => !l.superOnly || isSuper)
              .map((l) => {
                const Icon = ICONS[l.icon] ?? LayoutDashboard;
                const active =
                  l.href === home
                    ? pathname === home
                    : pathname === l.href || pathname.startsWith(`${l.href}/`);
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-semibold transition",
                        active
                          ? "bg-[var(--color-accent)] text-white shadow-sm"
                          : "text-slate-600 hover:bg-[var(--color-accent-50)] hover:text-ink",
                      )}
                    >
                      <Icon size={17} className="shrink-0" />
                      <span className="flex-1 truncate">{l.label}</span>
                      {l.badge !== undefined && (
                        <span
                          className={cn(
                            "rounded-full px-1.5 text-[10px] font-bold",
                            active ? "bg-white/25 text-white" : "bg-danger text-white",
                          )}
                        >
                          {l.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function DashboardShell({
  area,
  user,
  children,
}: {
  area: Area;
  user: { name: string; hue: number; roles: Role[] };
  children: React.ReactNode;
}) {
  const { t } = useT();
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const [bell, setBell] = useState(false);
  const menuRef = useClickOutside(() => setMenu(false));
  const bellRef = useClickOutside(() => setBell(false));
  const areas = areasFor(user.roles);
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setDrawer(false);
  }

  return (
    <div data-accent={area} className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-white pt-[30px] lg:flex">
        <div className="flex h-16 items-center border-b border-line px-5">
          <Logo href={AREA_HOME[area]} />
        </div>
        <p className="mx-5 mt-4 rounded-lg bg-[var(--color-accent-50)] px-3 py-2 text-xs font-bold text-[var(--color-accent)]">
          {AREA_TITLE[area]}
        </p>
        <Sidebar area={area} roles={user.roles} />
        <div className="border-t border-line p-3">
          <Link
            href="/contact"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted hover:bg-slate-50"
          >
            <LifeBuoy size={15} /> Help & support
          </Link>
        </div>
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setDrawer(false)} />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={t.header.menu}
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-white shadow-xl"
          >
            <div className="flex h-16 items-center justify-between border-b border-line px-4">
              <Logo href={AREA_HOME[area]} />
              <button
                aria-label={t.header.close}
                onClick={() => setDrawer(false)}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>
            <p className="mx-4 mt-3 rounded-lg bg-[var(--color-accent-50)] px-3 py-2 text-xs font-bold text-[var(--color-accent)]">
              {AREA_TITLE[area]}
            </p>
            <Sidebar area={area} roles={user.roles} onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-line bg-white/95 px-4 backdrop-blur sm:px-6">
          <button
            className="-ml-1 rounded-lg p-2 hover:bg-slate-100 lg:hidden"
            aria-label={t.header.menu}
            onClick={() => setDrawer(true)}
          >
            <Menu size={22} />
          </button>
          <label className="relative hidden max-w-md flex-1 md:block">
            <span className="sr-only">Search</span>
            <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input
              className="input h-9 bg-slate-50 pl-9"
              placeholder="Search orders, people, invoices…"
            />
          </label>
          <div className="ml-auto flex items-center gap-1 sm:gap-3">
            <Link
              href="/"
              className="hidden items-center gap-1 text-xs font-semibold text-muted hover:text-ink sm:flex"
            >
              View site <ExternalLink size={12} />
            </Link>
            <LanguageSwitch className="max-sm:hidden" />
            <div ref={bellRef} className="relative">
              <button
                aria-label={t.header.notifications}
                aria-expanded={bell}
                onClick={() => setBell((b) => !b)}
                className="relative rounded-lg p-2 hover:bg-slate-100"
              >
                <Bell size={20} />
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-danger" />
              </button>
              {bell && (
                <div className="animate-pop absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-white shadow-[var(--shadow-pop)]">
                  <p className="border-b border-line px-4 py-3 text-sm font-bold">
                    {t.header.notifications}
                  </p>
                  <ul className="max-h-80 divide-y divide-line overflow-y-auto text-sm">
                    {[
                      ["Delivery ready for review", "EK-24502 · 10 h ago"],
                      ["New preview uploaded", "EK-24518 · 6 h ago"],
                      ["Deadline in 30 hours", "EK-24518 · 1 h ago"],
                    ].map(([a, b]) => (
                      <li key={a} className="px-4 py-3">
                        <p className="font-semibold">{a}</p>
                        <p className="text-xs text-muted">{b}</p>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={`${AREA_HOME[area]}/notifications`}
                    onClick={() => setBell(false)}
                    className="block border-t border-line px-4 py-2.5 text-center text-xs font-semibold text-[var(--color-accent)]"
                  >
                    View all
                  </Link>
                </div>
              )}
            </div>
            <div ref={menuRef} className="relative">
              <button
                aria-label="Account menu"
                aria-expanded={menu}
                onClick={() => setMenu((m) => !m)}
                className="flex items-center gap-2 rounded-full p-0.5 pr-2 hover:bg-slate-100"
              >
                <Avatar name={user.name} hue={user.hue} size={34} />
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block max-w-36 truncate text-sm font-semibold">{user.name}</span>
                  <span className="block text-[11px] text-muted">
                    {user.roles.map((r) => ROLE_LABEL[r]).join(" · ")}
                  </span>
                </span>
                <ChevronDown size={14} />
              </button>
              {menu && (
                <div className="animate-pop absolute right-0 z-40 mt-2 w-60 rounded-xl border border-line bg-white p-1.5 shadow-[var(--shadow-pop)]">
                  {areas.length > 1 && (
                    <>
                      <p className="px-3 pt-1.5 pb-1 text-[10px] font-bold tracking-wider text-muted uppercase">
                        Switch dashboard
                      </p>
                      {areas.map((a) => (
                        <Link
                          key={a}
                          href={AREA_HOME[a]}
                          className={cn(
                            "block rounded-lg px-3 py-2 text-sm hover:bg-slate-50",
                            a === area && "font-bold text-[var(--color-accent)]",
                          )}
                        >
                          {AREA_TITLE[a]}
                        </Link>
                      ))}
                      <hr className="my-1 border-line" />
                    </>
                  )}
                  <Link
                    href={`${AREA_HOME[area]}${area === "mentor" || area === "student" ? "/profile" : ""}`}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    <UserRound size={16} /> Profile
                  </Link>
                  <form action={signOut}>
                    <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-rose-50">
                      <LogOut size={16} /> {t.header.signOut}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
