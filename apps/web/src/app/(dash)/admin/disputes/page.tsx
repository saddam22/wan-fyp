import { fixtures } from "@edukhata/contracts";
import { DisputesManager } from "@/components/dash/admin-content";
import { PageHeader } from "@/components/ui";

export default function AdminDisputes() {
  return (
    <>
      <PageHeader
        title="Disputes"
        sub="Review evidence and decide: release, partial or full refund."
      />
      <DisputesManager disputes={fixtures.disputes} />
    </>
  );
}
