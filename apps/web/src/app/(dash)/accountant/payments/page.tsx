import { fixtures } from "@edukhata/contracts";
import { PaymentVerificationQueue } from "@/components/dash/finance";
import { PageHeader } from "@/components/ui";

export default function AccountantPayments() {
  return (
    <>
      <PageHeader
        title="Payment Verification"
        sub="Match each transaction ID with the provider statement, then approve or reject. Amounts ≥ ৳3,000 need a second approver."
      />
      <PaymentVerificationQueue payments={fixtures.payments} />
    </>
  );
}
