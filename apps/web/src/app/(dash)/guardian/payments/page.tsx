import { LivePayments } from "@/components/dash/LiveOrders";
import { authMode } from "@/lib/auth-mode";
import { fixtures } from "@edukhata/contracts";
import { PaymentsTable } from "@/components/dash/PaymentsTable";
import { Card, PageHeader } from "@/components/ui";

export default async function GuardianPayments() {
  if (authMode() === "wan")
    return (
      <>
        <PageHeader
          title="Payments"
          sub="Payments for your children's orders (as each child allows)."
        />
        <LivePayments base="/guardian" />
      </>
    );
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
