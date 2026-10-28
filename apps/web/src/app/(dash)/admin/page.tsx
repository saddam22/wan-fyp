import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  ClipboardList,
  GraduationCap,
  Percent,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { fixtures, formatMoney } from "@edukhata/contracts";
import { BarChart, HBars } from "@/components/dash/Charts";
import { OrdersTable } from "@/components/dash/OrdersTable";
import { Card, CardHeader, StatCard } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { getSession } from "@/lib/session";

export default async function AdminHome() {
  const { lang } = await getT();
  const session = await getSession();
  const isSuper = session?.roles.includes("super_admin");
  const m = (x: number) => formatMoney({ amountMinor: x * 100, currency: "BDT" }, lang);
  const oct = fixtures.revenueSeries.at(-1)!;
  const queues: [string, number, string][] = [
    [
      "Payments to verify",
      fixtures.payments.filter((p) => p.status === "submitted").length,
      "/admin/payments",
    ],
    [
      "Mentor applications",
      fixtures.mentorApplications.filter((a) => a.status === "pending").length,
      "/admin/mentors",
    ],
    [
      "Open disputes",
      fixtures.disputes.filter((d) => d.status === "under_review").length,
      "/admin/disputes",
    ],
    [
      "Payout requests",
      fixtures.payouts.filter((p) => p.status === "requested").length,
      "/admin/payouts",
    ],
    [
      "Reviews to moderate",
      fixtures.reviews.filter((r) => r.status === "pending").length,
      "/admin/reviews",
    ],
    [
      "Escalated tickets",
      fixtures.tickets.filter((t) => t.status === "escalated").length,
      "/support-desk/escalations",
    ],
  ];
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{isSuper ? "Super Admin" : "Admin"} overview</h1>
        <p className="text-sm text-muted">Marketplace health at a glance. Demo figures.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Total users"
          value="55,240"
          delta="+1,120 this month"
          icon={<Users size={20} />}
          tone="blue"
          href="/admin/users"
        />
        <StatCard
          label="Students"
          value="50,000"
          icon={<GraduationCap size={20} />}
          tone="violet"
          href="/admin/students"
        />
        <StatCard
          label="Verified mentors"
          value="5,000"
          icon={<UserCheck size={20} />}
          tone="green"
          href="/admin/mentors"
        />
        <StatCard
          label="Orders (Oct)"
          value="3,412"
          delta="98% on time"
          icon={<ClipboardList size={20} />}
          tone="amber"
          href="/admin/orders"
        />
        <StatCard label="GMV (Oct)" value={m(oct.gmv)} icon={<Wallet size={20} />} tone="teal" />
        <StatCard
          label="Commission (Oct)"
          value={m(oct.commission)}
          icon={<Percent size={20} />}
          tone="green"
        />
        <StatCard
          label="Disputes open"
          value={fixtures.disputes.filter((d) => d.status === "under_review").length}
          icon={<AlertTriangle size={20} />}
          tone="red"
          href="/admin/disputes"
        />
        <StatCard
          label="Payments pending"
          value={fixtures.payments.filter((p) => p.status === "submitted").length}
          icon={<BadgeCheck size={20} />}
          tone="amber"
          href="/admin/payments"
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader title="Revenue" sub="Order value and commission · BDT" />
          <div className="p-5">
            <BarChart
              data={fixtures.revenueSeries.map((r) => ({
                label: r.label,
                values: [r.gmv, r.commission],
              }))}
              series={["Order value (GMV)", "Commission"]}
            />
          </div>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Work queues" />
            <ul className="divide-y divide-line">
              {queues.map(([l, n, h]) => (
                <li key={l}>
                  <Link
                    href={h}
                    className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-slate-50"
                  >
                    <span>{l}</span>
                    <span
                      className={
                        n
                          ? "rounded-full bg-danger px-2 text-xs font-bold text-white"
                          : "text-muted"
                      }
                    >
                      {n}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Active orders by status" />
            <div className="p-5">
              <HBars data={fixtures.orderStatusMix} color="var(--color-danger)" />
            </div>
          </Card>
        </div>
      </div>
      <Card>
        <CardHeader
          title="Latest orders"
          action={
            <Link href="/admin/orders" className="font-semibold text-danger">
              All orders
            </Link>
          }
        />
        <OrdersTable
          orders={fixtures.orders}
          base="/admin/orders"
          view="staff"
          tabs={false}
          pageSize={5}
        />
      </Card>
    </div>
  );
}
