"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDate, formatMoney, ORDER_GROUPS, type Order } from "@edukhata/contracts";
import { Badge } from "@/components/ui";
import { Countdown, DataTable, Tabs, type Column } from "@/components/ui/client";
import { useT } from "@/lib/i18n/client";
import { ORDER_STATUS, subjectName, WORK_TYPE } from "@/lib/labels";

type Group = keyof typeof ORDER_GROUPS;
const ACTIVE = new Set(["assigned", "in_progress", "revision_requested", "matching"]);

export function OrderStatusBadge({ status }: { status: Order["status"] }) {
  const s = ORDER_STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

/**
 * Orders list with status tabs. `base` is the detail route prefix for the viewer
 * (e.g. /student/orders); `view` controls which party column is shown.
 */
export function OrdersTable({
  orders,
  base,
  view,
  tabs = true,
  pageSize = 8,
}: {
  orders: Order[];
  base: string;
  view: "student" | "mentor" | "staff";
  tabs?: boolean;
  pageSize?: number;
}) {
  const { lang } = useT();
  const router = useRouter();
  const [group, setGroup] = useState<Group>("all");
  const rows = orders.filter(
    (o) => !ORDER_GROUPS[group] || ORDER_GROUPS[group]!.includes(o.status),
  );
  const count = (g: Group) =>
    orders.filter((o) => !ORDER_GROUPS[g] || ORDER_GROUPS[g]!.includes(o.status)).length;

  const columns: Column<Order>[] = [
    {
      key: "order",
      header: "Order",
      cell: (o) => (
        <Link
          href={`${base}/${o.id}`}
          className="block min-w-0"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="block max-w-xs truncate font-semibold text-ink hover:text-[var(--color-accent,var(--color-brand-600))]">
            {o.title}
          </span>
          <span className="text-[11px] text-muted">
            {o.code} · {subjectName(o.subject, lang)} · {WORK_TYPE[o.workType]}
          </span>
        </Link>
      ),
      sort: (o) => o.code,
    },
    ...(view !== "student"
      ? [
          {
            key: "student",
            header: "Student",
            cell: (o: Order) => o.studentName,
            sort: (o: Order) => o.studentName,
            hideOnMobile: true,
          },
        ]
      : []),
    ...(view !== "mentor"
      ? [
          {
            key: "mentor",
            header: "Mentor",
            cell: (o: Order) => o.mentorName ?? <span className="text-muted">—</span>,
            sort: (o: Order) => o.mentorName ?? "",
          },
        ]
      : []),
    {
      key: "status",
      header: "Status",
      cell: (o) => <OrderStatusBadge status={o.status} />,
      sort: (o) => o.status,
    },
    {
      key: "deadline",
      header: "Deadline",
      cell: (o) =>
        ACTIVE.has(o.status) ? (
          <Countdown deadline={o.deadline} compact />
        ) : (
          <span className="text-xs text-muted">{formatDate(o.deadline, lang)}</span>
        ),
      sort: (o) => o.deadline,
    },
    {
      key: "price",
      header: view === "mentor" ? "Your share" : "Amount",
      cell: (o) => (
        <span className="font-semibold">
          {formatMoney(
            view === "mentor"
              ? (o.payout ?? {
                  ...o.price,
                  amountMinor: Math.round(o.price.amountMinor * (1 - o.commissionRate)),
                })
              : o.price,
            lang,
          )}
        </span>
      ),
      sort: (o) => o.price.amountMinor,
      className: "text-right",
    },
  ];

  return (
    <div>
      {tabs && (
        <Tabs
          className="px-3"
          value={group}
          onChange={setGroup}
          tabs={(["all", "pending", "processing", "completed", "cancelled"] as Group[]).map(
            (g) => ({ id: g, label: g[0]!.toUpperCase() + g.slice(1), count: count(g) }),
          )}
        />
      )}
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(o) => o.id}
        searchText={(o) => `${o.code} ${o.title} ${o.studentName} ${o.mentorName ?? ""}`}
        pageSize={pageSize}
        onRowClick={(o) => router.push(`${base}/${o.id}`)}
        empty={{ title: "No orders here", body: "Orders in this status will appear here." }}
      />
    </div>
  );
}
