import Link from "next/link";
import { Banknote, ClipboardList, Star, Wallet } from "lucide-react";
import { fixtures, formatMoney, mockApi, revenueSeriesFor } from "@/lib/mentorData";
import { BarChart } from "@/components/dash/Charts";
import { AvailabilityToggle, OffersList } from "@/components/dash/mentor";
import { OrdersTable } from "@/components/dash/OrdersTable";
import { Avatar, Card, CardHeader, Progress, StatCard } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export default async function MentorHome() {
  const { lang } = await getT();
  const me = fixtures.meMentor;
  const mine = mockApi.mentorOrders(me.id);
  const e = fixtures.mentorEarnings;
  return (
    <div className="space-y-5">
      <Card className="flex flex-col gap-4 bg-gradient-to-r from-mentor to-indigo-600 p-5 text-white sm:flex-row sm:items-center">
        <Avatar name={me.name} hue={me.hue} size={56} className="ring-4 ring-white/30" />
        <div className="flex-1">
          <h1 className="text-xl font-extrabold">Welcome, {me.name} </h1>
          <p className="text-sm text-violet-100">{me.headline}</p>
          <p className="mt-1 text-xs text-violet-100">
            Rank #1 in Biology · {me.rankPoints} points · ★ {me.rating}
          </p>
        </div>
        <div className="rounded-full bg-white p-0.5">
          <AvailabilityToggle />
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Available balance"
          value={formatMoney({ amountMinor: e.availableMinor, currency: "BDT" }, lang)}
          icon={<Wallet size={20} />}
          tone="green"
          href="/mentor/earnings"
        />
        <StatCard
          label="Pending (awaiting approval)"
          value={formatMoney({ amountMinor: e.pendingMinor, currency: "BDT" }, lang)}
          icon={<Banknote size={20} />}
          tone="amber"
          href="/mentor/earnings"
        />
        <StatCard
          label="Active orders"
          value={`${me.activeOrders} / ${me.capacity}`}
          icon={<ClipboardList size={20} />}
          tone="violet"
          href="/mentor/orders"
        />
        <StatCard
          label="Rating"
          value={`${me.rating} ★`}
          delta={`${me.reviewCount} reviews`}
          icon={<Star size={20} />}
          tone="blue"
          href="/mentor/reviews"
        />
      </div>
      <Card>
        <CardHeader
          title="New order requests"
          sub="Accept before the timer ends — the first eligible mentor to accept gets the order."
          action={
            <Link href="/mentor/offers" className="font-semibold text-mentor hover:underline">
              All requests
            </Link>
          }
        />
        <OffersList offers={fixtures.offers} compact />
      </Card>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader title="Earnings (last 6 months)" />
          <div className="p-5">
            <BarChart data={revenueSeriesFor()} series={["Earned"]} />
          </div>
        </Card>
        <Card className="p-5">
          <p className="font-bold">Profile completion</p>
          <Progress value={86} tone="accent" className="mt-2" />
          <ul className="mt-3 space-y-1.5 text-sm">
            <li className="text-success">✓ Identity verified</li>
            <li className="text-success">✓ Biology & Chemistry tests passed</li>
            <li className="text-success">✓ 6 portfolio samples</li>
            <li className="text-muted">○ Re-upload transcript</li>
            <li className="text-muted">○ Add Nagad payout number</li>
          </ul>
          <Link
            href="/mentor/verification"
            className="mt-3 inline-block text-sm font-semibold text-mentor hover:underline"
          >
            Complete profile →
          </Link>
        </Card>
      </div>
      <Card>
        <CardHeader
          title="Active orders"
          action={
            <Link href="/mentor/orders" className="font-semibold text-mentor hover:underline">
              View all
            </Link>
          }
        />
        <OrdersTable orders={mine} base="/mentor/orders" view="mentor" tabs={false} pageSize={5} />
      </Card>
    </div>
  );
}
