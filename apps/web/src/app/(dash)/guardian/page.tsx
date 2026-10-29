import Link from "next/link";
import { ClipboardList, CreditCard, Users } from "lucide-react";
import { fixtures, formatMoney, mockApi } from "@edukhata/contracts";
import { OrdersTable } from "@/components/dash/OrdersTable";
import { Avatar, Card, CardHeader, StatCard } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export default async function GuardianHome() {
  const { lang } = await getT();
  const kids = fixtures.children;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Hello, Shirin Akter</h1>
        <p className="text-sm text-muted">
          Overview of your linked children&apos;s orders and payments.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Linked children"
          value={kids.length}
          icon={<Users size={20} />}
          tone="teal"
          href="/guardian/children"
        />
        <StatCard
          label="Active orders"
          value={kids.reduce((s, k) => s + k.activeOrders, 0)}
          icon={<ClipboardList size={20} />}
          tone="blue"
          href="/guardian/orders"
        />
        <StatCard
          label="Total spent"
          value={formatMoney(
            {
              amountMinor: kids.reduce(
                (s, k) => s + (k.permissions.viewPayments ? k.spentMinor : 0),
                0,
              ),
              currency: "BDT",
            },
            lang,
          )}
          icon={<CreditCard size={20} />}
          tone="amber"
          href="/guardian/payments"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {kids.map((k) => (
          <Card key={k.studentId} className="flex items-center gap-3 p-4">
            <Avatar name={k.name} hue={k.studentId === "s2" ? 210 : 330} size={44} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{k.name}</p>
              <p className="text-xs text-muted">
                {k.classLevel} · {k.activeOrders} active · {k.completedOrders} completed
              </p>
            </div>
            <Link
              href="/guardian/children"
              className="text-xs font-semibold text-[var(--color-accent)]"
            >
              Details
            </Link>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader
          title="Mahfuz's orders"
          sub="Shown because Mahfuz allows you to view orders."
          action={
            <Link href="/guardian/orders" className="font-semibold text-[var(--color-accent)]">
              All
            </Link>
          }
        />
        <OrdersTable
          orders={mockApi.orders("all", "s2").slice(0, 4)}
          base="/guardian/orders"
          view="student"
          tabs={false}
          pageSize={4}
        />
      </Card>
    </div>
  );
}
