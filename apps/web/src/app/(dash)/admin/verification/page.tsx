import { VerificationQueueLive, type VRequest } from "@/components/dash/live-trust";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";
import { VerificationQueue } from "@/components/dash/admin-people";
import { PageHeader } from "@/components/ui";

export default async function AdminVerification() {
  if (authMode() === "wan") {
    const res = await apiFetch("/admin/verifications");
    if (!res.ok) return <ApiProblem status={res.status} />;
    return (
      <>
        <PageHeader
          title="Verification Queue"
          sub="Identity and qualification documents. Nobody reviews their own request."
        />
        <VerificationQueueLive items={(await res.json()) as VRequest[]} />
      </>
    );
  }
  return (
    <>
      <PageHeader
        title="Verification Queue"
        sub="Identity, qualification and institution documents."
      />
      <VerificationQueue />
    </>
  );
}
