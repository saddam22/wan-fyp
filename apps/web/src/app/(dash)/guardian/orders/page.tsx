import { LiveOrderList } from "@/components/dash/LiveOrders";
import { authMode } from "@/lib/auth-mode";
import { mockApi } from "@edukhata/contracts";
import { OrdersTable } from "@/components/dash/OrdersTable";
import { Card, PageHeader } from "@/components/ui";

export default function GuardianOrders() {
  return (
    <>
      <PageHeader
        title="Orders"
        sub={
          authMode() === "wan"
            ? "Orders of children who allow you to see them."
            : "Orders of children who allow you to see them. Mehjabin's orders are hidden (she hasn't allowed it)."
        }
      />
      {authMode() === "wan" ? (
        <LiveOrderList as="guardian" base="/guardian/orders" view="student" />
      ) : (
        <Card>
          <OrdersTable
            orders={mockApi.orders("all", "s2")}
            base="/guardian/orders"
            view="student"
          />
        </Card>
      )}
    </>
  );
}
