import { notFound } from "next/navigation";
import { mockApi } from "@edukhata/contracts";
import { OrderDetail } from "@/components/dash/OrderDetail";

export default async function AdminOrder({ params }: { params: Promise<{ id: string }> }) {
  const order = mockApi.order((await params).id);
  if (!order) notFound();
  return <OrderDetail order={order} viewer="admin" backHref="/admin/orders" />;
}
