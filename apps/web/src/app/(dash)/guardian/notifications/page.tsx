import { fixtures } from "@edukhata/contracts";
import { NotificationsList } from "@/components/dash/Notifications";
import { PageHeader } from "@/components/ui";

export default function GuardianNotifications() {
  return (
    <>
      <PageHeader title="Notifications" />
      <NotificationsList
        items={fixtures.notifications.map((n) => ({
          ...n,
          title: `Mahfuz: ${n.title}`,
          href: n.href
            ?.replace("/student/orders", "/guardian/orders")
            .replace(/\/student\/payments.*/, "/guardian/payments"),
        }))}
      />
    </>
  );
}
