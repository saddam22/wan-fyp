import { notFound } from "next/navigation";
import { LiveInvoice } from "@/components/dash/LiveOrders";
import { authMode } from "@/lib/auth-mode";

export default async function Invoice({ params }: { params: Promise<{ id: string }> }) {
  if (authMode() !== "wan") notFound();
  return <LiveInvoice id={(await params).id} backHref="/guardian/payments" />;
}
