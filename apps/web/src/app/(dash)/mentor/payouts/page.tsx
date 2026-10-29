import { fixtures, formatDate, formatMoney } from "@edukhata/contracts";
import { PayoutRequest } from "@/components/dash/mentor";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { PAYOUT_STATUS } from "@/lib/labels";

export default async function MentorPayouts() {
  const { lang } = await getT();
  const mine = fixtures.payouts.filter((p) => p.mentorId === fixtures.meMentor.id);
  return (
    <>
      <PageHeader title="Payouts" />
      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="h-fit p-5">
          <p className="mb-3 font-bold">Request a payout</p>
          <PayoutRequest availableMinor={1840000} />
        </Card>
        <Card>
          <CardHeader title="History" />
          <ul className="divide-y divide-line">
            {mine.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {formatMoney(p.amount, lang)} →{" "}
                    {p.method === "bank" ? "Bank" : p.method === "bkash" ? "bKash" : "Nagad"}{" "}
                    {p.account}
                  </p>
                  <p className="text-xs text-muted">
                    Requested {formatDate(p.requestedAt, lang)}
                    {p.reference && ` · ref ${p.reference}`}
                  </p>
                </div>
                <Badge tone={PAYOUT_STATUS[p.status].tone}>{PAYOUT_STATUS[p.status].label}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
