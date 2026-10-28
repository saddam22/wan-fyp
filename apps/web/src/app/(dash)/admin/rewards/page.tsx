import { RewardsManager } from "@/components/dash/admin-content";
import { PageHeader } from "@/components/ui";

export default function AdminRewards() {
  return (
    <>
      <PageHeader title="Rewards" />
      <RewardsManager />
    </>
  );
}
