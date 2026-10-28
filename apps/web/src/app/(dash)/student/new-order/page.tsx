import { Suspense } from "react";
import { OrderWizard } from "@/components/order/OrderWizard";
import { PageHeader, Skeleton } from "@/components/ui";

export default function StudentNewOrder() {
  return (
    <>
      <PageHeader
        title="New order"
        sub="Describe your assignment — you'll see the price before paying."
      />
      <Suspense fallback={<Skeleton className="h-[480px]" />}>
        <OrderWizard />
      </Suspense>
    </>
  );
}
