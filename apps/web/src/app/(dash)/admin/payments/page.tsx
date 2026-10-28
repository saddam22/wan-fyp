import { fixtures } from "@edukhata/contracts";
import { PaymentVerificationQueue } from "@/components/dash/finance";
import { PageHeader } from "@/components/ui";

export default function AdminPayments() {
  return (
    <>
      <PageHeader title="Payments" sub="Verification queue (shared with accountants)." />
      <PaymentVerificationQueue payments={fixtures.payments} />
    </>
  );
}
