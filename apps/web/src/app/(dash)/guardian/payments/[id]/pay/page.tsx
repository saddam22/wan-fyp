import { notFound } from "next/navigation";
import { mockApi } from "@edukhata/contracts";
import { ManualPayment } from "@/components/dash/ManualPayment";
import { PageHeader } from "@/components/ui";

export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const p = mockApi.payment((await params).id);
  if (!p) notFound();
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Payments", href: "/guardian/payments" }, { label: p.invoiceNo }]}
        title="Complete payment"
        sub="Send money, then enter your transaction ID for verification."
      />
      <ManualPayment payment={p} backHref="/guardian/payments" />
    </>
  );
}
