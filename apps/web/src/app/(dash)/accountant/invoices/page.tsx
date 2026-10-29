import type { Payment } from "@edukhata/contracts";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";
import { Download } from "lucide-react";
import { fixtures } from "@edukhata/contracts";
import { PaymentsTable } from "@/components/dash/PaymentsTable";
import { Card, PageHeader } from "@/components/ui";
import { DemoActionButton } from "@/components/ui/client";

export default async function AccountantInvoices() {
  if (authMode() === "wan") {
    const res = await apiFetch("/accountant/payments");
    if (!res.ok) return <ApiProblem status={res.status} />;
    const rows = ((await res.json()) as Payment[]).filter(
      (p) => p.status === "approved" || p.status === "refunded",
    );
    return (
      <>
        <PageHeader title="Invoices" sub="Every verified payment has an invoice." />
        <Card>
          <PaymentsTable payments={rows} showPayer liveBase="/accountant" />
        </Card>
      </>
    );
  }
  return (
    <>
      <PageHeader
        title="Invoices & Export"
        actions={
          <DemoActionButton
            variant="accent"
            label={
              <>
                <Download size={15} /> Export CSV
              </>
            }
            done="Export queued"
          />
        }
      />
      <Card>
        <PaymentsTable payments={fixtures.payments} showPayer />
      </Card>
    </>
  );
}
