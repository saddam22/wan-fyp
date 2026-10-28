import { fixtures } from "@edukhata/contracts";
import { TicketQueue } from "@/components/dash/support";
import { PageHeader } from "@/components/ui";

export default function SupportTickets() {
  return (
    <>
      <PageHeader title="Tickets" />
      <TicketQueue tickets={fixtures.tickets} />
    </>
  );
}
