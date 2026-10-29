import { fixtures } from "@edukhata/contracts";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { LiveNotifications, type NotificationPage } from "@/components/dash/LiveNotifications";
import { NotificationsList } from "@/components/dash/Notifications";
import { PageHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";

/** "My notifications" for any area: demo fixtures, or the person's real inbox in wan mode. */
export async function NotificationsPage({ title = "Notifications" }: { title?: string }) {
  const header = <PageHeader title={title} />;
  if (authMode() === "demo")
    return (
      <>
        {header}
        <NotificationsList items={fixtures.notifications} />
      </>
    );
  const res = await apiFetch("/me/notifications");
  return (
    <>
      {header}
      {res.ok ? (
        <LiveNotifications initial={(await res.json()) as NotificationPage} />
      ) : (
        <ApiProblem status={res.status} />
      )}
    </>
  );
}
