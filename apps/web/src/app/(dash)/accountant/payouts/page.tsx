import { fixtures, type Payout } from "@edukhata/contracts";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { PayoutQueue, type CashAccount } from "@/components/dash/finance";
import { PageHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";

export default async function AccountantPayouts() {
  if (authMode() !== "wan")
    return (
      <>
        <PageHeader
          title="Payout Requests"
          sub="Approve, send the money, then record the transfer reference."
        />
        <PayoutQueue payouts={fixtures.payouts} />
      </>
    );
  const [res, acc] = await Promise.all([
    apiFetch("/accountant/payouts"),
    apiFetch("/accountant/payment-accounts"),
  ]);
  if (!res.ok || !acc.ok) return <ApiProblem status={res.ok ? acc.status : res.status} />;
  return (
    <>
      <PageHeader
        title="Payout Requests"
        sub="One person approves, a different person sends the money and records the transfer reference."
      />
      <PayoutQueue
        payouts={(await res.json()) as Payout[]}
        accounts={(await acc.json()) as CashAccount[]}
        live
      />
    </>
  );
}
