"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { formatDate, renderNotification, type NotificationDto } from "@edukhata/contracts";
import { Button, Card, EmptyState } from "@/components/ui";
import { Tabs, useToast } from "@/components/ui/client";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";

export interface NotificationPage {
  items: NotificationDto[];
  nextCursor: string | null;
  counts: { unread: number; unseen: number };
}

type Category = "account" | "family" | "referral" | "messages";
type CategoryPref = { enabled: boolean; push: boolean; email: boolean };

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "account", label: "Account & roles" },
  { id: "family", label: "Guardian links" },
  { id: "referral", label: "Referrals" },
  { id: "messages", label: "Messages & calls" },
];
/** The social module's default for a category nobody has changed. */
const DEFAULT_PREF: CategoryPref = { enabled: true, push: true, email: false };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: init?.body ? { "content-type": "application/json" } : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message ?? `Error ${res.status}`);
  return json as T;
}

/** Opens a notification through the API (ownership check + mark read), then follows its link. */
export function useOpenNotification() {
  const router = useRouter();
  const toast = useToast();
  return async (id: string) => {
    try {
      const { link } = await api<{ link: string }>(`/me/notifications/${id}/open`, {
        method: "POST",
      });
      // Links are created server-side and validated as internal paths; never follow others.
      if (link.startsWith("/") && !link.startsWith("//")) router.push(link);
    } catch (e) {
      toast({ tone: "danger", title: "Couldn't open", body: (e as Error).message });
    }
  };
}

/** The signed-in person's real notifications (WAN social module, via the EduKhata API). */
export function LiveNotifications({ initial }: { initial: NotificationPage }) {
  const { lang } = useT();
  const toast = useToast();
  const open = useOpenNotification();
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const unread = items.filter((n) => !n.readAt).length;
  const shown = items.filter((n) => tab === "all" || !n.readAt);

  useEffect(() => {
    // Viewing the list clears the bell's "new" dot.
    void api("/me/notifications/seen", { method: "POST" }).catch(() => undefined);
  }, []);

  const readAll = async () => {
    try {
      await api("/me/notifications/read-all", { method: "POST" });
      const now = new Date().toISOString();
      setItems((xs) => xs.map((x) => ({ ...x, readAt: x.readAt ?? now })));
    } catch (e) {
      toast({ tone: "danger", title: "Not saved", body: (e as Error).message });
    }
  };
  const more = async () => {
    if (!cursor) return;
    try {
      const page = await api<NotificationPage>(
        `/me/notifications?cursor=${encodeURIComponent(cursor)}`,
      );
      setItems((xs) => [...xs, ...page.items.filter((n) => !xs.some((x) => x.id === n.id))]);
      setCursor(page.nextCursor);
    } catch (e) {
      toast({ tone: "danger", title: "Couldn't load more", body: (e as Error).message });
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card>
        <div className="flex items-center justify-between pr-3">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "all", label: "All", count: items.length },
              { id: "unread", label: "Unread", count: unread },
            ]}
            className="flex-1 px-3"
          />
          <Button variant="ghost" size="sm" disabled={unread === 0} onClick={readAll}>
            <CheckCheck size={15} /> Mark all read
          </Button>
        </div>
        {shown.length === 0 ? (
          <EmptyState icon={<Bell size={22} />} title="You're all caught up" />
        ) : (
          <ul className="divide-y divide-line" data-testid="live-notifications">
            {shown.map((n) => {
              const { title, body } = renderNotification(n.type, n.data, n.actorCount, lang);
              return (
                <li key={n.id}>
                  <button
                    onClick={() => {
                      setItems((xs) =>
                        xs.map((x) =>
                          x.id === n.id
                            ? { ...x, readAt: x.readAt ?? new Date().toISOString() }
                            : x,
                        ),
                      );
                      void open(n.id);
                    }}
                    className={cn(
                      "flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50",
                      !n.readAt && "bg-[var(--color-accent-50)]/60",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                        n.readAt ? "bg-slate-300" : "bg-brand-600",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{title}</span>
                      <span className="block text-sm text-slate-600">{body}</span>
                      <span className="mt-0.5 block text-[11px] text-muted">
                        {formatDate(n.updatedAt, lang, true)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {cursor && (
          <div className="border-t border-line p-3 text-center">
            <Button variant="ghost" size="sm" onClick={more}>
              Load older
            </Button>
          </div>
        )}
      </Card>
      <NotificationPreferences />
    </div>
  );
}

function NotificationPreferences() {
  const toast = useToast();
  const [prefs, setPrefs] = useState<Partial<Record<Category, CategoryPref>> | null>(null);
  const [push, setPush] = useState(false);
  useEffect(() => {
    let live = true;
    void Promise.all([
      api<{ categories: Partial<Record<Category, CategoryPref>> }>("/me/notification-preferences"),
      api<{ enabled: boolean }>("/push/config"),
    ])
      .then(([p, c]) => {
        if (!live) return;
        setPrefs(p.categories);
        setPush(c.enabled);
      })
      .catch(() => live && setPrefs({}));
    return () => {
      live = false;
    };
  }, []);

  const save = async (id: Category, patch: Partial<CategoryPref>) => {
    if (!prefs) return;
    const before = prefs;
    // The API replaces the whole category map, so always send all four.
    const next = Object.fromEntries(
      CATEGORIES.map((c) => [
        c.id,
        { ...DEFAULT_PREF, ...prefs[c.id], ...(c.id === id ? patch : {}) },
      ]),
    ) as Record<Category, CategoryPref>;
    setPrefs(next);
    try {
      await api("/me/notification-preferences", {
        method: "PUT",
        body: JSON.stringify({ categories: next }),
      });
    } catch (e) {
      setPrefs(before);
      toast({ tone: "danger", title: "Not saved", body: (e as Error).message });
    }
  };

  return (
    <Card className="h-fit p-5">
      <p className="mb-3 font-bold">Delivery preferences</p>
      {!prefs ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <ul className="space-y-3 text-sm">
          {CATEGORIES.map((c) => {
            const p = { ...DEFAULT_PREF, ...prefs[c.id] };
            return (
              <li key={c.id} className="flex items-center justify-between gap-2">
                <span>{c.label}</span>
                <span className="flex gap-3 text-xs">
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      data-testid={`pref-${c.id}`}
                      checked={p.enabled}
                      onChange={(e) => save(c.id, { enabled: e.target.checked })}
                      className="accent-[var(--color-accent)]"
                    />
                    In-app
                  </label>
                  {push && (
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={p.enabled && p.push}
                        disabled={!p.enabled}
                        onChange={(e) => save(c.id, { push: e.target.checked })}
                        className="accent-[var(--color-accent)]"
                      />
                      Push
                    </label>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-muted">
        Role changes and guardian link changes always arrive, whatever you choose here.
        {push ? "" : " Push is not set up on this server yet."} Email and SMS need a provider and
        are not configured.
      </p>
    </Card>
  );
}
