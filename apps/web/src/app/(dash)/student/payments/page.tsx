import { fixtures, formatMoney } from "@edukhata/contracts";
import { PaymentsTable } from "@/components/dash/PaymentsTable";
import { Card, PageHeader, StatCard } from "@/components/ui";
import { CheckCircle2, Clock, Undo2 } from "lucide-react";
import { getT } from "@/lib/i18n/server";

export default async function StudentPayments() {
  const { lang } = await getT();
  const mine = fixtures.payments.filter((p) => p.payerName === fixtures.me.name);
  const paid = mine
    .filter((p) => p.status === "approved")
    .reduce((s, p) => s + p.amount.amountMinor, 0);
  return (
    <>
      <PageHeader title="Payments" sub="Pay for orders and track verification." />
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Total paid"
          value={formatMoney({ amountMinor: paid, currency: "BDT" }, lang)}
          icon={<CheckCircle2 size={20} />}
          tone="green"
        />
        <StatCard
          label="Waiting"
          value={mine.filter((p) => p.status === "pending" || p.status === "submitted").length}
          icon={<Clock size={20} />}
          tone="amber"
        />
        <StatCard
          label="Refunded"
          value={mine.filter((p) => p.status === "refunded").length}
          icon={<Undo2 size={20} />}
          tone="gray"
        />
      </div>
      <Card>
        <PaymentsTable payments={mine} payBase="/student/payments" />
      </Card>
    </>
  );
}
