import { LiveDisputes, type LiveDispute } from "@/components/dash/admin-market";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";
import { fixtures } from "@edukhata/contracts";
import { DisputesManager } from "@/components/dash/admin-content";
import { PageHeader } from "@/components/ui";

async function LiveDisputesList() {
  const res = await apiFetch("/admin/disputes");
  if (!res.ok) return <ApiProblem status={res.status} />;
  return <LiveDisputes disputes={(await res.json()) as LiveDispute[]} />;
}

export default function AdminDisputes() {
  return (
    <>
      <PageHeader
        title="Disputes"
        sub="Review evidence and decide: release, partial or full refund."
      />
      {authMode() === "wan" ? (
        <LiveDisputesList />
      ) : (
        <DisputesManager disputes={fixtures.disputes} />
      )}
    </>
  );
}
