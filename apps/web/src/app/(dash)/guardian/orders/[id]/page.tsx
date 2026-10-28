import { notFound } from "next/navigation";
import { fixtures, mockApi } from "@edukhata/contracts";
import { OrderDetail } from "@/components/dash/OrderDetail";

export default async function GuardianOrder({ params }: { params: Promise<{ id: string }> }) {
  const order = mockApi.order((await params).id);
  const allowed = fixtures.children.filter((c) => c.permissions.viewOrders).map((c) => c.studentId);
  if (!order || !allowed.includes(order.studentId)) notFound();
  return <OrderDetail order={order} viewer="guardian" backHref="/guardian/orders" />;
}
