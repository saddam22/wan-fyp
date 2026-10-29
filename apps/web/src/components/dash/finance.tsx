"use client";

import { useState } from "react";
import { CheckCircle2, Download, Eye, Paperclip, ShieldAlert, XCircle } from "lucide-react";
import {
  formatDate,
  formatMoney,
  groupDigits,
  type Dispute,
  type LedgerEntry,
  type Payment,
  type Payout,
} from "@edukhata/contracts";
import { Badge, Button, Card, Field, KeyValue } from "@/components/ui";
import { DataTable, Modal, Tabs, useToast } from "@/components/ui/client";
import { useT } from "@/lib/i18n/client";
import { PAYOUT_STATUS } from "@/lib/labels";
import { METHOD_LABEL, PaymentStatusBadge } from "./PaymentsTable";

/** Amounts at or above this need a second approver (maker-checker). Configurable in Phase 5. */
const SECOND_APPROVER_MINOR = 300000;

export function PaymentVerificationQueue({ payments }: { payments: Payment[] }) {
  const { lang } = useT();
  const toast = useToast();
  const [rows, setRows] = useState(payments);
  const [tab, setTab] = useState<"queue" | "done">("queue");
  const [sel, setSel] = useState<Payment | null>(null);
  const [mode, setMode] = useState<"view" | "reject">("view");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const queue = rows.filter((p) => p.status === "submitted");
  const done = rows.filter((p) => ["approved", "rejected", "refunded"].includes(p.status));

  function decide(p: Payment, approve: boolean) {
    if (!approve && note.trim().length < 5)
      return setErr("Tell the payer why (e.g. TrxID not found in statement)");
    const needsSecond = approve && p.amount.amountMinor >= SECOND_APPROVER_MINOR;
    setRows((rs) =>
      rs.map((r) =>
        r.id === p.id
          ? {
              ...r,
              status: needsSecond ? r.status : approve ? "approved" : "rejected",
              note: approve ? r.note : note,
              decidedAt: new Date().toISOString(),
              decidedBy: "You (demo)",
            }
          : r,
      ),
    );
    toast({
      tone: approve ? "success" : "warning",
      title: needsSecond
        ? "First approval recorded — needs a second approver"
        : approve
          ? `${p.invoiceNo} approved`
          : `${p.invoiceNo} rejected`,
      body: approve
        ? "In production: payment, ledger entries and order status change in one transaction. Demo only — not saved."
        : "The payer is notified and can resubmit. Demo only — not saved.",
    });
    setSel(null);
    setNote("");
    setErr("");
  }

  return (
    <Card>
      <Tabs
        className="px-3"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "queue", label: "Awaiting verification", count: queue.length },
          { id: "done", label: "Decided", count: done.length },
        ]}
      />
      <DataTable
        rows={tab === "queue" ? queue : done}
        rowKey={(p) => p.id}
        searchText={(p) => `${p.invoiceNo} ${p.orderCode} ${p.payerName} ${p.trxId} ${p.sender}`}
        onRowClick={(p) => (setSel(p), setMode("view"))}
        empty={{ title: tab === "queue" ? "Queue is clear" : "No decisions yet" }}
        columns={[
          {
            key: "i",
            header: "Invoice",
            cell: (p) => (
              <span>
                <span className="block font-semibold">{p.invoiceNo}</span>
                <span className="text-[11px] text-muted">
                  {p.orderCode} · {p.payerName}
                </span>
              </span>
            ),
            sort: (p) => p.invoiceNo,
          },
          { key: "m", header: "Method", cell: (p) => `${METHOD_LABEL[p.method]} (${p.channel})` },
          {
            key: "s",
            header: "Sender",
            cell: (p) => <span className="font-mono text-xs">{p.sender}</span>,
          },
          {
            key: "t",
            header: "TrxID",
            cell: (p) => (
              <span className="font-mono text-xs font-semibold">
                {p.trxId}
                {p.hasProof && <Paperclip size={12} className="ml-1 inline text-muted" />}
              </span>
            ),
          },
          {
            key: "a",
            header: "Amount",
            cell: (p) => (
              <span className="font-semibold">
                {formatMoney(p.amount, lang)}
                {p.amount.amountMinor >= SECOND_APPROVER_MINOR && (
                  <Badge tone="violet" className="ml-1">
                    2 approvers
                  </Badge>
                )}
              </span>
            ),
            sort: (p) => p.amount.amountMinor,
          },
          {
            key: "w",
            header: tab === "queue" ? "Submitted" : "Decision",
            cell: (p) =>
              tab === "queue" ? (
                formatDate(p.submittedAt ?? p.createdAt, lang, true)
              ) : (
                <PaymentStatusBadge status={p.status} />
              ),
          },
        ]}
      />
      <Modal
        open={!!sel}
        onClose={() => (setSel(null), setErr(""))}
        title={sel ? `${sel.invoiceNo} · ${formatMoney(sel.amount, lang)}` : ""}
        size="lg"
        footer={
          sel?.status === "submitted" ? (
            mode === "view" ? (
              <>
                <Button variant="outline" onClick={() => setMode("reject")}>
                  <XCircle size={16} /> Reject
                </Button>
                <Button variant="success" onClick={() => decide(sel, true)}>
                  <CheckCircle2 size={16} /> Approve
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setMode("view")}>
                  Back
                </Button>
                <Button variant="danger" onClick={() => decide(sel, false)}>
                  Reject payment
                </Button>
              </>
            )
          ) : undefined
        }
      >
        {sel && (
          <div className="space-y-4">
            <KeyValue
              items={[
                ["Payer", sel.payerName],
                ["Order", sel.orderCode],
                ["Method", `${METHOD_LABEL[sel.method]} · ${sel.channel}`],
                ["Sender", sel.sender ?? "—"],
                [
                  "Transaction ID",
                  <span key="t" className="font-mono">
                    {sel.trxId}
                  </span>,
                ],
                ["Submitted", sel.submittedAt ? formatDate(sel.submittedAt, lang, true) : "—"],
              ]}
            />
            {sel.hasProof ? (
              <div className="flex h-40 items-center justify-center rounded-lg bg-slate-50 text-sm text-muted ring-1 ring-line">
                <Eye size={16} className="mr-1.5" /> Proof image (private storage, signed link —
                Phase 5)
              </div>
            ) : (
              <p className="text-xs text-muted">No screenshot attached.</p>
            )}
            <p className="flex gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
              <ShieldAlert size={15} className="shrink-0" /> Match the TrxID, sender and exact
              amount against the {METHOD_LABEL[sel.method]} statement before approving. TrxIDs are
              unique across all payments (database constraint).
            </p>
            {mode === "reject" && (
              <Field label="Reason shown to payer" required htmlFor="rj-n" error={err}>
                <textarea
                  id="rj-n"
                  rows={3}
                  className="input"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>
            )}
            {sel.note && <p className="text-sm text-muted">Note: {sel.note}</p>}
          </div>
        )}
      </Modal>
    </Card>
  );
}

