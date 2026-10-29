"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { formatDate, type Ticket } from "@edukhata/contracts";
import { Badge, Button, Card, Field } from "@/components/ui";
import { DataTable, Modal, useToast, type Column } from "@/components/ui/client";
import { useT } from "@/lib/i18n/client";
import { PRIORITY, TICKET_STATUS } from "@/lib/labels";

/** Requester view of support tickets (students, mentors, guardians). */
export function SupportTickets({
  tickets: initial,
  orderCodes,
}: {
  tickets: Ticket[];
  orderCodes: string[];
}) {
  const { lang } = useT();
  const toast = useToast();
  const [tickets, setTickets] = useState(initial);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    subject: "",
    category: "order" as Ticket["category"],
    orderCode: "",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [view, setView] = useState<Ticket | null>(null);
  const columns: Column<Ticket>[] = [
    {
      key: "s",
      header: "Ticket",
      cell: (t) => (
        <span>
          <span className="block font-semibold">{t.subject}</span>
          <span className="text-[11px] text-muted">
            {t.code}
            {t.orderCode && ` · ${t.orderCode}`}
          </span>
        </span>
      ),
    },
    { key: "c", header: "Category", cell: (t) => <span className="capitalize">{t.category}</span> },
    {
      key: "st",
      header: "Status",
      cell: (t) => (
        <Badge tone={TICKET_STATUS[t.status].tone}>{TICKET_STATUS[t.status].label}</Badge>
      ),
    },
    {
      key: "u",
      header: "Updated",
      cell: (t) => formatDate(t.updatedAt, lang, true),
      sort: (t) => t.updatedAt,
    },
  ];
  return (
    <Card>
      <DataTable
        rows={tickets}
        columns={columns}
        rowKey={(t) => t.id}
        searchText={(t) => `${t.code} ${t.subject}`}
        onRowClick={setView}
        toolbar={
          <Button variant="accent" onClick={() => setOpen(true)}>
            <Plus size={16} /> New ticket
          </Button>
        }
        empty={{ title: "No tickets", body: "Need help? Open a ticket and our team will reply." }}
      />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Open a support ticket"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              onClick={() => {
                const er: Record<string, string> = {};
                if (f.subject.trim().length < 5) er.subject = "Add a short subject";
                if (f.message.trim().length < 15)
                  er.message = "Describe the issue (at least 15 characters)";
                setErrors(er);
                if (Object.keys(er).length) return;
                const now = new Date().toISOString();
                setTickets((ts) => [
                  {
                    id: `new-${ts.length}`,
                    code: `TCK-${3022 + ts.length}`,
                    subject: f.subject,
                    category: f.category,
                    requester: "You",
                    requesterRole: "student",
                    orderCode: f.orderCode || undefined,
                    status: "open",
                    priority: "normal",
                    createdAt: now,
                    updatedAt: now,
                    messages: [{ from: "You", role: "student", at: now, text: f.message }],
                  } as Ticket,
                  ...ts,
                ]);
                setOpen(false);
                setF({ subject: "", category: "order", orderCode: "", message: "" });
                toast({ tone: "success", title: "Ticket created", body: "Demo only — not saved." });
              }}
            >
              Submit
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Subject" required htmlFor="t-s" error={errors.subject}>
            <input
              id="t-s"
              className="input"
              value={f.subject}
              onChange={(e) => setF({ ...f, subject: e.target.value })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" htmlFor="t-c">
              <select
                id="t-c"
                className="input"
                value={f.category}
                onChange={(e) => setF({ ...f, category: e.target.value as Ticket["category"] })}
              >
                {["order", "payment", "account", "mentor", "technical", "complaint"].map((c) => (
                  <option key={c} value={c}>
                    {c[0]!.toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Related order" htmlFor="t-o">
              <select
                id="t-o"
                className="input"
                value={f.orderCode}
                onChange={(e) => setF({ ...f, orderCode: e.target.value })}
              >
                <option value="">None</option>
                {orderCodes.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Message" required htmlFor="t-m" error={errors.message}>
            <textarea
              id="t-m"
              rows={4}
              className="input"
              value={f.message}
              onChange={(e) => setF({ ...f, message: e.target.value })}
            />
          </Field>
        </div>
      </Modal>
      <Modal
        open={!!view}
        onClose={() => setView(null)}
        title={view ? `${view.code} · ${view.subject}` : ""}
        size="lg"
      >
        {view && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge tone={TICKET_STATUS[view.status].tone}>
                {TICKET_STATUS[view.status].label}
              </Badge>
              <Badge tone={PRIORITY[view.priority].tone}>{PRIORITY[view.priority].label}</Badge>
            </div>
            {view.messages.map((m, i) => (
              <div key={i} className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="text-xs font-semibold">
                  {m.from} ·{" "}
                  <span className="font-normal text-muted">{formatDate(m.at, lang, true)}</span>
                </p>
                <p className="mt-1">{m.text}</p>
              </div>
            ))}
            <textarea rows={3} className="input" placeholder="Reply…" aria-label="Reply" />
            <Button
              variant="accent"
              onClick={() =>
                toast({ tone: "success", title: "Reply sent", body: "Demo only — not saved." })
              }
            >
              Send reply
            </Button>
          </div>
        )}
      </Modal>
    </Card>
  );
}
