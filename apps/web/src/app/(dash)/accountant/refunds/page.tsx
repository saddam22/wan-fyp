import { fixtures } from "@edukhata/contracts";
import { ApiProblem } from "@/components/dash/ApiProblem";
import {
  LiveRefundsTable,
  RefundsTable,
  type CashAccount,
  type LiveRefund,
} from "@/components/dash/finance";
import { PageHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";

export default async function AccountantRefunds() {
  const header = (
    <PageHeader
      title="Refunds"
      sub="Refunds decided by admins in disputes or cancellations. A second person approves; record each transfer when sent."
    />
  );
  if (authMode() !== "wan")
    return (
      <>
        {header}
        <RefundsTable disputes={fixtures.disputes} />
      </>
    );
  const [res, acc] = await Promise.all([
    apiFetch("/accountant/refunds"),
    apiFetch("/accountant/payment-accounts"),
  ]);
  if (!res.ok || !acc.ok) return <ApiProblem status={res.ok ? acc.status : res.status} />;
  return (
    <>
      {header}
      <LiveRefundsTable
        refunds={(await res.json()) as LiveRefund[]}
        accounts={(await acc.json()) as CashAccount[]}
      />
    </>
  );
}
