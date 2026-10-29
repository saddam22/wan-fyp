import { fixtures } from "@edukhata/contracts";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { ChildrenManager } from "@/components/dash/guardian";
import { LiveChildrenManager, type LiveChild } from "@/components/dash/guardian-live";
import { PageHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";

export default async function GuardianChildren() {
  const header = <PageHeader title="My Children" />;
  if (authMode() === "demo")
    return (
      <>
        {header}
        <ChildrenManager kids={fixtures.children} />
      </>
    );
  const res = await apiFetch("/guardian/children");
  return (
    <>
      {header}
      {res.ok ? (
        <LiveChildrenManager kids={(await res.json()) as LiveChild[]} />
      ) : (
        <ApiProblem status={res.status} />
      )}
    </>
  );
}
