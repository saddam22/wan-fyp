import { Download } from "lucide-react";
import { fixtures } from "@edukhata/contracts";
import { PaymentsTable } from "@/components/dash/PaymentsTable";
import { Card, PageHeader } from "@/components/ui";
import { DemoActionButton } from "@/components/ui/client";

export default function AccountantInvoices() {
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
