import { fixtures, formatMoney } from "@edukhata/contracts";
import { BarChart } from "@/components/dash/Charts";
import { Card, CardHeader, KeyValue, PageHeader } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export default async function AccountantCommission() {
  const { lang } = await getT();
  const total = fixtures.revenueSeries.reduce((s, r) => s + r.commission, 0);
  return (
    <>
      <PageHeader
        title="Commission"
        sub="Platform 20% · mentor 80%. The rate is copied onto each order at payment time."
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader title="Commission by month" />
          <div className="p-5">
            <BarChart
              data={fixtures.revenueSeries.map((r) => ({ label: r.label, values: [r.commission] }))}
              series={["Commission"]}
            />
          </div>
        </Card>
        <Card className="p-5">
          <KeyValue
            items={[
              ["Current rate", "20%"],
              ["Mentor share", "80%"],
              [
                "6-month commission",
                formatMoney({ amountMinor: total * 100, currency: "BDT" }, lang),
              ],
              ["Rounding", "Platform share rounded half-up; mentor gets the remainder"],
            ]}
          />
          <p className="mt-4 text-xs text-muted">
            Changing the rate is a super-admin setting and is written to the audit log.
          </p>
        </Card>
      </div>
    </>
  );
}
