import { notFound } from "next/navigation";
import { LivePay } from "@/components/dash/LiveOrders";
import { authMode } from "@/lib/auth-mode";

export default async function PayForOrder({ params }: { params: Promise<{ id: string }> }) {
  if (authMode() !== "wan") notFound();
  const { id } = await params;
  return <LivePay orderId={id} backHref={`/student/orders/${id}`} />;
}
