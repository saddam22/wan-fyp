import type { Lang, Payment, Payout } from "@edukhata/contracts";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";
import Link from "next/link";
import { BadgeCheck, Banknote, Percent, Undo2 } from "lucide-react";
import { fixtures, formatMoney } from "@edukhata/contracts";
import { BarChart } from "@/components/dash/Charts";
import { Card, CardHeader, StatCard } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export default async function AccountantHome() {
  const { lang } = await getT();
  if (authMode() === "wan") return <LiveHome lang={lang} />;
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

interface Balances {
  cashTotalMinor: number;
  heldForOrdersMinor: number;
  mentorPendingMinor: number;
  mentorAvailableMinor: number;
  commissionMinor: number;
  refundsPayableMinor: number;
  payoutsPayableMinor: number;
  trialBalanceMinor: number;
}

async function LiveHome({ lang }: { lang: Lang }) {
  const [b, q, po, rf] = await Promise.all([
    apiFetch("/accountant/balances"),
    apiFetch("/accountant/payments?status=submitted"),
    apiFetch("/accountant/payouts?status=requested"),
    apiFetch("/accountant/refunds?status=requested"),
  ]);
  const bad = [b, q, po, rf].find((r) => !r.ok);
  if (bad) return <ApiProblem status={bad.status} />;
  const bal = (await b.json()) as Balances;
  const queue = (await q.json()) as Payment[];
  const payouts = (await po.json()) as Payout[];
  const refunds = (await rf.json()) as unknown[];
  const m = (x: number) => formatMoney({ amountMinor: x, currency: "BDT" }, lang);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Accounts overview</h1>
        <p className="text-sm text-muted">From the ledger, as of now.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Payments to verify"
          value={queue.length}
          delta={m(queue.reduce((s, p) => s + p.amount.amountMinor, 0))}
          icon={<BadgeCheck size={20} />}
          tone="amber"
          href="/accountant/payments"
        />
        <StatCard
          label="Payout requests"
          value={payouts.length}
          delta={m(payouts.reduce((s, p) => s + p.amount.amountMinor, 0))}
          icon={<Banknote size={20} />}
          tone="blue"
          href="/accountant/payouts"
        />
        <StatCard
          label="Commission earned"
          value={m(bal.commissionMinor)}
          icon={<Percent size={20} />}
          tone="green"
          href="/accountant/ledger"
        />
        <StatCard
          label="Refunds to approve"
          value={refunds.length}
          icon={<Undo2 size={20} />}
          tone="red"
          href="/accountant/refunds"
        />
      </div>
      <Card>
        <CardHeader title="Balances" sub="What the money in our accounts is for" />
        <dl className="grid gap-x-8 gap-y-2 p-5 text-sm sm:grid-cols-2">
          {(
            [
              ["Cash in receiving accounts", bal.cashTotalMinor],
              ["Held for orders in progress", bal.heldForOrdersMinor],
              ["Mentors: pending", bal.mentorPendingMinor],
              ["Mentors: available to withdraw", bal.mentorAvailableMinor],
              ["Payouts approved, not sent", bal.payoutsPayableMinor],
              ["Refunds decided, not sent", bal.refundsPayableMinor],
              ["Platform commission", bal.commissionMinor],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-line py-1.5">
              <dt className="text-muted">{k}</dt>
              <dd className="font-semibold tabular-nums">{m(v)}</dd>
            </div>
          ))}
        </dl>
        <p className="border-t border-line px-5 py-3 text-sm">
          Trial balance:{" "}
          <b className={bal.trialBalanceMinor === 0 ? "text-success" : "text-danger"}>
            {bal.trialBalanceMinor === 0 ? "balanced" : `off by ${m(bal.trialBalanceMinor)}`}
          </b>
          {" · "}
          <Link
            href="/accountant/reconciliation"
            className="font-semibold text-[var(--color-accent)]"
          >
            Reconcile with statements →
          </Link>
        </p>
      </Card>
    </div>
  );
}
