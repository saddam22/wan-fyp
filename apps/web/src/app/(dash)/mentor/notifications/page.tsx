import { fixtures } from "@edukhata/contracts";
import { NotificationsList } from "@/components/dash/Notifications";
import { PageHeader } from "@/components/ui";

export default function MentorNotifications() {
  const items = [
    {
      id: "mn1",
      title: "New order request",
      body: "EK-24537 Biology Practical Khata — Class 10 matches your skills (97%).",
      at: fixtures.at(-0.2),
      read: false,
      tone: "info" as const,
      href: "/mentor/offers",
    },
    {
      id: "mn2",
      title: "Revision requested",
      body: "Sadia Islam asked for a revision on EK-24521.",
      at: fixtures.at(-8),
      read: false,
      tone: "warning" as const,
      href: "/mentor/orders/o7",
    },
    {
      id: "mn3",
      title: "Payout paid",
      body: "৳15,000 sent to bKash 017••••5678 (BKP0021MX).",
      at: fixtures.at(-190),
      read: true,
      tone: "success" as const,
    },
    {
      id: "mn4",
      title: "Document rejected",
      body: "Transcript image is blurred — please re-upload.",
      at: fixtures.at(-30),
      read: true,
      tone: "danger" as const,
      href: "/mentor/verification",
    },
  ];
  return (
    <>
      <PageHeader title="Notifications" />
      <NotificationsList items={items} />
    </>
  );
}
