"use client";

import Link from "next/link";
import { FileDown, Paperclip } from "lucide-react";
import { formatDate, formatMoney, type Payment } from "@edukhata/contracts";
import { Badge } from "@/components/ui";
import { DataTable, useToast, type Column } from "@/components/ui/client";
import { useT } from "@/lib/i18n/client";
import { PAYMENT_STATUS } from "@/lib/labels";

export const METHOD_LABEL: Record<Payment["method"], string> = {
  bkash: "bKash",
  nagad: "Nagad",
  rocket: "Rocket",
  bank: "Bank",
};

export function PaymentStatusBadge({ status }: { status: Payment["status"] }) {
  const s = PAYMENT_STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function PaymentsTable({
  payments,
  payBase,
  showPayer,
  liveBase,
}: {
  payments: Payment[];
  payBase?: string;
  showPayer?: boolean;
  /** Live mode: the area ("/student", "/guardian", "/accountant") for pay and invoice links. */
  liveBase?: string;
}) {
  const { lang } = useT();
  const toast = useToast();
  const columns: Column<Payment>[] = [
    {
      key: "inv",
      header: "Invoice",
      cell: (p) => (
        <span>
          <span className="block font-semibold">{p.invoiceNo}</span>
          <span className="text-[11px] text-muted">Order {p.orderCode}</span>
        </span>
      ),
      sort: (p) => p.invoiceNo,
    },
    ...(showPayer
      ? [
          {
            key: "payer",
            header: "Payer",
            cell: (p: Payment) => p.payerName,
            sort: (p: Payment) => p.payerName,
          },
        ]
      : []),
    {
      key: "method",
      header: "Method",
      cell: (p) => (
        <span>
          {METHOD_LABEL[p.method]}
          {p.trxId && <span className="block font-mono text-[11px] text-muted">{p.trxId}</span>}
        </span>
      ),
    },
    {
      key: "date",
      header: "Date",
      cell: (p) => formatDate(p.createdAt, lang),
      sort: (p) => p.createdAt,
    },
    {
      key: "status",
      header: "Status",
      cell: (p) => (
        <span className="inline-flex flex-col items-start gap-0.5">
          <PaymentStatusBadge status={p.status} />
          {p.note && <span className="text-[11px] text-muted">{p.note}</span>}
        </span>
      ),
      sort: (p) => p.status,
    },
    {
      key: "amount",
      header: "Amount",
      cell: (p) => <span className="font-semibold">{formatMoney(p.amount, lang)}</span>,
      sort: (p) => p.amount.amountMinor,
      className: "text-right",
    },
    {
      key: "act",
      header: "",
      cell: (p) =>
        liveBase &&
        liveBase !== "/accountant" &&
        (p.status === "pending" || p.status === "rejected") ? (
          <Link
            href={`${liveBase}/orders/${p.orderId}/pay`}
            className="text-xs font-semibold text-[var(--color-accent)] hover:underline"
          >
            {p.status === "rejected" ? "Resubmit" : "Pay now"}
          </Link>
        ) : liveBase && (p.status === "approved" || p.status === "refunded") ? (
          <Link
            href={`${liveBase}/invoices/${p.id}`}
            className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink"
          >
            <FileDown size={14} /> Invoice
          </Link>
        ) : payBase && (p.status === "pending" || p.status === "rejected") ? (
          <Link
            href={`${payBase}/${p.id}/pay`}
            className="text-xs font-semibold text-[var(--color-accent)] hover:underline"
          >
            {p.status === "rejected" ? "Resubmit" : "Pay now"}
          </Link>
        ) : p.status === "approved" || p.status === "refunded" ? (
          <button
            onClick={() =>
              toast({
                tone: "info",
                title: `Invoice ${p.invoiceNo}`,
                body: "PDF invoices are generated server-side in Phase 5.",
              })
            }
            className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink"
          >
            <FileDown size={14} /> PDF
          </button>
        ) : p.hasProof ? (
          <span className="flex items-center gap-1 text-[11px] text-muted">
            <Paperclip size={12} /> proof
          </span>
        ) : null,
    },
  ];
  return (
    <DataTable
      rows={payments}
      columns={columns}
      rowKey={(p) => p.id}
      searchText={(p) => `${p.invoiceNo} ${p.orderCode} ${p.payerName} ${p.trxId ?? ""}`}
      filters={{
        label: "Status",
        options: Object.entries(PAYMENT_STATUS).map(([value, v]) => ({ value, label: v.label })),
        test: (p, v) => p.status === v,
      }}
      empty={{ title: "No payments yet" }}
    />
  );
}
