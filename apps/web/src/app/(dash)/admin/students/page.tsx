import { fixtures } from "@edukhata/contracts";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { LiveUsersTable, type LiveUser } from "@/components/dash/admin-live";
import { UsersTable } from "@/components/dash/admin-people";
import { PageHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";

export default async function AdminStudents() {
  const header = <PageHeader title="Students" />;
  if (authMode() === "demo")
    return (
      <>
        {header}
        <UsersTable users={fixtures.users} canGrantStaff={false} only="student" />
      </>
    );
  const res = await apiFetch("/admin/users?role=student");
  if (!res.ok)
    return (
      <>
        {header}
        <ApiProblem status={res.status} />
      </>
    );
  return (
    <>
      {header}
      <LiveUsersTable users={(await res.json()) as LiveUser[]} canGrantStaff={false} />
    </>
  );
}
