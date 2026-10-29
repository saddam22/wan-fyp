import { notFound } from "next/navigation";
import { mockApi } from "@edukhata/contracts";
import { TicketDetail } from "@/components/dash/support";

export default async function SupportTicket({ params }: { params: Promise<{ id: string }> }) {
  const t = mockApi.ticket((await params).id);
  if (!t) notFound();
  return <TicketDetail ticket={t} />;
}
