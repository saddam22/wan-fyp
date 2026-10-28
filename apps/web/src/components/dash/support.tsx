"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowUpCircle, CheckCircle2, Send } from "lucide-react";
import {
  formatDate,
  mockApi,
  ROLE_LABEL,
  type Ticket,
  type TicketPriority,
  type TicketStatus,
} from "@edukhata/contracts";
import { Avatar, Badge, Button, Card, CardHeader, KeyValue, PageHeader } from "@/components/ui";
import { DataTable, useToast } from "@/components/ui/client";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { PRIORITY, TICKET_STATUS } from "@/lib/labels";

export function TicketQueue({ tickets }: { tickets: Ticket[] }) {
  const { lang } = useT();
  const router = useRouter();
  return (
    <Card>
      <DataTable
        rows={tickets}
        rowKey={(t) => t.id}
        onRowClick={(t) => router.push(`/support-desk/tickets/${t.id}`)}
        searchText={(t) => `${t.code} ${t.subject} ${t.requester} ${t.orderCode ?? ""}`}
        filters={{
          label: "Status",
          options: Object.entries(TICKET_STATUS).map(([value, v]) => ({ value, label: v.label })),
          test: (t, v) => t.status === v,
        }}
        empty={{ title: "No tickets" }}
        columns={[
          {
            key: "s",
            header: "Ticket",
            cell: (t) => (
              <Link href={`/support-desk/tickets/${t.id}`} onClick={(e) => e.stopPropagation()}>
                <span className="block font-semibold hover:text-[var(--color-accent)]">
                  {t.subject}
                </span>
                <span className="text-[11px] text-muted">
                  {t.code}
                  {t.orderCode && ` · ${t.orderCode}`}
                </span>
              </Link>
            ),
          },
          {
            key: "r",
            header: "Requester",
            cell: (t) => (
              <span>
                {t.requester} <Badge>{ROLE_LABEL[t.requesterRole]}</Badge>
              </span>
            ),
            sort: (t) => t.requester,
          },
          {
            key: "c",
            header: "Category",
            cell: (t) => <span className="capitalize">{t.category}</span>,
          },
          {
            key: "p",
            header: "Priority",
            cell: (t) => (
              <Badge tone={PRIORITY[t.priority].tone}>{PRIORITY[t.priority].label}</Badge>
            ),
            sort: (t) => ["low", "normal", "high", "urgent"].indexOf(t.priority),
          },
          {
            key: "st",
            header: "Status",
            cell: (t) => (
              <Badge tone={TICKET_STATUS[t.status].tone}>{TICKET_STATUS[t.status].label}</Badge>
            ),
          },
          {
            key: "a",
            header: "Assignee",
            cell: (t) => t.assignee ?? <span className="text-muted">Unassigned</span>,
          },
          {
            key: "u",
            header: "Updated",
            cell: (t) => formatDate(t.updatedAt, lang, true),
            sort: (t) => t.updatedAt,
          },
        ]}
      />
    </Card>
  );
}

