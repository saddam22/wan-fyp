import { redirect } from "next/navigation";
import { canAccess, type Area } from "@edukhata/contracts";
import { getSession } from "@/lib/session";
import { Forbidden } from "./Forbidden";
import { DashboardShell } from "./Shell";

/**
 * Renders a dashboard area for the demo session. Phase 2 swaps the demo cookie for the
 * real session; the API will enforce the same role rules on every request.
 */
export async function AreaLayout({ area, children }: { area: Area; children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect(`/login?next=/${area}`);
  if (!canAccess(session.roles, `/${area}`)) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-4">
        <Forbidden />
      </div>
    );
  }
  return (
    <DashboardShell area={area} user={session}>
      {children}
    </DashboardShell>
  );
}

/** Page-level guard for super-admin-only admin pages. */
export async function SuperAdminOnly({
  path,
  children,
}: {
  path: string;
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || !canAccess(session.roles, path)) return <Forbidden inline />;
  return <>{children}</>;
}
