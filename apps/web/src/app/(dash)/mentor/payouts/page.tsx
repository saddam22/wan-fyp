import { fixtures, formatDate, formatMoney, type Lang, type Payout } from "@edukhata/contracts";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";
import { PayoutRequest } from "@/components/dash/mentor";
import { METHOD_LABEL } from "@/components/dash/PaymentsTable";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { PAYOUT_STATUS } from "@/lib/labels";

export default async function MentorPayouts() {
  const { lang } = await getT();
  if (authMode() === "wan") return <LivePayouts lang={lang} />;
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
                    {formatMoney(p.amount, lang)} → {METHOD_LABEL[p.method]} {p.account}
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

function History({ items, lang }: { items: Payout[]; lang: Lang }) {
  return (
    <Card>
      <CardHeader title="History" />
      {items.length === 0 ? (
        <p className="p-5 text-sm text-muted">No payouts yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {formatMoney(p.amount, lang)} → {METHOD_LABEL[p.method]} {p.account}
                </p>
                <p className="text-xs text-muted">
                  Requested {formatDate(p.requestedAt, lang)}
                  {p.reference && ` · ref ${p.reference}`}
                  {p.note && ` · ${p.note}`}
                </p>
              </div>
              <Badge tone={PAYOUT_STATUS[p.status].tone}>{PAYOUT_STATUS[p.status].label}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

async function LivePayouts({ lang }: { lang: Lang }) {
  const [res, earn] = await Promise.all([
    apiFetch("/mentor/payouts"),
    apiFetch("/mentor/earnings"),
  ]);
  if (!res.ok || !earn.ok) return <ApiProblem status={res.ok ? earn.status : res.status} />;
  const p = (await res.json()) as { minPayoutMinor: number; items: Payout[] };
  const e = (await earn.json()) as { availableMinor: number };
  const open = p.items.some((x) => x.status === "requested" || x.status === "approved");
  return (
    <>
      <PageHeader
        title="Payouts"
        sub="One request at a time. The accounts team approves and sends it."
      />
      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="h-fit p-5">
          <p className="mb-3 font-bold">Request a payout</p>
          {open ? (
            <p className="text-sm text-muted">Your request is with the accounts team.</p>
          ) : (
            <PayoutRequest availableMinor={e.availableMinor} minMinor={p.minPayoutMinor} live />
          )}
        </Card>
        <History items={p.items} lang={lang} />
      </div>
    </>
  );
}
