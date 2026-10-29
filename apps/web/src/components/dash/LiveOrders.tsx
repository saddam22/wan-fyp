import { notFound } from "next/navigation";
import type { Order, Payment, PaymentOption } from "@edukhata/contracts";
import { ManualPayment } from "@/components/dash/ManualPayment";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { OrderDetail, type Viewer } from "@/components/dash/OrderDetail";
import { OrdersTable } from "@/components/dash/OrdersTable";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api";

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
