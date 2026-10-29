"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  Search,
  TriangleAlert,
  X,
  XCircle,
} from "lucide-react";
import { countdown, urgency } from "@edukhata/contracts";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { Button, EmptyState } from "./index";

/* ---------- Toasts ---------- */

type ToastTone = "success" | "info" | "warning" | "danger";
interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
}
const ToastCtx = createContext<(t: Omit<ToastItem, "id">) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((t: Omit<ToastItem, "id">) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs.slice(-3), { ...t, id }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 5000);
  }, []);
  const ICON = { success: CheckCircle2, info: Info, warning: TriangleAlert, danger: XCircle };
  const COLOR = {
    success: "text-success",
    info: "text-brand-600",
    warning: "text-warning",
    danger: "text-danger",
  };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6"
      >
        {items.map((t) => {
          const Icon = ICON[t.tone];
          return (
            <div
              key={t.id}
              role="status"
              className="animate-pop pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line bg-white p-3 shadow-[var(--shadow-pop)]"
            >
              <Icon size={20} className={cn("mt-0.5 shrink-0", COLOR[t.tone])} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{t.title}</p>
                {t.body && <p className="text-xs text-muted">{t.body}</p>}
              </div>
              <button
                aria-label="Dismiss"
                onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))}
                className="text-muted hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

/** Toast for actions that have no backend yet. */
export function useDemoToast() {
  const toast = useToast();
  const { t } = useT();
  return useCallback(
    (title: string) => toast({ tone: "success", title, body: t.demo.notSaved }),
    [toast, t],
  );
}

export function DemoActionButton({
  label,
  done,
  ...rest
}: { label: ReactNode; done: string } & Omit<React.ComponentProps<typeof Button>, "onClick">) {
  const demo = useDemoToast();
  return (
    <Button {...rest} onClick={() => demo(done)}>
      {label}
    </Button>
  );
}

/* ---------- Modal ---------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("input,textarea,select,button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "animate-pop flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-[var(--shadow-pop)] sm:rounded-2xl",
          { sm: "sm:max-w-md", md: "sm:max-w-lg", lg: "sm:max-w-2xl" }[size],
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id={titleId} className="text-base font-bold text-ink">
            {title}
          </h2>
          <button
            aria-label="Close"
            onClick={onClose}
            className="rounded-lg p-1 text-muted hover:bg-slate-100 hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Countdown ---------- */

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // First tick after mount, so server and client render the same placeholder.
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => (clearTimeout(first), clearInterval(id));
  }, [intervalMs]);
  return now;
}

