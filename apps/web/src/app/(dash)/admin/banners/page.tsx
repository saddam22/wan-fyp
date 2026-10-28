import { BannersManager } from "@/components/dash/admin-content";
import { PageHeader } from "@/components/ui";

export default function AdminBanners() {
  return (
    <>
      <PageHeader title="Homepage Banners" />
      <BannersManager />
    </>
  );
}
