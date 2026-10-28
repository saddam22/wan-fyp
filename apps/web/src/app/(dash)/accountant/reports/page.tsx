import { Download } from "lucide-react";
import { fixtures, formatMoney } from "@edukhata/contracts";
import { BarChart } from "@/components/dash/Charts";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { DemoActionButton } from "@/components/ui/client";
import { getT } from "@/lib/i18n/server";

export default async function AccountantReports() {
  const { lang } = await getT();
  const f = (x: number) => formatMoney({ amountMinor: x * 100, currency: "BDT" }, lang);
  return (
    <>
      <PageHeader
        title="Financial Reports"
        actions={
          <>
            <DemoActionButton
              variant="outline"
              label={
                <>
                  <Download size={15} /> Daily report
                </>
              }
              done="Daily report queued"
            />
            <DemoActionButton
              variant="accent"
              label={
                <>
                  <Download size={15} /> Monthly report
                </>
              }
              done="Monthly report queued"
            />
          </>
        }
      />
      <Card className="mb-5">
        <CardHeader title="Monthly summary" />
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
        <CardHeader title="Monthly table" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-slate-50 text-xs text-muted uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Month</th>
                <th className="px-4 py-2 text-right">GMV</th>
                <th className="px-4 py-2 text-right">Commission</th>
                <th className="px-4 py-2 text-right">Mentor share</th>
                <th className="px-4 py-2 text-right">Refunds</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {fixtures.revenueSeries.map((r, i) => (
                <tr key={r.label}>
                  <td className="px-4 py-2.5">{r.label} 2026</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{f(r.gmv)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{f(r.commission)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{f(r.gmv - r.commission)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {f([4200, 3100, 6900, 2500, 3800, 1500][i]!)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-4 py-2.5 text-[11px] text-muted">
          Tax/VAT columns are added after the owner decides fee and tax handling (open decision Q7).
        </p>
      </Card>
    </>
  );
}
