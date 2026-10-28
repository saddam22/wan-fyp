import { fixtures } from "@edukhata/contracts";
import { CouponsManager } from "@/components/dash/admin-content";
import { PageHeader } from "@/components/ui";

export default function AdminCoupons() {
  return (
    <>
      <PageHeader title="Coupons & Discounts" />
      <CouponsManager coupons={fixtures.coupons} />
    </>
  );
}
