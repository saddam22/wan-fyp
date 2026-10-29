import { fixtures } from "@edukhata/contracts";
import { TicketQueue } from "@/components/dash/support";
import { PageHeader } from "@/components/ui";

export default function SupportComplaints() {
  return (
    <>
      <PageHeader
        title="Complaints"
        sub="Student and mentor complaints, including safety reports."
      />
      <TicketQueue
        tickets={fixtures.tickets.filter(
          (t) => t.category === "complaint" || t.category === "mentor",
        )}
      />
    </>
  );
}
