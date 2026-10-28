import Link from "next/link";
import { CheckCircle2, ClipboardList, CreditCard, Gift, Plus } from "lucide-react";
import { fixtures, formatMoney, mockApi } from "@edukhata/contracts";
import { OrderStatusBadge, OrdersTable } from "@/components/dash/OrdersTable";
import { MentorCard } from "@/components/public/MentorCard";
import { Avatar, ButtonLink, Card, CardHeader, Progress, StatCard } from "@/components/ui";
import { Countdown } from "@/components/ui/client";
import { getT } from "@/lib/i18n/server";

export default async function StudentHome() {
  const { lang } = await getT();
  const me = fixtures.me;
  const mine = mockApi.orders("all", me.id);
  const current = mine.find((o) => o.status === "in_progress")!;
  const pendingPay = fixtures.payments.filter(
    (p) => p.payerName === me.name && p.status === "pending",
  );
  return (
    <div className="space-y-5">
      <Card className="flex flex-col gap-4 overflow-hidden bg-gradient-to-r from-brand-600 to-indigo-600 p-5 text-white sm:flex-row sm:items-center">
        <Avatar name={me.name} hue={me.hue} size={56} className="ring-4 ring-white/30" />
        <div className="flex-1">
          <h1 className="text-xl font-extrabold">Welcome back, {me.name.split(" ")[0]} 👋</h1>
          <p className="text-sm text-blue-100">
            {me.classLevel} · {me.institution}
          </p>
          <div className="mt-2 flex max-w-xs items-center gap-2 text-xs text-blue-100">
            Profile {me.profileCompletion}%{" "}
            <Progress value={me.profileCompletion} tone="amber" className="bg-white/20" />
          </div>
        </div>
        <ButtonLink href="/student/new-order" variant="white">
          <Plus size={16} /> New order
        </ButtonLink>
      </Card>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Active orders"
          value={
            mine.filter((o) =>
              ["assigned", "in_progress", "delivered", "revision_requested", "matching"].includes(
                o.status,
              ),
            ).length
          }
          icon={<ClipboardList size={20} />}
          tone="blue"
          href="/student/orders"
        />
        <StatCard
          label="Awaiting payment"
          value={pendingPay.length}
          icon={<CreditCard size={20} />}
          tone="amber"
          href="/student/payments"
        />
        <StatCard
          label="Completed"
          value={mine.filter((o) => o.status === "closed").length}
          icon={<CheckCircle2 size={20} />}
          tone="green"
        />
        <StatCard
          label="Referral earnings"
          value={formatMoney({ amountMinor: fixtures.referral.earnedMinor, currency: "BDT" }, lang)}
          icon={<Gift size={20} />}
          tone="violet"
          href="/student/referrals"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader
            title="Current order"
            action={
              <Link
                href={`/student/orders/${current.id}`}
                className="font-semibold text-brand-600 hover:underline"
              >
                Open →
              </Link>
            }
          />
          <div className="grid gap-5 p-5 md:grid-cols-[1fr_auto]">
            <div className="min-w-0 space-y-2">
              <p className="font-semibold">{current.title}</p>
              <p className="text-xs text-muted">
                {current.code} · Mentor: {current.mentorName}
              </p>
              <OrderStatusBadge status={current.status} />
              <ol className="mt-3 flex items-center gap-1 text-[10px] font-semibold text-muted sm:text-[11px]">
                {["Placed", "Paid", "Assigned", "Working", "Delivered", "Approved"].map((s, i) => (
                  <li key={s} className="flex flex-1 flex-col items-center gap-1">
                    <span
                      className={`h-1.5 w-full rounded-full ${i <= 3 ? "bg-brand-600" : "bg-slate-200"}`}
                    />
                    {s}
                  </li>
                ))}
              </ol>
            </div>
            <Countdown deadline={current.deadline} label="Delivery in" />
          </div>
        </Card>
        <Card>
          <CardHeader
            title="Notifications"
            action={
              <Link
                href="/student/notifications"
                className="font-semibold text-brand-600 hover:underline"
              >
                All
              </Link>
            }
          />
          <ul className="divide-y divide-line">
            {fixtures.notifications.slice(0, 4).map((n) => (
              <li key={n.id} className="px-4 py-2.5">
                <p className="text-sm font-semibold">{n.title}</p>
                <p className="truncate text-xs text-muted">{n.body}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Recent orders"
          action={
            <Link href="/student/orders" className="font-semibold text-brand-600 hover:underline">
              View all
            </Link>
          }
        />
        <OrdersTable
          orders={mine.slice(0, 5)}
          base="/student/orders"
          view="student"
          tabs={false}
          pageSize={5}
        />
      </Card>

      <section>
        <h2 className="mb-3 font-bold">Recommended for your subjects</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {mockApi
            .mentors()
            .filter((m) => m.subjects.some((s) => me.subjects.includes(s)))
            .slice(0, 4)
            .map((m) => (
              <MentorCard key={m.id} m={m} />
            ))}
        </div>
      </section>
    </div>
  );
}
