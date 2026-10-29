import { fixtures } from "@edukhata/contracts";
import { PayoutQueue } from "@/components/dash/finance";
import { PageHeader } from "@/components/ui";

export default function AccountantPayouts() {
  return (
    <>
      <PageHeader
        title="Payout Requests"
        sub="Approve, send the money, then record the transfer reference."
      />
      <PayoutQueue payouts={fixtures.payouts} />
    </>
  );
}
