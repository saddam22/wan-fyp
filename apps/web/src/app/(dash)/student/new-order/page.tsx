import { Suspense } from "react";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { OrderWizard, type WizardCatalog } from "@/components/order/OrderWizard";
import { PageHeader, Skeleton } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";

async function liveCatalog(): Promise<WizardCatalog | number> {
  const [c, m] = await Promise.all([apiFetch("/catalog"), apiFetch("/mentors")]);
  if (!c.ok) return c.status;
  return { ...(await c.json()), mentors: m.ok ? await m.json() : [] } as WizardCatalog;
}

export default async function StudentNewOrder() {
  const live = authMode() === "wan" ? await liveCatalog() : undefined;
  return (
    <>
      <PageHeader
        title="New order"
        sub="Describe your assignment — you'll see the price before paying."
      />
      {typeof live === "number" ? (
        <ApiProblem status={live} />
      ) : (
        <Suspense fallback={<Skeleton className="h-[480px]" />}>
          <OrderWizard {...(live ? { live } : {})} />
        </Suspense>
      )}
    </>
  );
}
