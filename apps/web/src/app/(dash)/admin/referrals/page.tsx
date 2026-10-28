import { ReferralConfig } from "@/components/dash/admin-content";
import { PageHeader } from "@/components/ui";

export default function AdminReferrals() {
  return (
    <>
      <PageHeader title="Referral Configuration" />
      <ReferralConfig />
    </>
  );
}