export function Countdown({
  deadline,
  compact,
  label,
}: {
  deadline: string;
  compact?: boolean;
  label?: string;
}) {
  const now = useNow();
  if (now === null) return <span className="text-xs text-muted">—</span>;
  const c = countdown(deadline, now);
  const u = urgency(deadline, now);
  const color = {
    overdue: "text-danger",
    critical: "text-danger",
    soon: "text-warning",
    ok: "text-success",
  }[u];
  const pad = (n: number) => String(n).padStart(2, "0");
  if (compact) {
    return (
      <span
        className={cn("font-mono text-xs font-semibold tabular-nums", color)}
        title={new Date(deadline).toLocaleString()}
      >
        {c.overdue ? "Overdue " : ""}
        {c.days > 0 ? `${c.days}d ` : ""}
        {pad(c.hours)}:{pad(c.minutes)}:{pad(c.seconds)}
      </span>
    );
  }
  const cells: [number, string][] = [
    [c.days, "Days"],
    [c.hours, "Hours"],
    [c.minutes, "Min"],
    [c.seconds, "Sec"],
  ];
  return (
    <div>
      {label && (
        <p className={cn("mb-1.5 text-xs font-semibold", color)}>
          {c.overdue ? "Overdue by" : label}
        </p>
      )}
      <div className="flex gap-1.5" role="timer" aria-live="off">
        {cells.map(([v, l]) => (
          <div
            key={l}
            className="min-w-12 rounded-lg bg-slate-50 px-2 py-1.5 text-center ring-1 ring-line"
          >
            <div className={cn("font-mono text-lg leading-none font-bold tabular-nums", color)}>
              {pad(v)}
            </div>
            <div className="mt-0.5 text-[10px] text-muted uppercase">{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Tabs (local state) ---------- */

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { id: T; label: ReactNode; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn("scrollbar-none flex gap-1 overflow-x-auto border-b border-line", className)}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition",
            value === t.id
              ? "border-[var(--color-accent,var(--color-brand-600))] text-[var(--color-accent,var(--color-brand-600))]"
              : "border-transparent text-muted hover:text-ink",
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className="rounded-full bg-slate-100 px-1.5 text-[11px] text-slate-600">
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ---------- Data table ---------- */

export interface Column<R> {
  key: string;
  header: string;
  cell: (row: R) => ReactNode;
  sort?: (row: R) => string | number;
  className?: string;
  /** Hidden below the md breakpoint (still shown in the mobile card view). */
  hideOnMobile?: boolean;
}

export function DataTable<R>({
  rows,
  columns,
  rowKey,
  searchText,
  filters,
  pageSize = 8,
  empty,
  toolbar,
  onRowClick,
}: {
  rows: R[];
  columns: Column<R>[];
  rowKey: (r: R) => string;
  searchText?: (r: R) => string;
  filters?: {
    label: string;
    options: { value: string; label: string }[];
    test: (r: R, v: string) => boolean;
  };
  pageSize?: number;
  empty?: { title: string; body?: string };
  toolbar?: ReactNode;
  onRowClick?: (r: R) => void;
}) {
  const [q, setQ] = useState("");
  const [f, setF] = useState("all");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);
  const { t } = useT();

  const filtered = useMemo(() => {
    let out = rows;
    if (q && searchText)
      out = out.filter((r) => searchText(r).toLowerCase().includes(q.toLowerCase()));
    if (filters && f !== "all") out = out.filter((r) => filters.test(r, f));
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.sort)
        out = [...out].sort((a, b) => (col.sort!(a) > col.sort!(b) ? sort.dir : -sort.dir));
    }
    return out;
  }, [rows, q, f, sort, columns, searchText, filters]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const shown = filtered.slice(cur * pageSize, cur * pageSize + pageSize);

  return (
    <div>
      {(searchText || filters || toolbar) && (
        <div className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row sm:items-center">
          {searchText && (
            <label className="relative flex-1">
              <span className="sr-only">{t.common.search}</span>
              <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
              <input
                className="input pl-9"
                placeholder={`${t.common.search}…`}
                value={q}
                onChange={(e) => (setQ(e.target.value), setPage(0))}
              />
            </label>
          )}
          {filters && (
            <select
              aria-label={filters.label}
              className="input sm:w-48"
              value={f}
              onChange={(e) => (setF(e.target.value), setPage(0))}
            >
              <option value="all">{filters.label}: All</option>
              {filters.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
          {toolbar}
        </div>
      )}
      {shown.length === 0 ? (
        <EmptyState
          title={empty?.title ?? t.common.empty}
          body={q ? `No results for “${q}”.` : empty?.body}
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-muted uppercase">
                <tr>
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      scope="col"
                      className={cn("px-4 py-2.5 font-semibold whitespace-nowrap", c.className)}
                    >
                      {c.sort ? (
                        <button
                          className="inline-flex items-center gap-1 uppercase hover:text-ink"
                          onClick={() =>
                            setSort((s) => ({
                              key: c.key,
                              dir: s?.key === c.key ? ((s.dir * -1) as 1 | -1) : 1,
                            }))
                          }
                        >
                          {c.header}
                          <span aria-hidden>
                            {sort?.key === c.key ? (sort.dir === 1 ? "▲" : "▼") : "↕"}
                          </span>
                        </button>
                      ) : (
                        c.header
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((r) => (
                  <tr
                    key={rowKey(r)}
                    className={cn("hover:bg-slate-50/70", onRowClick && "cursor-pointer")}
                    onClick={onRowClick ? () => onRowClick(r) : undefined}
                  >
                    {columns.map((c) => (
                      <td key={c.key} className={cn("px-4 py-3 align-middle", c.className)}>
                        {c.cell(r)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-line md:hidden">
            {shown.map((r) => (
              <li
                key={rowKey(r)}
                className="space-y-1.5 px-4 py-3"
                onClick={onRowClick ? () => onRowClick(r) : undefined}
              >
                {columns.map((c) => (
                  <div key={c.key} className="flex items-start justify-between gap-3 text-sm">
                    <span className="shrink-0 text-xs text-muted">{c.header}</span>
                    <span className="min-w-0 text-right">{c.cell(r)}</span>
                  </div>
                ))}
              </li>
            ))}
          </ul>
        </>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs text-muted">
          <span>
            {cur * pageSize + 1}–{Math.min(filtered.length, (cur + 1) * pageSize)} of{" "}
            {filtered.length}
          </span>
          <div className="flex gap-1">
            <button
              aria-label="Previous page"
              disabled={cur === 0}
              onClick={() => setPage(cur - 1)}
              className="rounded-md p-1.5 hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              aria-label="Next page"
              disabled={cur >= pages - 1}
              onClick={() => setPage(cur + 1)}
              className="rounded-md p-1.5 hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Copy button ---------- */

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const toast = useToast();
  return (
    <button
      type="button"
      className="rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-brand-600 ring-1 ring-line hover:bg-brand-50"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(
          () => toast({ tone: "success", title: "Copied", body: text }),
          () => toast({ tone: "warning", title: "Could not copy", body: text }),
        );
      }}
    >
      {label}
    </button>
  );
}
