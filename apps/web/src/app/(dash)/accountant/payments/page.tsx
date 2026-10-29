import { fixtures, type Payment } from "@edukhata/contracts";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { PaymentVerificationQueue } from "@/components/dash/finance";
import { PageHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";

export default async function AccountantPayments() {
  const live = authMode() === "wan";
  const res = live ? await apiFetch("/accountant/payments") : null;
  if (res && !res.ok) return <ApiProblem status={res.status} />;
  return (
    <>
      <PageHeader
        title="Payment Verification"
        sub={
          live
            ? "Match each transaction ID, sender and amount with the provider statement, then approve or reject. Nobody verifies their own payment."
            : "Match each transaction ID with the provider statement, then approve or reject. Amounts ≥ ৳3,000 need a second approver."
        }
      />
      <PaymentVerificationQueue
        payments={res ? ((await res.json()) as Payment[]) : fixtures.payments}
        live={live}
      />
    </>
  );
}
