import { fixtures } from "@edukhata/contracts";
import { PayoutQueue } from "@/components/dash/finance";
import { PageHeader } from "@/components/ui";

export default function AdminPayouts() {
  return (
    <>
      <PageHeader title="Payouts" />
      <PayoutQueue payouts={fixtures.payouts} />
    </>
  );
}
