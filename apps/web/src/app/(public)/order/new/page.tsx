import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderWizard } from "@/components/order/OrderWizard";
import { PageHero } from "@/components/public/kit";
import { Skeleton } from "@/components/ui";

export const metadata: Metadata = {
  title: "Post an Assignment",
  description:
    "Tell us what you need — subject, pages, deadline — and get matched with a verified mentor.",
};

export default function NewOrderPage() {
  return (
    <>
      <PageHero
        title="Post an Assignment"
        sub="Four quick steps. You pay only after reviewing the price; the mentor is paid only after you approve the work."
        crumbs={[{ label: "Order Now" }]}
      />
      <div className="container-x py-6">
        <Suspense fallback={<Skeleton className="h-[480px]" />}>
          <OrderWizard />
        </Suspense>
      </div>
    </>
  );
}
