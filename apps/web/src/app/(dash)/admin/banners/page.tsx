import { BannersAdmin, type Banner } from "@/components/dash/live-site";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";
import { BannersManager } from "@/components/dash/admin-content";
import { PageHeader } from "@/components/ui";

export default async function AdminBanners() {
  if (authMode() === "wan") {
    const res = await apiFetch("/admin/banners");
    if (!res.ok) return <ApiProblem status={res.status} />;
    return (
      <>
        <PageHeader title="Homepage Banners" />
        <BannersAdmin items={(await res.json()) as Banner[]} />
      </>
    );
  }
  return (
    <>
      <PageHeader title="Homepage Banners" />
      <BannersManager />
    </>
  );
}
