import { fixtures } from "@edukhata/contracts";
import { ReferralPanel } from "@/components/dash/Referral";
import { PageHeader } from "@/components/ui";

export default function StudentReferrals() {
  return (
    <>
      <PageHeader title="Refer & Earn" />
      <ReferralPanel r={fixtures.referral} />
    </>
  );
}
