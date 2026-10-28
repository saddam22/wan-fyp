import { NotificationBroadcast } from "@/components/dash/admin-content";
import { PageHeader } from "@/components/ui";

export default function AdminNotifications() {
  return (
    <>
      <PageHeader title="Notifications" />
      <NotificationBroadcast />
    </>
  );
}
