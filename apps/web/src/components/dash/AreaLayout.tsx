import { redirect } from "next/navigation";
import { canAccess, type Area } from "@edukhata/contracts";
import { getSession } from "@/lib/session";
import { Forbidden } from "./Forbidden";
import { LiveCalls } from "./LiveCalls";
import { DashboardShell } from "./Shell";

/**
 * Renders a dashboard area for the signed-in person. The web app only decides what to
 * show; the API enforces the same role rules on every request.
 */
export async function AreaLayout({ area, children }: { area: Area; children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect(`/login?next=/${area}`);
  // Profile gate: nobody uses a dashboard before finishing onboarding.
  if (!session.onboardingComplete) redirect("/onboarding");
  if (!canAccess(session.roles, `/${area}`)) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-4">
        <Forbidden />
      </div>
    );
  }
  const live = session.mode === "wan";
  const shell = (
    <DashboardShell area={area} user={session} live={live}>
      {children}
    </DashboardShell>
  );
  // Signed in with WAN ID: calls can ring on any dashboard page.
  return live ? <LiveCalls>{shell}</LiveCalls> : shell;
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
