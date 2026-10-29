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
import { orderApi } from "@/lib/order-api";
import { METHOD_LABEL, PaymentStatusBadge } from "./PaymentsTable";

/** Amounts at or above this need a second approver (maker-checker). Configurable in Phase 5. */
const SECOND_APPROVER_MINOR = 300000;

/**
 * Verification queue. Demo: local state only. Live: each decision goes to the API, which
 * changes the payment, the ledger and the order in one transaction.
 */
export function PaymentVerificationQueue({
  payments,
  live,
}: {
  payments: Payment[];
  live?: boolean;
}) {
  const { lang } = useT();
  const toast = useToast();
  const [rows, setRows] = useState(payments);
  const [tab, setTab] = useState<"queue" | "done">("queue");
  const [sel, setSel] = useState<Payment | null>(null);
  const [mode, setMode] = useState<"view" | "reject">("view");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const queue = rows.filter((p) => p.status === "submitted");
  const done = rows.filter((p) => ["approved", "rejected", "refunded"].includes(p.status));

  async function decide(p: Payment, approve: boolean) {
    if (!approve && note.trim().length < 5)
      return setErr("Tell the payer why (e.g. TrxID not found in statement)");
    if (live) {
      setBusy(true);
      try {
        const updated = await orderApi<Payment>(`/accountant/payments/${p.id}/decision`, "POST", {
          approve,
          note: note.trim(),
        });
        setRows((rs) => rs.map((r) => (r.id === p.id ? updated : r)));
        toast({
          tone: approve ? "success" : "warning",
          title: approve ? `${p.invoiceNo} approved` : `${p.invoiceNo} rejected`,
          body: approve
            ? "The money is recorded in the ledger and the order moves on."
            : "The payer is told why and can submit again.",
        });
        setSel(null);
        setNote("");
        setErr("");
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setBusy(false);
      }
      return;
    }
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
                {!live && p.amount.amountMinor >= SECOND_APPROVER_MINOR && (
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
                <Button variant="outline" disabled={busy} onClick={() => setMode("reject")}>
                  <XCircle size={16} /> Reject
                </Button>
                <Button variant="success" disabled={busy} onClick={() => decide(sel, true)}>
                  <CheckCircle2 size={16} /> Approve
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setMode("view")}>
                  Back
                </Button>
                <Button variant="danger" disabled={busy} onClick={() => decide(sel, false)}>
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
            {sel.hasProof && live ? (
              <a
                href={`/api/payments/${sel.id}/proof`}
                target="_blank"
                rel="noreferrer"
                className="flex h-16 items-center justify-center rounded-lg bg-slate-50 text-sm font-semibold text-[var(--color-accent)] ring-1 ring-line"
              >
                <Eye size={16} className="mr-1.5" /> Open the payer&apos;s proof
              </a>
            ) : sel.hasProof ? (
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
            {err && mode === "view" && <p className="text-sm text-danger">{err}</p>}
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

/** A receiving/sending account of EduKhata (for "money left from"). */
export interface CashAccount {
  key: string;
  name: string;
  number: string;
}

/**
 * Payout requests. Live: approve → a second person sends the money and records the
 * transfer reference (the API refuses the approver and the mentor themself).
 */
export function PayoutQueue({
  payouts,
  live,
  accounts = [],
}: {
  payouts: Payout[];
  live?: boolean;
  accounts?: CashAccount[];
}) {
  const { lang } = useT();
  const toast = useToast();
  const [rows, setRows] = useState(payouts);
  const [ref, setRef] = useState<{ p: Payout; v: string; from: string } | null>(null);
  const [rej, setRej] = useState<{ p: Payout; v: string } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const call = async (p: Payout, path: string, body: object, msg: string) => {
    setBusy(true);
    setErr("");
    try {
      const u = await orderApi<Payout>(`/accountant/payouts/${p.id}/${path}`, "POST", body);
      setRows((rs) => rs.map((r) => (r.id === p.id ? u : r)));
      toast({ tone: "success", title: msg });
      setRef(null);
      setRej(null);
    } catch (e) {
      const m = (e as Error).message;
      setErr(m);
      if (path === "approve") toast({ tone: "warning", title: m });
    } finally {
      setBusy(false);
    }
  };
  const act = (p: Payout, status: Payout["status"], msg: string, reference?: string) => {
    if (live) {
      if (status === "approved") return call(p, "approve", {}, msg);
      if (status === "rejected") return setRej({ p, v: "" });
      return call(p, "paid", { fromAccountId: ref?.from ?? "", reference: reference ?? "" }, msg);
    }
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
                {METHOD_LABEL[p.method]} {p.account}
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
                <span className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="accent"
                    onClick={() => setRef({ p, v: "", from: accounts[0]?.key ?? "" })}
                  >
                    Mark paid
                  </Button>
                  {live && (
                    <Button size="sm" variant="outline" onClick={() => setRej({ p, v: "" })}>
                      Reject
                    </Button>
                  )}
                </span>
              ) : null,
          },
        ]}
      />
      <Modal
        open={!!rej}
        onClose={() => (setRej(null), setErr(""))}
        title={`Reject payout to ${rej?.p.mentorName}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setRej(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busy || (rej?.v.trim().length ?? 0) < 3}
              onClick={() =>
                call(rej!.p, "reject", { note: rej!.v.trim() }, "Payout rejected, balance returned")
              }
            >
              Reject payout
            </Button>
          </>
        }
      >
        <Field
          label="Reason shown to the mentor"
          required
          htmlFor="po-rj"
          error={err}
          hint="The amount goes back to their available balance."
        >
          <textarea
            id="po-rj"
            rows={3}
            className="input"
            value={rej?.v ?? ""}
            onChange={(e) => rej && setRej({ ...rej, v: e.target.value })}
          />
        </Field>
      </Modal>
      <Modal
        open={!!ref}
        onClose={() => (setRef(null), setErr(""))}
        title={`Mark payout to ${ref?.p.mentorName} as paid`}
        footer={
          <>
            <Button variant="outline" onClick={() => setRef(null)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              disabled={busy || (ref?.v.trim().length ?? 0) < 4 || (live && !ref?.from)}
              onClick={() => {
                act(ref!.p, "paid", "Payout marked paid", ref!.v.trim().toUpperCase());
                if (!live) setRef(null);
              }}
            >
              Confirm
            </Button>
          </>
        }
      >
        {live && (
          <div className="mb-4">
            <Field label="Sent from" required htmlFor="po-from">
              <select
                id="po-from"
                className="input"
                value={ref?.from ?? ""}
                onChange={(e) => ref && setRef({ ...ref, from: e.target.value })}
              >
                {accounts.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.name} ({a.number})
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
        <Field
          label="Transfer reference"
          required
          htmlFor="po-ref"
          error={ref ? err : ""}
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

/** A refund as the API returns it (decided in a dispute or cancellation). */
export interface LiveRefund {
  id: string;
  orderId: string;
  orderCode: string;
  studentName: string | null;
  amount: { amountMinor: number; currency: "BDT" };
  source: "cancellation" | "dispute";
  reason: string;
  to: { method: Payment["method"]; number: string | null } | null;
  status: "requested" | "approved" | "paid";
  requestedBy: string | null;
  approvedBy: string | null;
  paidBy: string | null;
  reference: string | null;
  createdAt: string;
  paidAt: string | null;
}

const REFUND_STATUS: Record<LiveRefund["status"], [string, "amber" | "blue" | "green"]> = {
  requested: ["Needs approval", "amber"],
  approved: ["Approved — send it", "blue"],
  paid: ["Sent", "green"],
};

/** Refunds: a second person approves, then someone records the transfer back. */
export function LiveRefundsTable({
  refunds,
  accounts,
}: {
  refunds: LiveRefund[];
  accounts: CashAccount[];
}) {
  const { lang } = useT();
  const toast = useToast();
  const [rows, setRows] = useState(refunds);
  const [pay, setPay] = useState<{ r: LiveRefund; v: string; from: string } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const call = async (r: LiveRefund, path: string, body: object, msg: string) => {
    setBusy(true);
    setErr("");
    try {
      const u = await orderApi<LiveRefund>(`/accountant/refunds/${r.id}/${path}`, "POST", body);
      setRows((rs) => rs.map((x) => (x.id === r.id ? u : x)));
      toast({ tone: "success", title: msg });
      setPay(null);
    } catch (e) {
      const m = (e as Error).message;
      if (path === "paid") setErr(m);
      else toast({ tone: "warning", title: m });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        searchText={(r) => `${r.orderCode} ${r.studentName ?? ""} ${r.reason} ${r.reference ?? ""}`}
        filters={{
          label: "Status",
          options: Object.entries(REFUND_STATUS).map(([value, v]) => ({ value, label: v[0] })),
          test: (r, v) => r.status === v,
        }}
        empty={{ title: "No refunds" }}
        columns={[
          {
            key: "o",
            header: "Order",
            cell: (r) => (
              <span>
                <span className="block font-semibold">{r.orderCode}</span>
                <span className="text-[11px] text-muted">
                  {r.studentName} · {r.source}
                </span>
              </span>
            ),
          },
          { key: "r", header: "Reason", cell: (r) => r.reason },
          {
            key: "to",
            header: "Send to",
            cell: (r) =>
              r.to ? (
                <span className="text-xs">
                  {METHOD_LABEL[r.to.method]} <span className="font-mono">{r.to.number}</span>
                </span>
              ) : (
                "—"
              ),
          },
          {
            key: "a",
            header: "Amount",
            cell: (r) => <span className="font-semibold">{formatMoney(r.amount, lang)}</span>,
            sort: (r) => r.amount.amountMinor,
          },
          {
            key: "s",
            header: "Status",
            cell: (r) => (
              <span className="inline-flex flex-col items-start">
                <Badge tone={REFUND_STATUS[r.status][1]}>{REFUND_STATUS[r.status][0]}</Badge>
                <span className="text-[11px] text-muted">
                  {r.reference ?? `asked by ${r.requestedBy ?? "—"}`}
                </span>
              </span>
            ),
          },
          {
            key: "x",
            header: "",
            cell: (r) =>
              r.status === "requested" ? (
                <Button
                  size="sm"
                  variant="success"
                  disabled={busy}
                  onClick={() => call(r, "approve", {}, `Refund for ${r.orderCode} approved`)}
                >
                  Approve
                </Button>
              ) : r.status === "approved" ? (
                <Button
                  size="sm"
                  variant="accent"
                  onClick={() => setPay({ r, v: "", from: accounts[0]?.key ?? "" })}
                >
                  Record transfer
                </Button>
              ) : null,
          },
        ]}
      />
      <Modal
        open={!!pay}
        onClose={() => (setPay(null), setErr(""))}
        title={`Refund ${pay ? formatMoney(pay.r.amount, lang) : ""} for ${pay?.r.orderCode}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setPay(null)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              disabled={busy || !pay?.from || (pay?.v.trim().length ?? 0) < 4}
              onClick={() =>
                call(
                  pay!.r,
                  "paid",
                  { fromAccountId: pay!.from, reference: pay!.v.trim() },
                  "Refund recorded as sent",
                )
              }
            >
              Confirm
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Sent from" required htmlFor="rf-from">
            <select
              id="rf-from"
              className="input"
              value={pay?.from ?? ""}
              onChange={(e) => pay && setPay({ ...pay, from: e.target.value })}
            >
              {accounts.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.name} ({a.number})
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Transfer reference"
            required
            htmlFor="rf-ref"
            error={err}
            hint="The TrxID or bank reference of the money you sent back."
          >
            <input
              id="rf-ref"
              className="input font-mono uppercase"
              value={pay?.v ?? ""}
              onChange={(e) => pay && setPay({ ...pay, v: e.target.value })}
            />
          </Field>
        </div>
      </Modal>
    </Card>
  );
}

export interface Reconciliation {
  from: string;
  to: string;
  accounts: {
    id: string;
    name: string;
    receivedMinor: number;
    refundsSentMinor: number;
    payoutsSentMinor: number;
    balanceMinor: number;
  }[];
  unreconciled: {
    id: string;
    invoiceNo: string;
    orderCode: string;
    amount: { amountMinor: number; currency: "BDT" };
    method: Payment["method"];
    sender: string | null;
    trxId: string | null;
    decidedAt: string | null;
  }[];
}

/** Statement check: totals per account, and approved payments still to tick off. */
export function ReconciliationPanel({ data }: { data: Reconciliation }) {
  const { lang } = useT();
  const toast = useToast();
  const [open, setOpen] = useState(data.unreconciled);
  const m = (x: number) => formatMoney({ amountMinor: x, currency: "BDT" }, lang);
  const tick = async (id: string) => {
    try {
      await orderApi(`/accountant/payments/${id}/reconcile`, "POST");
      setOpen((o) => o.filter((p) => p.id !== id));
    } catch (e) {
      toast({ tone: "warning", title: (e as Error).message });
    }
  };
  return (
    <div className="space-y-5">
      <Card>
        <DataTable
          rows={data.accounts}
          rowKey={(a) => a.id}
          empty={{ title: "No receiving accounts yet" }}
          columns={[
            { key: "n", header: "Account", cell: (a) => <b>{a.name}</b> },
            { key: "in", header: "Received", cell: (a) => m(a.receivedMinor) },
            { key: "rf", header: "Refunds sent", cell: (a) => m(a.refundsSentMinor) },
            { key: "po", header: "Payouts sent", cell: (a) => m(a.payoutsSentMinor) },
            {
              key: "b",
              header: "Book balance",
              cell: (a) => <span className="font-semibold tabular-nums">{m(a.balanceMinor)}</span>,
              className: "text-right",
            },
          ]}
        />
        <p className="border-t border-line px-4 py-3 text-xs text-muted">
          {formatDate(data.from, lang)} – {formatDate(data.to, lang)}. Compare each line with the
          provider statement for the same period.
        </p>
      </Card>
      <Card>
        <DataTable
          rows={open}
          rowKey={(p) => p.id}
          searchText={(p) => `${p.invoiceNo} ${p.orderCode} ${p.trxId ?? ""} ${p.sender ?? ""}`}
          empty={{ title: "Everything is ticked off" }}
          columns={[
            {
              key: "i",
              header: "Invoice",
              cell: (p) => (
                <span>
                  <b className="block">{p.invoiceNo}</b>
                  <span className="text-[11px] text-muted">{p.orderCode}</span>
                </span>
              ),
            },
            {
              key: "t",
              header: "TrxID",
              cell: (p) => (
                <span className="font-mono text-xs">
                  {METHOD_LABEL[p.method]} {p.trxId} · {p.sender}
                </span>
              ),
            },
            { key: "a", header: "Amount", cell: (p) => m(p.amount.amountMinor) },
            {
              key: "x",
              header: "",
              cell: (p) => (
                <Button size="sm" variant="outline" onClick={() => tick(p.id)}>
                  <CheckCircle2 size={14} /> On statement
                </Button>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}

export interface ReceivingAccount {
  key: string;
  method: Payment["method"];
  channel: Payment["channel"];
  name: string;
  number: string;
  accountName?: string;
  branch?: string;
  routing?: string;
  instructions: string[];
  enabled: boolean;
}

const BLANK: ReceivingAccount = {
  key: "",
  method: "bkash",
  channel: "personal",
  name: "",
  number: "",
  instructions: [],
  enabled: true,
};

/** The accounts students send money to (shown on the pay page while enabled). */
export function PaymentAccountsManager({ accounts }: { accounts: ReceivingAccount[] }) {
  const toast = useToast();
  const [rows, setRows] = useState(accounts);
  const [edit, setEdit] = useState<ReceivingAccount | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!edit) return;
    setBusy(true);
    setErr("");
    const { key, ...rest } = edit;
    const body = {
      ...rest,
      channel:
        edit.method === "bank" ? "bank" : edit.channel === "bank" ? "personal" : edit.channel,
      instructions: edit.instructions.map((i) => i.trim()).filter(Boolean),
    };
    try {
      const a = await orderApi<ReceivingAccount>(
        key ? `/accountant/payment-accounts/${key}` : "/accountant/payment-accounts",
        key ? "PUT" : "POST",
        body,
      );
      setRows((rs) => (key ? rs.map((r) => (r.key === key ? a : r)) : [...rs, a]));
      toast({ tone: "success", title: "Account saved" });
      setEdit(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const set = (p: Partial<ReceivingAccount>) => edit && setEdit({ ...edit, ...p });
  return (
    <Card>
      <DataTable
        rows={rows}
        rowKey={(a) => a.key}
        empty={{ title: "No accounts yet", body: "Add one so students can pay." }}
        toolbar={
          <Button size="sm" variant="accent" onClick={() => setEdit({ ...BLANK })}>
            Add account
          </Button>
        }
        onRowClick={(a) => setEdit({ ...a })}
        columns={[
          {
            key: "n",
            header: "Account",
            cell: (a) => (
              <span>
                <b className="block">{a.name}</b>
                <span className="text-[11px] text-muted">
                  {METHOD_LABEL[a.method]} · {a.channel}
                </span>
              </span>
            ),
          },
          {
            key: "no",
            header: "Number",
            cell: (a) => <span className="font-mono">{a.number}</span>,
          },
          {
            key: "e",
            header: "Shown to payers",
            cell: (a) => (
              <Badge tone={a.enabled ? "green" : "gray"}>{a.enabled ? "Enabled" : "Hidden"}</Badge>
            ),
          },
        ]}
      />
      <Modal
        open={!!edit}
        onClose={() => (setEdit(null), setErr(""))}
        title={edit?.key ? "Edit account" : "Add account"}
        footer={
          <>
            <Button variant="outline" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button variant="accent" disabled={busy} onClick={save}>
              Save
            </Button>
          </>
        }
      >
        {edit && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Method" htmlFor="pa-m">
              <select
                id="pa-m"
                className="input"
                value={edit.method}
                onChange={(e) => set({ method: e.target.value as ReceivingAccount["method"] })}
              >
                {Object.entries(METHOD_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            {edit.method !== "bank" && (
              <Field label="Channel" htmlFor="pa-c">
                <select
                  id="pa-c"
                  className="input"
                  value={edit.channel}
                  onChange={(e) => set({ channel: e.target.value as ReceivingAccount["channel"] })}
                >
                  <option value="personal">Personal (Send Money)</option>
                  <option value="agent">Agent (Cash Out)</option>
                  <option value="merchant">Merchant (Payment)</option>
                </select>
              </Field>
            )}
            <Field label="Display name" required htmlFor="pa-n">
              <input
                id="pa-n"
                className="input"
                value={edit.name}
                onChange={(e) => set({ name: e.target.value })}
              />
            </Field>
            <Field label="Number / account no." required htmlFor="pa-no">
              <input
                id="pa-no"
                className="input font-mono"
                value={edit.number}
                onChange={(e) => set({ number: e.target.value })}
              />
            </Field>
            {edit.method === "bank" && (
              <>
                <Field label="Account name" htmlFor="pa-an">
                  <input
                    id="pa-an"
                    className="input"
                    value={edit.accountName ?? ""}
                    onChange={(e) => set({ accountName: e.target.value })}
                  />
                </Field>
                <Field label="Branch" htmlFor="pa-b">
                  <input
                    id="pa-b"
                    className="input"
                    value={edit.branch ?? ""}
                    onChange={(e) => set({ branch: e.target.value })}
                  />
                </Field>
              </>
            )}
            <div className="sm:col-span-2">
              <Field label="Instructions (one per line)" htmlFor="pa-i" error={err}>
                <textarea
                  id="pa-i"
                  rows={3}
                  className="input"
                  value={edit.instructions.join("\n")}
                  onChange={(e) => set({ instructions: e.target.value.split("\n") })}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={edit.enabled}
                onChange={(e) => set({ enabled: e.target.checked })}
              />
              Show this account on the pay page
            </label>
          </div>
        )}
      </Modal>
    </Card>
  );
}