export function TicketDetail({ ticket }: { ticket: Ticket }) {
  const { lang } = useT();
  const toast = useToast();
  const [t, setT] = useState(ticket);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const update = (patch: Partial<Ticket>, msg: string) => (
    setT((x) => ({ ...x, ...patch, updatedAt: new Date().toISOString() })),
    toast({ tone: "success", title: msg, body: "Demo only — not saved." })
  );
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Tickets", href: "/support-desk/tickets" }, { label: t.code }]}
        title={t.subject}
        sub={
          <span className="flex flex-wrap gap-2">
            <Badge tone={TICKET_STATUS[t.status].tone}>{TICKET_STATUS[t.status].label}</Badge>
            <Badge tone={PRIORITY[t.priority].tone}>{PRIORITY[t.priority].label}</Badge>
          </span>
        }
        actions={
          <>
            {t.status !== "escalated" && (
              <Button
                variant="outline"
                onClick={() =>
                  update({ status: "escalated", assignee: "Admin team" }, "Escalated to admin")
                }
              >
                <ArrowUpCircle size={16} /> Escalate
              </Button>
            )}
            {t.status !== "resolved" && (
              <Button
                variant="success"
                onClick={() => update({ status: "resolved" }, "Ticket resolved")}
              >
                <CheckCircle2 size={16} /> Resolve
              </Button>
            )}
          </>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="flex flex-col">
          <ul className="flex-1 space-y-4 p-5">
            {t.messages.map((m, i) => (
              <li
                key={i}
                className={cn(
                  "flex gap-3",
                  m.role === "supporter" && "flex-row-reverse text-right",
                )}
              >
                <Avatar name={m.from} hue={m.role === "supporter" ? 20 : 210} size={34} />
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                    m.role === "supporter" ? "bg-[var(--color-accent-50)]" : "bg-slate-50",
                  )}
                >
                  <p className="text-xs font-semibold">
                    {m.from} ·{" "}
                    <span className="font-normal text-muted">{formatDate(m.at, lang, true)}</span>
                  </p>
                  <p className="mt-1 text-left">{m.text}</p>
                </div>
              </li>
            ))}
          </ul>
          <form
            className="space-y-2 border-t border-line p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!reply.trim()) return;
              setT((x) => ({
                ...x,
                status: internal ? x.status : "pending",
                messages: [
                  ...x.messages,
                  {
                    from: internal ? "Internal note" : "Support — Joya",
                    role: "supporter",
                    at: new Date().toISOString(),
                    text: reply,
                  },
                ],
              }));
              setReply("");
            }}
          >
            <textarea
              rows={3}
              className={cn("input", internal && "bg-amber-50")}
              placeholder={
                internal ? "Internal note (not visible to requester)…" : "Reply to requester…"
              }
              aria-label="Reply"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={internal}
                  onChange={(e) => setInternal(e.target.checked)}
                  className="accent-[var(--color-accent)]"
                />{" "}
                Internal note
              </label>
              <Button type="submit" variant="accent" disabled={!reply.trim()}>
                <Send size={15} /> Send
              </Button>
            </div>
          </form>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Details" />
            <div className="space-y-4 p-5">
              <KeyValue
                items={[
                  ["Requester", `${t.requester} (${ROLE_LABEL[t.requesterRole]})`],
                  ["Category", t.category],
                  ["Opened", formatDate(t.createdAt, lang, true)],
                  ["Assignee", t.assignee ?? "Unassigned"],
                ]}
              />
              <label className="block space-y-1 text-sm">
                <span className="text-xs text-muted">Priority</span>
                <select
                  className="input"
                  value={t.priority}
                  onChange={(e) =>
                    update({ priority: e.target.value as TicketPriority }, "Priority updated")
                  }
                >
                  {Object.entries(PRIORITY).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-xs text-muted">Status</span>
                <select
                  className="input"
                  value={t.status}
                  onChange={(e) =>
                    update({ status: e.target.value as TicketStatus }, "Status updated")
                  }
                >
                  {Object.entries(TICKET_STATUS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </label>
              {!t.assignee && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => update({ assignee: "Support — Joya" }, "Assigned to you")}
                >
                  Assign to me
                </Button>
              )}
            </div>
          </Card>
          {t.orderCode && (
            <Card className="p-5 text-sm">
              <p className="font-bold">Related order</p>
              {mockApi.order(t.orderCode) ? (
                <Link
                  href={`/support-desk/orders/${mockApi.order(t.orderCode)!.id}`}
                  className="mt-1 inline-block font-semibold text-[var(--color-accent)] hover:underline"
                >
                  {t.orderCode} →
                </Link>
              ) : (
                <p className="mt-1 font-semibold">
                  {t.orderCode}{" "}
                  <span className="text-xs font-normal text-muted">(not in demo data)</span>
                </p>
              )}
              <p className="mt-1 text-xs text-muted">
                Read-only. Refunds and reassignment are done by admins.
              </p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
