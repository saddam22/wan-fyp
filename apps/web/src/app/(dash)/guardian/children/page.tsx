import { fixtures } from "@edukhata/contracts";
import { ChildrenManager } from "@/components/dash/guardian";
import { PageHeader } from "@/components/ui";

export default function GuardianChildren() {
  return (
    <>
      <PageHeader title="My Children" />
      <ChildrenManager kids={fixtures.children} />
    </>
  );
}
