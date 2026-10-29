import { LiveOrder } from "@/components/dash/LiveOrders";
import { authMode } from "@/lib/auth-mode";
import { notFound } from "next/navigation";
import { fixtures, mockApi } from "@edukhata/contracts";
import { OrderDetail } from "@/components/dash/OrderDetail";

export default async function MentorOrder({ params }: { params: Promise<{ id: string }> }) {
  if (authMode() === "wan")
    return <LiveOrder id={(await params).id} viewer="mentor" backHref="/mentor/orders" />;
  const order = mockApi.order((await params).id);
  if (!order || order.mentorId !== fixtures.meMentor.id) notFound();
  return <OrderDetail order={order} viewer="mentor" backHref="/mentor/orders" />;
}
