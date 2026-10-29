import { fixtures } from "@edukhata/contracts";
import { RefundsTable } from "@/components/dash/finance";
import { PageHeader } from "@/components/ui";

export default function AccountantRefunds() {
  return (
    <>
      <PageHeader
        title="Refunds"
        sub="Refunds decided by admins in disputes or cancellations. Record each transfer when sent."
      />
      <RefundsTable disputes={fixtures.disputes} />
    </>
  );
}
