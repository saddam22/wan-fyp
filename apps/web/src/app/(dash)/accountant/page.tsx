import Link from "next/link";
import { BadgeCheck, Banknote, Percent, Undo2 } from "lucide-react";
import { fixtures, formatMoney } from "@edukhata/contracts";
import { BarChart } from "@/components/dash/Charts";
import { Card, CardHeader, StatCard } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export default async function AccountantHome() {
  const { lang } = await getT();
  const queue = fixtures.payments.filter((p) => p.status === "submitted");
  const payouts = fixtures.payouts.filter((p) => p.status === "requested");
  const month = fixtures.revenueSeries.at(-1)!;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Accounts overview</h1>
        <p className="text-sm text-muted">
          Verify money in, approve money out, keep the books balanced.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Payments to verify"
          value={queue.length}
          delta={formatMoney(
            { amountMinor: queue.reduce((s, p) => s + p.amount.amountMinor, 0), currency: "BDT" },
            lang,
          )}
          icon={<BadgeCheck size={20} />}
          tone="amber"
          href="/accountant/payments"
        />
        <StatCard
          label="Payout requests"
          value={payouts.length}
          delta={formatMoney(
            { amountMinor: payouts.reduce((s, p) => s + p.amount.amountMinor, 0), currency: "BDT" },
            lang,
          )}
          icon={<Banknote size={20} />}
          tone="blue"
          href="/accountant/payouts"
        />
        <StatCard
          label="Commission (Oct)"
          value={formatMoney({ amountMinor: month.commission * 100, currency: "BDT" }, lang)}
          icon={<Percent size={20} />}
          tone="green"
          href="/accountant/commission"
        />
        <StatCard
          label="Open refunds"
          value={fixtures.disputes.filter((d) => d.status === "under_review").length}
          icon={<Undo2 size={20} />}
          tone="red"
          href="/accountant/refunds"
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader title="Order value vs commission" sub="Last 6 months · BDT" />
          <div className="p-5">
            <BarChart
              data={fixtures.revenueSeries.map((r) => ({
                label: r.label,
                values: [r.gmv, r.commission],
              }))}
              series={["Order value (GMV)", "Commission"]}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Reconciliation" sub="Nightly checks (Phase 5)" />
          <ul className="space-y-2 p-5 text-sm">
            {[
              ["Ledger debits = credits", true],
              ["Approved payments have ledger entries", true],
              ["No TrxID used twice", true],
              ["Mentor payable ≥ requested payouts", true],
              ["bKash statement matched", false],
            ].map(([l, ok]) => (
              <li key={l as string} className="flex items-center justify-between gap-2">
                <span>{l as string}</span>
                <span className={ok ? "font-semibold text-success" : "font-semibold text-warning"}>
                  {ok ? "Pass" : "Manual"}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/accountant/ledger"
            className="block border-t border-line px-5 py-3 text-sm font-semibold text-[var(--color-accent)]"
          >
            Open ledger →
          </Link>
        </Card>
      </div>
    </div>
  );
}
