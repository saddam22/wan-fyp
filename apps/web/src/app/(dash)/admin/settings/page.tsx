import { SuperAdminOnly } from "@/components/dash/AreaLayout";
import { SettingsForm } from "@/components/dash/admin-content";
import { PageHeader } from "@/components/ui";

export default function AdminSettings() {
  return (
    <>
      <SuperAdminOnly path="/admin/settings">
        <PageHeader title="System Settings" />
        <SettingsForm />
      </SuperAdminOnly>
    </>
  );
}
