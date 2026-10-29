import { fixtures } from "@edukhata/contracts";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { LiveUsersTable, type LiveUser } from "@/components/dash/admin-live";
import { UsersTable } from "@/components/dash/admin-people";
import { PageHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";
import { getSession } from "@/lib/session";

export default async function AdminUsers() {
  const session = await getSession();
  const isSuper = !!session?.roles.includes("super_admin");
  const header = (
    <PageHeader
      title="Users"
      sub="Everyone who has signed in to EduKhata with WAN ID, and their marketplace roles."
    />
  );
  if (authMode() === "demo") {
    return (
      <>
        {header}
        <UsersTable users={fixtures.users} canGrantStaff={isSuper} />
      </>
    );
  }
  const [res, me] = await Promise.all([apiFetch("/admin/users"), apiFetch("/me")]);
  if (!res.ok)
    return (
      <>
        {header}
        <ApiProblem status={res.status} />
      </>
    );
  const meId = me.ok ? ((await me.json()) as { user: { id: string } }).user.id : undefined;
  return (
    <>
      {header}
      <LiveUsersTable
        users={(await res.json()) as LiveUser[]}
        canGrantStaff={isSuper}
        {...(meId ? { meId } : {})}
      />
    </>
  );
}
