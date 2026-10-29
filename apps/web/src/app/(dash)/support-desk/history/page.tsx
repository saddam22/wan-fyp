import { fixtures } from "@edukhata/contracts";
import { TicketQueue } from "@/components/dash/support";
import { PageHeader } from "@/components/ui";

export default function SupportHistory() {
  return (
    <>
      <PageHeader title="Resolution History" />
      <TicketQueue
        tickets={fixtures.tickets.filter((t) => t.status === "resolved" || t.status === "closed")}
      />
    </>
  );
}
