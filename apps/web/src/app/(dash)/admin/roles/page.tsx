import { SuperAdminOnly } from "@/components/dash/AreaLayout";
import { RolesMatrix } from "@/components/dash/admin-people";
import { PageHeader } from "@/components/ui";

export default function AdminRoles() {
  return (
    <>
      <SuperAdminOnly path="/admin/roles">
        <PageHeader title="Roles & Permissions" />
        <RolesMatrix />
      </SuperAdminOnly>
    </>
  );
}
