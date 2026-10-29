import type { LedgerEntry } from "@edukhata/contracts";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { LedgerTable } from "@/components/dash/finance";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";
import { Banknote, Clock, TrendingUp, Wallet } from "lucide-react";
import { BarChart } from "@/components/dash/Charts";
import { OrdersTable } from "@/components/dash/OrdersTable";
import { Card, CardHeader, PageHeader, StatCard } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { fixtures, formatMoney, mockApi, revenueSeriesFor } from "@/lib/mentorData";

export default async function MentorEarnings() {
  const { lang } = await getT();
  if (authMode() === "wan") return <LiveEarnings lang={lang} />;
  const e = fixtures.mentorEarnings;
  const m = (x: number) => formatMoney({ amountMinor: x, currency: "BDT" }, lang);
  return (
    <>
      <PageHeader
        title="Earnings"
        sub="You keep 80% of each order. Earnings move from pending to available after the student approves."
      />
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Available"
          value={m(e.availableMinor)}
          icon={<Wallet size={20} />}
          tone="green"
          href="/mentor/payouts"
        />
        <StatCard
          label="Pending approval"
          value={m(e.pendingMinor)}
          icon={<Clock size={20} />}
          tone="amber"
        />
        <StatCard
          label="Paid out"
          value={m(e.paidOutMinor)}
          icon={<Banknote size={20} />}
          tone="blue"
        />
        <StatCard
          label="Lifetime"
          value={m(e.lifetimeMinor)}
          icon={<TrendingUp size={20} />}
          tone="violet"
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader title="Monthly earnings" />
          <div className="p-5">
            <BarChart data={revenueSeriesFor()} series={["Earned"]} />
          </div>
        </Card>
        <Card className="p-5 text-sm">
          <p className="font-bold">How it&apos;s calculated</p>
          <dl className="mt-3 space-y-2">
            <div className="flex justify-between">
              <dt className="text-muted">Order ৳2,000</dt>
              <dd />
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Platform 20%</dt>
              <dd>−৳400</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 font-bold">
              <dt>Your share</dt>
              <dd>৳1,600</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted">
            The rate is stored on each order when it is paid, so later changes never affect past
            orders.
          </p>
        </Card>
      </div>
      <Card className="mt-5">
        <CardHeader title="Per-order earnings" />
        <OrdersTable
          orders={mockApi.mentorOrders(fixtures.meMentor.id)}
          base="/mentor/orders"
          view="mentor"
        />
      </Card>
    </>
  );
}

async function LiveEarnings({ lang }: { lang: "en" | "bn" }) {
  const res = await apiFetch("/mentor/earnings");
  if (!res.ok) return <ApiProblem status={res.status} />;
  const e = (await res.json()) as {
    pendingMinor: number;
    availableMinor: number;
    lines: LedgerEntry[];
  };
  const m = (x: number) => formatMoney({ amountMinor: x, currency: "BDT" }, lang);
  return (
    <>
      <PageHeader
        title="Earnings"
        sub="You keep 80% of each order. Your share is pending once the student approves, and available to withdraw when the order closes."
      />
      <div className="mb-5 grid grid-cols-2 gap-3">
        <StatCard
          label="Available"
          value={m(e.availableMinor)}
          icon={<Wallet size={20} />}
          tone="green"
          href="/mentor/payouts"
        />
        <StatCard
          label="Pending (approved, not closed)"
          value={m(e.pendingMinor)}
          icon={<Clock size={20} />}
          tone="amber"
        />
      </div>
      <LedgerTable entries={e.lines} />
    </>
  );
}
