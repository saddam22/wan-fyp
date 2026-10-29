import { PromotionsAdmin, type Promo } from "@/components/dash/live-trust";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";
import { BoostsManager } from "@/components/dash/admin-content";
import { PageHeader } from "@/components/ui";

export default async function AdminBoosts() {
  if (authMode() === "wan") {
    const res = await apiFetch("/admin/promotions");
    if (!res.ok) return <ApiProblem status={res.status} />;
    return (
      <>
        <PageHeader
          title="Boosts & Subscriptions"
          sub="Bought by mentors from their earnings. Paid labels never affect ranking or matching."
        />
        <PromotionsAdmin items={(await res.json()) as Promo[]} />
      </>
    );
  }
  return (
    <>
      <PageHeader title="Boosts & Subscriptions" />
      <BoostsManager />
    </>
  );
}
