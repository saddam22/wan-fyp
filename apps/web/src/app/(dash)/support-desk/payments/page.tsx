import { fixtures } from "@edukhata/contracts";
import { PaymentsTable } from "@/components/dash/PaymentsTable";
import { Card, PageHeader } from "@/components/ui";

export default function SupportPayments() {
  return (
    <>
      <PageHeader
        title="Payment Lookup"
        sub="Read-only status for answering payment questions. Verification is done by accountants."
      />
      <Card>
        <PaymentsTable payments={fixtures.payments} showPayer />
      </Card>
    </>
  );
}
