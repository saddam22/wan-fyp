import { fixtures, mockApi } from "@edukhata/contracts";
import { OrdersTable } from "@/components/dash/OrdersTable";
import { Card, PageHeader } from "@/components/ui";

export default function MentorOrders() {
  return (
    <>
      <PageHeader
        title="My Orders"
        sub="Deliver on time, handle revisions and chat with students."
      />
      <Card>
        <OrdersTable
          orders={mockApi.mentorOrders(fixtures.meMentor.id)}
          base="/mentor/orders"
          view="mentor"
        />
      </Card>
    </>
  );
}
