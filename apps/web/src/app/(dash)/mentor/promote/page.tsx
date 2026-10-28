import { PromotePlans } from "@/components/dash/mentor";
import { PageHeader } from "@/components/ui";

export default function MentorPromote() {
  return (
    <>
      <PageHeader title="Promote Profile" sub="Boosts and subscriptions." />
      <PromotePlans />
    </>
  );
}
