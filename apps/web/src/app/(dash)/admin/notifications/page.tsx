import { NotificationBroadcast } from "@/components/dash/admin-content";
import { NotificationsPage } from "@/components/dash/NotificationsPage";
import { PageHeader } from "@/components/ui";

export default function AdminNotifications() {
  return (
    <>
      <NotificationsPage title="My notifications" />
      <div className="mt-8">
        <PageHeader title="Broadcast" sub="Send an announcement to a group of people." />
        <NotificationBroadcast />
      </div>
    </>
  );
}
