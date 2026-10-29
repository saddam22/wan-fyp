import { LivePriceList } from "@/components/dash/admin-market";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";
import { WORK_TYPE } from "@/lib/labels";
import { CatalogManager } from "@/components/dash/admin-content";
import { PageHeader } from "@/components/ui";

async function LivePrices() {
  const res = await apiFetch("/admin/catalog");
  if (!res.ok) return <ApiProblem status={res.status} />;
  const c = (await res.json()) as { priceList: Record<string, { amountMinor: number }> };
  return (
    <div className="mb-5">
      <LivePriceList prices={c.priceList} labels={WORK_TYPE} />
    </div>
  );
}

export default function AdminCatalog() {
  return (
    <>
      <PageHeader title="Catalog" sub="Subjects, categories, classes and education boards." />
      {authMode() === "wan" && <LivePrices />}
      <CatalogManager />
    </>
  );
}
