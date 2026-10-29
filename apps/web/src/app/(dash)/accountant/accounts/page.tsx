import { notFound } from "next/navigation";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { PaymentAccountsManager, type ReceivingAccount } from "@/components/dash/finance";
import { PageHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";

export default async function AccountantAccounts() {
  if (authMode() !== "wan") notFound();
  const res = await apiFetch("/accountant/payment-accounts");
  if (!res.ok) return <ApiProblem status={res.status} />;
  return (
    <>
      <PageHeader
        title="Receiving Accounts"
        sub="bKash, Nagad, Rocket and bank accounts that payers send money to. Changes are audited."
      />
      <PaymentAccountsManager accounts={(await res.json()) as ReceivingAccount[]} />
    </>
  );
}
