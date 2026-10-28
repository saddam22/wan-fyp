import { fixtures } from "@edukhata/contracts";
import { OrdersTable } from "@/components/dash/OrdersTable";
import { Card } from "@/components/ui";
import { PageHeader } from "@/components/ui";

export default function AdminOrders() {
  return (
    <>
      <PageHeader title="Orders" sub="All orders, with manual assignment and cancellation." />
      <Card>
        <OrdersTable orders={fixtures.orders} base="/admin/orders" view="staff" />
      </Card>
    </>
  );
}
