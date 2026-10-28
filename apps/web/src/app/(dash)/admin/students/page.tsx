import { fixtures } from "@edukhata/contracts";
import { UsersTable } from "@/components/dash/admin-people";
import { PageHeader } from "@/components/ui";

export default function AdminStudents() {
  return (
    <>
      <PageHeader title="Students" />
      <UsersTable users={fixtures.users} canGrantStaff={false} only="student" />
    </>
  );
}
