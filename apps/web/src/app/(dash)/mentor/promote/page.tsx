import { PromoteLive, type PromoData } from "@/components/dash/live-trust";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";
import { PromotePlans } from "@/components/dash/mentor";
import { PageHeader } from "@/components/ui";

export default async function MentorPromote() {
  if (authMode() === "wan") {
    const res = await apiFetch("/mentor/promotions");
    if (!res.ok) return <ApiProblem status={res.status} />;
    return (
      <>
        <PageHeader title="Promote Profile" sub="Boosts and Pro, paid from your earnings." />
        <PromoteLive data={(await res.json()) as PromoData} />
      </>
    );
  }
  return (
    <>
      <PageHeader title="Promote Profile" sub="Boosts and subscriptions." />
      <PromotePlans />
    </>
  );
}
