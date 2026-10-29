import { notFound } from "next/navigation";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { ReconciliationPanel, type Reconciliation } from "@/components/dash/finance";
import { PageHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";

export default async function AccountantReconciliation() {
  if (authMode() !== "wan") notFound();
  const res = await apiFetch("/accountant/reconciliation");
  if (!res.ok) return <ApiProblem status={res.status} />;
  return (
    <>
      <PageHeader
        title="Reconciliation"
        sub="Last 30 days. Tick off each approved payment once you find it on the provider statement."
      />
      <ReconciliationPanel data={(await res.json()) as Reconciliation} />
    </>
  );
}
