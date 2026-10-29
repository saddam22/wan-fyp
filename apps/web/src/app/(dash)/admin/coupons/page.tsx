import { CouponsAdmin, type Coupon } from "@/components/dash/live-trust";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";
import { fixtures } from "@edukhata/contracts";
import { CouponsManager } from "@/components/dash/admin-content";
import { PageHeader } from "@/components/ui";

export default async function AdminCoupons() {
  if (authMode() === "wan") {
    const res = await apiFetch("/admin/coupons");
    if (!res.ok) return <ApiProblem status={res.status} />;
    return (
      <>
        <PageHeader title="Coupons & Discounts" />
        <CouponsAdmin items={(await res.json()) as Coupon[]} />
      </>
    );
  }
  return (
    <>
      <PageHeader title="Coupons & Discounts" />
      <CouponsManager coupons={fixtures.coupons} />
    </>
  );
}
