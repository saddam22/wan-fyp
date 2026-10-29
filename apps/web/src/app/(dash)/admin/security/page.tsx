import { SuperAdminOnly } from "@/components/dash/AreaLayout";
import { SecurityPanel } from "@/components/dash/admin-content";
import { PageHeader } from "@/components/ui";

export default function AdminSecurity() {
  return (
    <>
      <SuperAdminOnly path="/admin/security">
        <PageHeader title="Security Monitoring" />
        <SecurityPanel />
      </SuperAdminOnly>
    </>
  );
}
