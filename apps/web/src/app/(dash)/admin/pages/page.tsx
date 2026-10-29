import { PagesCMS } from "@/components/dash/admin-content";
import { PageHeader } from "@/components/ui";

export default function AdminPages() {
  return (
    <>
      <PageHeader title="Pages (CMS)" />
      <PagesCMS />
    </>
  );
}
