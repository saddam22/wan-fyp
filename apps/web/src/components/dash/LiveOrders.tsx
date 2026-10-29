import { notFound } from "next/navigation";
import type { Order } from "@edukhata/contracts";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { OrderDetail, type Viewer } from "@/components/dash/OrderDetail";
import { OrdersTable } from "@/components/dash/OrdersTable";
import { Card } from "@/components/ui";
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
