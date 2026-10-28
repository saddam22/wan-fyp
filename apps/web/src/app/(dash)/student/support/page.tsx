import { fixtures, mockApi } from "@edukhata/contracts";
import { SupportTickets } from "@/components/dash/SupportTickets";
import { PageHeader } from "@/components/ui";

export default function StudentSupport() {
  return (
    <>
      <PageHeader title="Support" sub="Questions, complaints and order issues." />
      <SupportTickets
        tickets={fixtures.tickets.filter((t) => t.requesterRole === "student").slice(0, 2)}
        orderCodes={mockApi.orders("all", fixtures.me.id).map((o) => o.code)}
      />
    </>
  );
}
