import { LiveOrderList } from "@/components/dash/LiveOrders";
import { authMode } from "@/lib/auth-mode";
import { fixtures } from "@edukhata/contracts";
import { OrdersTable } from "@/components/dash/OrdersTable";
import { Card, PageHeader } from "@/components/ui";

export default function SupportOrders() {
  return (
    <>
      <PageHeader title="Order Lookup" sub="Read-only. Search by code, student or mentor." />
      {authMode() === "wan" ? (
        <LiveOrderList as="staff" base="/support-desk/orders" view="staff" />
      ) : (
        <Card>
          <OrdersTable orders={fixtures.orders} base="/support-desk/orders" view="staff" />
        </Card>
      )}
    </>
  );
}
