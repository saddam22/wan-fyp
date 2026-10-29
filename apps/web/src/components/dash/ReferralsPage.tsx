import { fixtures, type ReferralSummary } from "@edukhata/contracts";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { ReferralPanel } from "@/components/dash/Referral";
import { PageHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";

/** Refer & Earn for students and guardians: demo data, or the person's real code (wan mode). */
export async function ReferralsPage() {
  const header = <PageHeader title="Refer & Earn" />;
  if (authMode() === "demo")
    return (
      <>
        {header}
        <ReferralPanel r={fixtures.referral} />
      </>
    );
  const res = await apiFetch("/me/referral");
  return (
    <>
      {header}
      {res.ok ? (
        <ReferralPanel r={(await res.json()) as ReferralSummary} />
      ) : (
        <ApiProblem status={res.status} />
      )}
    </>
  );
}