export function PayoutQueue({ payouts }: { payouts: Payout[] }) {
  const { lang } = useT();
  const toast = useToast();
  const [rows, setRows] = useState(payouts);
  const [ref, setRef] = useState<{ p: Payout; v: string } | null>(null);
  const act = (p: Payout, status: Payout["status"], msg: string, reference?: string) => {
    setRows((rs) =>
      rs.map((r) =>
        r.id === p.id
          ? {
              ...r,
              status,
              decidedAt: new Date().toISOString(),
              reference: reference ?? r.reference,
            }
          : r,
      ),
    );
    toast({
      tone: "success",
      title: msg,
      body: "Demo only — not saved. Each payout request can be paid once (idempotency key).",
    });
  };
  return (
    <Card>
      <DataTable
        rows={rows}
        rowKey={(p) => p.id}
        searchText={(p) => `${p.mentorName} ${p.account} ${p.reference ?? ""}`}
        filters={{
          label: "Status",
          options: Object.entries(PAYOUT_STATUS).map(([value, v]) => ({ value, label: v.label })),
          test: (p, v) => p.status === v,
        }}
        columns={[
          {
            key: "m",
            header: "Mentor",
            cell: (p) => <span className="font-semibold">{p.mentorName}</span>,
            sort: (p) => p.mentorName,
          },
          {
            key: "a",
            header: "Amount",
            cell: (p) => <span className="font-semibold">{formatMoney(p.amount, lang)}</span>,
            sort: (p) => p.amount.amountMinor,
          },
          {
            key: "to",
            header: "To",
            cell: (p) => (
              <span className="text-xs">
                {p.method === "bank" ? "Bank" : p.method === "bkash" ? "bKash" : "Nagad"}{" "}
                {p.account}
              </span>
            ),
          },
          {
            key: "r",
            header: "Requested",
            cell: (p) => formatDate(p.requestedAt, lang),
            sort: (p) => p.requestedAt,
          },
          {
            key: "s",
            header: "Status",
            cell: (p) => (
              <span className="inline-flex flex-col items-start">
                <Badge tone={PAYOUT_STATUS[p.status].tone}>{PAYOUT_STATUS[p.status].label}</Badge>
                {p.reference && <span className="text-[11px] text-muted">{p.reference}</span>}
              </span>
            ),
          },
          {
            key: "x",
            header: "",
            cell: (p) =>
              p.status === "requested" ? (
                <span className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="success"
                    onClick={() => act(p, "approved", "Payout approved")}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => act(p, "rejected", "Payout rejected")}
                  >
                    Reject
                  </Button>
                </span>
              ) : p.status === "approved" ? (
                <Button size="sm" variant="accent" onClick={() => setRef({ p, v: "" })}>
                  Mark paid
                </Button>
              ) : null,
          },
        ]}
      />
      <Modal
        open={!!ref}
        onClose={() => setRef(null)}
        title={`Mark payout to ${ref?.p.mentorName} as paid`}
        footer={
          <>
            <Button variant="outline" onClick={() => setRef(null)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              disabled={(ref?.v.trim().length ?? 0) < 4}
              onClick={() => (
                act(ref!.p, "paid", "Payout marked paid", ref!.v.trim().toUpperCase()),
                setRef(null)
              )}
            >
              Confirm
            </Button>
          </>
        }
      >
        <Field
          label="Transfer reference"
          required
          htmlFor="po-ref"
          hint="The bKash/Nagad TrxID or bank reference of the money you sent."
        >
          <input
            id="po-ref"
            className="input font-mono uppercase"
            value={ref?.v ?? ""}
            onChange={(e) => ref && setRef({ ...ref, v: e.target.value })}
          />
        </Field>
      </Modal>
    </Card>
  );
}

