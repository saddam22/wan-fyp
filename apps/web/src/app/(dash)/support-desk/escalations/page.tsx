import { fixtures } from "@edukhata/contracts";
import { TicketQueue } from "@/components/dash/support";
import { PageHeader } from "@/components/ui";

export default function SupportEscalations() {
  return (
    <>
      <PageHeader
        title="Escalations"
        sub="Waiting on an admin decision (refunds, disputes, account actions)."
      />
      <TicketQueue tickets={fixtures.tickets.filter((t) => t.status === "escalated")} />
    </>
  );
}
