"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { formatDate, type NotificationItem } from "@edukhata/contracts";
import { Button, Card, EmptyState } from "@/components/ui";
import { Tabs } from "@/components/ui/client";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";

const DOT = {
  info: "bg-brand-600",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

export function NotificationsList({
  items: initial,
  showPrefs = true,
}: {
  items: NotificationItem[];
  showPrefs?: boolean;
}) {
  const { lang } = useT();
  const [items, setItems] = useState(initial);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const shown = items.filter((n) => tab === "all" || !n.read);
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card>
        <div className="flex items-center justify-between pr-3">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "all", label: "All", count: items.length },
              { id: "unread", label: "Unread", count: items.filter((n) => !n.read).length },
            ]}
            className="flex-1 px-3"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setItems((xs) => xs.map((x) => ({ ...x, read: true })))}
          >
            <CheckCheck size={15} /> Mark all read
          </Button>
        </div>
        {shown.length === 0 ? (
          <EmptyState icon={<Bell size={22} />} title="You're all caught up" />
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((n) => (
              <li
                key={n.id}
                className={cn("flex gap-3 px-4 py-3", !n.read && "bg-[var(--color-accent-50)]/60")}
              >
                <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", DOT[n.tone])} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{n.title}</p>
                  <p className="text-sm text-slate-600">{n.body}</p>
                  <p className="mt-0.5 text-[11px] text-muted">{formatDate(n.at, lang, true)}</p>
                </div>
                {n.href && (
                  <Link
                    href={n.href}
                    onClick={() =>
                      setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
                    }
                    className="self-center text-xs font-semibold text-[var(--color-accent)] hover:underline"
                  >
                    Open
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {showPrefs && (
        <Card className="h-fit p-5">
          <p className="mb-3 font-bold">Delivery preferences</p>
          <ul className="space-y-3 text-sm">
            {[
              ["Order updates", true, true],
              ["Payments", true, true],
              ["Deadline reminders", true, false],
              ["Chat messages", true, false],
              ["Offers & news", false, false],
            ].map(([label, push, mandatory]) => (
              <li key={label as string} className="flex items-center justify-between gap-2">
                <span>
                  {label as string}
                  {mandatory && <span className="ml-1 text-[10px] text-muted">(required)</span>}
                </span>
                <span className="flex gap-3 text-xs">
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      defaultChecked={push as boolean}
                      disabled={mandatory as boolean}
                      className="accent-[var(--color-accent)]"
                    />{" "}
                    Push
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="accent-[var(--color-accent)]"
                      disabled={mandatory as boolean}
                    />{" "}
                    Email
                  </label>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-muted">
            Delivered by the WAN social module (push) and an email provider (to be chosen). SMS
            needs a provider — not configured.
          </p>
        </Card>
      )}
    </div>
  );
}
