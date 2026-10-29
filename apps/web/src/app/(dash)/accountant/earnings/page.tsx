import { fixtures, formatMoney } from "@edukhata/contracts";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export default async function AccountantEarnings() {
  const { lang } = await getT();
  const rows = fixtures.mentors.slice(0, 7).map((m, i) => ({
    m,
    pending: [288000, 72000, 0, 56000, 0, 36000, 0][i]!,
    available: [1840000, 960000, 840000, 410000, 560000, 380000, 120000][i]!,
    flagged: i === 6,
  }));
  const f = (x: number) => formatMoney({ amountMinor: x, currency: "BDT" }, lang);
  return (
    <>
      <PageHeader
        title="Mentor Earnings"
        sub="Balances derived from the ledger: pending until approval, then available for payout."
      />
      <Card>
        <CardHeader title="Balances" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-slate-50 text-xs text-muted uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Mentor</th>
                <th className="px-4 py-2 text-right">Pending</th>
                <th className="px-4 py-2 text-right">Available</th>
                <th className="px-4 py-2">Check</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.m.id}>
                  <td className="px-4 py-3 font-semibold">{r.m.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{f(r.pending)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{f(r.available)}</td>
                  <td className="px-4 py-3 text-center">
                    {r.flagged ? (
                      <Badge tone="red">Refund adjustment</Badge>
                    ) : (
                      <Badge tone="green">Matches ledger</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
