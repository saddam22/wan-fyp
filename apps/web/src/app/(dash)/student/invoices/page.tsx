import { fixtures } from "@edukhata/contracts";
import { PaymentsTable } from "@/components/dash/PaymentsTable";
import { Card, PageHeader } from "@/components/ui";

export default function StudentInvoices() {
  return (
    <>
      <PageHeader title="Invoices" sub="Download invoices for verified payments." />
      <Card>
        <PaymentsTable
          payments={fixtures.payments.filter(
            (p) =>
              p.payerName === fixtures.me.name &&
              (p.status === "approved" || p.status === "refunded"),
          )}
        />
      </Card>
    </>
  );
}
