import { notFound } from "next/navigation";
import type { Order, Payment, PaymentOption } from "@edukhata/contracts";
import { ManualPayment } from "@/components/dash/ManualPayment";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { OrderDetail, type Viewer } from "@/components/dash/OrderDetail";
import { OrdersTable } from "@/components/dash/OrdersTable";
import { PaymentsTable } from "@/components/dash/PaymentsTable";
import { PrintButton } from "@/components/dash/PrintButton";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getT } from "@/lib/i18n/server";
import { formatDate, formatMoney, type Money } from "@edukhata/contracts";

/** One order from the API (it decides who may see it; others get 404). */
export async function LiveOrder({
  id,
  viewer,
  backHref,
}: {
  id: string;
  viewer: Viewer;
  backHref: string;
}) {
  const res = await apiFetch(`/orders/${encodeURIComponent(id)}`);
  if (res.status === 404) notFound();
  if (!res.ok) return <ApiProblem status={res.status} />;
  return (
    <OrderDetail order={(await res.json()) as Order} viewer={viewer} backHref={backHref} live />
  );
}

/** Orders list for one side: student (own), mentor (assigned), guardian (children), staff (all). */
export async function LiveOrderList({
  as,
  base,
  view,
}: {
  as: "student" | "mentor" | "guardian" | "staff";
  base: string;
  view: "student" | "mentor" | "staff";
}) {
  const res = await apiFetch(`/orders?as=${as}`);
  if (!res.ok) return <ApiProblem status={res.status} />;
  return (
    <Card>
      <OrdersTable orders={(await res.json()) as Order[]} base={base} view={view} />
    </Card>
  );
}

/** Pay what the order needs now (order price or a paid revision). */
export async function LivePay({ orderId, backHref }: { orderId: string; backHref: string }) {
  const [res, acc] = await Promise.all([
    apiFetch(`/orders/${encodeURIComponent(orderId)}/payment`),
    apiFetch("/payments/accounts"),
  ]);
  if (res.status === 404) notFound();
  if (!res.ok || !acc.ok) return <ApiProblem status={res.ok ? acc.status : res.status} />;
  const p = (await res.json()) as { due: Payment | null; canPay: boolean };
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Order", href: backHref }, { label: p.due?.invoiceNo ?? "Payment" }]}
        title="Complete payment"
        sub="Send money, then enter your transaction ID for verification."
      />
      {p.due && p.canPay ? (
        <ManualPayment
          payment={p.due}
          backHref={backHref}
          options={(await acc.json()) as PaymentOption[]}
        />
      ) : (
        <Card>
          <EmptyState
            title={p.canPay ? "Nothing to pay right now" : "You can't pay for this order"}
            body={
              p.canPay
                ? "This order has no payment due."
                : "The student hasn't allowed you to pay on their behalf."
            }
          />
        </Card>
      )}
    </>
  );
}

/** The signed-in person's payments (own orders, children's with permission, paid by them). */
export async function LivePayments({
  base,
  invoicesOnly,
}: {
  base: "/student" | "/guardian";
  invoicesOnly?: boolean;
}) {
  const res = await apiFetch("/me/payments");
  if (!res.ok) return <ApiProblem status={res.status} />;
  let rows = (await res.json()) as Payment[];
  if (invoicesOnly) rows = rows.filter((p) => p.status === "approved" || p.status === "refunded");
  return (
    <Card>
      <PaymentsTable payments={rows} liveBase={base} />
    </Card>
  );
}

interface Invoice {
  invoiceNo: string;
  issuedAt: string;
  seller: { name: string; address: string; website: string };
  billedTo: { name: string | null; paidBy: string | null };
  items: { description: string; amount: Money }[];
  total: Money;
  tax: Money & { note: string };
  payment: { method: string | null; reference: string | null; status: string };
}

/** Printable invoice of a verified payment (the API decides who may see it). */
export async function LiveInvoice({ id, backHref }: { id: string; backHref: string }) {
  const res = await apiFetch(`/payments/${encodeURIComponent(id)}/invoice`);
  if (res.status === 404) notFound();
  if (!res.ok) return <ApiProblem status={res.status} />;
  const inv = (await res.json()) as Invoice;
  const { lang } = await getT();
  return (
    <>
      <div className="print:hidden">
        <PageHeader
          crumbs={[{ label: "Payments", href: backHref }, { label: inv.invoiceNo }]}
          title={`Invoice ${inv.invoiceNo}`}
          actions={<PrintButton />}
        />
      </div>
      <Card className="mx-auto max-w-2xl p-8 text-sm print:shadow-none print:ring-0">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <p className="text-xl font-bold">{inv.seller.name}</p>
            <p className="text-muted">{inv.seller.address}</p>
            <p className="text-muted">{inv.seller.website}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">INVOICE</p>
            <p className="font-mono">{inv.invoiceNo}</p>
            <p className="text-muted">{formatDate(inv.issuedAt, lang)}</p>
            {inv.payment.status === "refunded" && (
              <p className="font-semibold text-danger">Refunded</p>
            )}
          </div>
        </div>
        <div className="mt-6">
          <p className="text-xs text-muted">Billed to</p>
          <p className="font-semibold">{inv.billedTo.name}</p>
          {inv.billedTo.paidBy && inv.billedTo.paidBy !== inv.billedTo.name && (
            <p className="text-muted">Paid by {inv.billedTo.paidBy}</p>
          )}
        </div>
        <table className="mt-6 w-full">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((i) => (
              <tr key={i.description} className="border-b border-line">
                <td className="py-2">{i.description}</td>
                <td className="py-2 text-right tabular-nums">{formatMoney(i.amount, lang)}</td>
              </tr>
            ))}
            <tr>
              <td className="py-2 text-muted">{inv.tax.note}</td>
              <td className="py-2 text-right tabular-nums">{formatMoney(inv.tax, lang)}</td>
            </tr>
            <tr className="font-bold">
              <td className="py-2">Total paid</td>
              <td className="py-2 text-right tabular-nums">{formatMoney(inv.total, lang)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-6 text-xs text-muted">
          Paid by {inv.payment.method ?? "—"} · reference{" "}
          <span className="font-mono">{inv.payment.reference ?? "—"}</span>. Verified by the
          EduKhata accounts team.
        </p>
      </Card>
    </>
  );
}
