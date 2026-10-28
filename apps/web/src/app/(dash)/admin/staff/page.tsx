import { SuperAdminOnly } from "@/components/dash/AreaLayout";
import { StaffList } from "@/components/dash/admin-people";
import { PageHeader } from "@/components/ui";

export default function AdminStaff() {
  return (
    <>
      <SuperAdminOnly path="/admin/staff">
        <PageHeader
          title="Staff"
          sub="Admins, accountants and supporters. Only super admins can grant staff roles."
        />
        <StaffList />
      </SuperAdminOnly>
    </>
  );
}
