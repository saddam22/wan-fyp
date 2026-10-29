import { fixtures } from "@edukhata/contracts";
import { RefundsTable } from "@/components/dash/finance";
import { PageHeader } from "@/components/ui";

export default function AdminRefunds() {
  return (
    <>
      <PageHeader title="Refunds" />
      <RefundsTable disputes={fixtures.disputes} />
    </>
  );
}
