import { Plus } from "lucide-react";
import { fixtures, mockApi } from "@edukhata/contracts";
import { OrdersTable } from "@/components/dash/OrdersTable";
import { ButtonLink, Card, PageHeader } from "@/components/ui";

export default function StudentOrders() {
  return (
    <>
      <PageHeader
        title="My Orders"
        sub="Track progress, review deliveries and request revisions."
        actions={
          <ButtonLink href="/student/new-order" variant="accent">
            <Plus size={16} /> New order
          </ButtonLink>
        }
      />
      <Card>
        <OrdersTable
          orders={mockApi.orders("all", fixtures.me.id)}
          base="/student/orders"
          view="student"
        />
      </Card>
    </>
  );
}
