import { fixtures } from "@edukhata/contracts";
import { PaymentsTable } from "@/components/dash/PaymentsTable";
import { Card, PageHeader } from "@/components/ui";

export default function GuardianPayments() {
  return (
    <>
      <PageHeader
        title="Payments"
        sub="You can pay pending invoices for Mahfuz (he allowed “pay on behalf”)."
      />
      <Card>
        <PaymentsTable
          payments={fixtures.payments.filter((p) => p.payerName === "Mahfuz Rahman")}
          payBase="/guardian/payments"
        />
      </Card>
    </>
  );
}
