import { fixtures } from "@edukhata/contracts";
import { UsersTable } from "@/components/dash/admin-people";
import { PageHeader } from "@/components/ui";
import { getSession } from "@/lib/session";

export default async function AdminUsers() {
  const session = await getSession();
  return (
    <>
      <PageHeader title="Users" sub="All EduKhata users and their marketplace roles." />
      <UsersTable users={fixtures.users} canGrantStaff={!!session?.roles.includes("super_admin")} />
    </>
  );
}
