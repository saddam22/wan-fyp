import { fixtures } from "@edukhata/contracts";
import { NotificationsList } from "@/components/dash/Notifications";
import { PageHeader } from "@/components/ui";

export default function StudentNotifications() {
  return (
    <>
      <PageHeader title="Notifications" />
      <NotificationsList items={fixtures.notifications} />
    </>
  );
}
