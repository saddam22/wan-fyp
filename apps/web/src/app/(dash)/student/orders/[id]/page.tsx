import { LiveOrder } from "@/components/dash/LiveOrders";
import { authMode } from "@/lib/auth-mode";
import { notFound } from "next/navigation";
import { fixtures, mockApi } from "@edukhata/contracts";
import { OrderDetail } from "@/components/dash/OrderDetail";

export default async function StudentOrder({ params }: { params: Promise<{ id: string }> }) {
  if (authMode() === "wan")
    return <LiveOrder id={(await params).id} viewer="student" backHref="/student/orders" />;
  const order = mockApi.order((await params).id);
  // Ownership: a student sees only their own orders (enforced by the API from Phase 4).
  if (!order || order.studentId !== fixtures.me.id) notFound();
  return <OrderDetail order={order} viewer="student" backHref="/student/orders" />;
}
