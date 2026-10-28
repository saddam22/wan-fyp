"use client";

import { Gift, Link2, Share2, Users, Wallet } from "lucide-react";
import { formatDate, formatMoney, type ReferralSummary } from "@edukhata/contracts";
import { Badge, Card, CardHeader, StatCard } from "@/components/ui";
import { CopyButton, useDemoToast } from "@/components/ui/client";
import { useT } from "@/lib/i18n/client";

export function ReferralPanel({ r }: { r: ReferralSummary }) {
  const { lang } = useT();
  const demo = useDemoToast();
  const bdt = (m: number) => formatMoney({ amountMinor: m, currency: "BDT" }, lang);
  return (
    <div className="space-y-5">
      <Card className="grid gap-5 overflow-hidden p-5 md:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-lg font-extrabold">
            <Gift className="text-danger" /> Invite friends, earn rewards
          </p>
          <p className="text-sm text-muted">{r.rewardRule}</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg border border-dashed border-[var(--color-accent)] bg-[var(--color-accent-50)] px-3 py-2 font-mono font-bold">
              {r.code}
            </span>
            <CopyButton text={r.code} label="Copy code" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex min-w-0 items-center gap-1 truncate rounded-lg bg-slate-50 px-3 py-2 text-xs">
              <Link2 size={13} /> {r.link}
            </span>
            <CopyButton text={r.link} label="Copy link" />
            <button
              onClick={() => demo("Share sheet opened")}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-[var(--color-accent)] ring-1 ring-line"
            >
              <Share2 size={13} /> Share
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 md:w-80">
          <StatCard label="Invited" value={r.invited} icon={<Users size={18} />} tone="blue" />
          <StatCard label="Ordered" value={r.converted} icon={<Users size={18} />} tone="green" />
          <StatCard
            label="Earned"
            value={bdt(r.earnedMinor)}
            icon={<Wallet size={18} />}
            tone="violet"
          />
          <StatCard
            label="Pending"
            value={bdt(r.pendingMinor)}
            icon={<Wallet size={18} />}
            tone="amber"
          />
        </div>
      </Card>
      <Card>
        <CardHeader
          title="Referral history"
          sub="Rewards are recorded in the reward ledger after the friend's first order is completed."
        />
        <ul className="divide-y divide-line">
          {r.history.map((h) => (
            <li
              key={h.name + h.at}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-semibold">{h.name}</p>
                <p className="text-xs text-muted">{formatDate(h.at, lang)}</p>
              </div>
              <Badge
                tone={h.status === "rewarded" ? "green" : h.status === "ordered" ? "amber" : "gray"}
              >
                {h.status === "rewarded"
                  ? "Rewarded"
                  : h.status === "ordered"
                    ? "Order in progress"
                    : "Joined"}
              </Badge>
              <span className="w-20 text-right font-semibold">
                {h.rewardMinor ? bdt(h.rewardMinor) : "—"}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