export function LedgerTable({ entries }: { entries: LedgerEntry[] }) {
  const { lang } = useT();
  const toast = useToast();
  const debit = entries.reduce((s, e) => s + e.debitMinor, 0);
  const credit = entries.reduce((s, e) => s + e.creditMinor, 0);
  const m = (x: number) => (x ? `৳${groupDigits(x / 100)}` : "");
  return (
    <Card>
      <DataTable
        rows={entries}
        rowKey={(e) => e.id}
        pageSize={12}
        searchText={(e) => `${e.txId} ${e.account} ${e.memo}`}
        filters={{
          label: "Account",
          options: ["cash", "liability", "revenue"].map((v) => ({ value: v, label: v })),
          test: (e, v) => e.account.startsWith(v),
        }}
        toolbar={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              toast({
                tone: "info",
                title: "CSV export",
                body: "Generated server-side in Phase 5.",
              })
            }
          >
            <Download size={14} /> CSV
          </Button>
        }
        columns={[
          {
            key: "d",
            header: "Date",
            cell: (e) => formatDate(e.at, lang, true),
            sort: (e) => e.at,
          },
          {
            key: "t",
            header: "Tx",
            cell: (e) => <span className="font-mono text-xs">{e.txId}</span>,
            sort: (e) => e.txId,
          },
          {
            key: "a",
            header: "Account",
            cell: (e) => <span className="font-mono text-xs">{e.account}</span>,
          },
          { key: "m", header: "Memo", cell: (e) => e.memo },
          {
            key: "dr",
            header: "Debit",
            cell: (e) => <span className="tabular-nums">{m(e.debitMinor)}</span>,
            className: "text-right",
          },
          {
            key: "cr",
            header: "Credit",
            cell: (e) => <span className="tabular-nums">{m(e.creditMinor)}</span>,
            className: "text-right",
          },
        ]}
      />
      <div className="flex flex-wrap items-center justify-end gap-4 border-t border-line px-4 py-3 text-sm">
        <span>
          Debits <b className="tabular-nums">{m(debit)}</b>
        </span>
        <span>
          Credits <b className="tabular-nums">{m(credit)}</b>
        </span>
        <Badge tone={debit === credit ? "green" : "red"}>
          {debit === credit ? "Balanced" : "Out of balance"}
        </Badge>
      </div>
    </Card>
  );
}

export function RefundsTable({ disputes }: { disputes: Dispute[] }) {
  const { lang } = useT();
  const toast = useToast();
  const LABEL: Record<Dispute["status"], [string, "amber" | "red" | "green" | "gray" | "blue"]> = {
    open: ["Open", "amber"],
    under_review: ["Under review", "blue"],
    resolved_refund: ["Full refund", "red"],
    resolved_release: ["Released to mentor", "green"],
    resolved_partial: ["Partial refund", "amber"],
  };
  return (
    <Card>
      <DataTable
        rows={disputes}
        rowKey={(d) => d.id}
        searchText={(d) => `${d.orderCode} ${d.openedBy} ${d.reason}`}
        columns={[
          {
            key: "o",
            header: "Order",
            cell: (d) => (
              <span>
                <span className="block font-semibold">{d.orderCode}</span>
                <span className="text-[11px] text-muted">{d.openedBy}</span>
              </span>
            ),
          },
          { key: "r", header: "Reason", cell: (d) => d.reason },
          { key: "a", header: "Amount", cell: (d) => formatMoney(d.amount, lang) },
          {
            key: "d",
            header: "Opened",
            cell: (d) => formatDate(d.openedAt, lang),
            sort: (d) => d.openedAt,
          },
          {
            key: "s",
            header: "Status",
            cell: (d) => <Badge tone={LABEL[d.status][1]}>{LABEL[d.status][0]}</Badge>,
          },
          {
            key: "x",
            header: "",
            cell: (d) =>
              d.status.startsWith("resolved_") && d.status !== "resolved_release" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    toast({
                      tone: "success",
                      title: `Refund for ${d.orderCode} marked as sent`,
                      body: "Demo only — not saved.",
                    })
                  }
                >
                  Record refund
                </Button>
              ) : null,
          },
        ]}
      />
    </Card>
  );
}
