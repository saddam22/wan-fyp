import { BoostsManager } from "@/components/dash/admin-content";
import { PageHeader } from "@/components/ui";

export default function AdminBoosts() {
  return (
    <>
      <PageHeader title="Boosts & Subscriptions" />
      <BoostsManager />
    </>
  );
}
