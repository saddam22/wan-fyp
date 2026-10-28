import { mockApi } from "@edukhata/contracts";
import { OrdersTable } from "@/components/dash/OrdersTable";
import { Card, PageHeader } from "@/components/ui";

export default function GuardianOrders() {
  return (
    <>
      <PageHeader
        title="Orders"
        sub="Orders of children who allow you to see them. Mehjabin's orders are hidden (she hasn't allowed it)."
      />
      <Card>
        <OrdersTable orders={mockApi.orders("all", "s2")} base="/guardian/orders" view="student" />
      </Card>
    </>
  );
}
