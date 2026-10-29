import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, Ticket } from "lucide-react";
import { fixtures } from "@edukhata/contracts";
import { HBars } from "@/components/dash/Charts";
import { TicketQueue } from "@/components/dash/support";
import { Card, CardHeader, StatCard } from "@/components/ui";

export default function SupportHome() {
  const t = fixtures.tickets;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Support desk</h1>
        <p className="text-sm text-muted">
          Help students and mentors quickly; escalate money decisions to admins.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Open"
          value={t.filter((x) => x.status === "open").length}
          icon={<Ticket size={20} />}
          tone="blue"
          href="/support-desk/tickets"
        />
        <StatCard
          label="Pending reply"
          value={t.filter((x) => x.status === "pending").length}
          icon={<Clock size={20} />}
          tone="amber"
        />
        <StatCard
          label="Escalated"
          value={t.filter((x) => x.status === "escalated").length}
          icon={<AlertTriangle size={20} />}
          tone="red"
          href="/support-desk/escalations"
        />
        <StatCard
          label="Resolved (7 days)"
          value={t.filter((x) => x.status === "resolved" || x.status === "closed").length}
          icon={<CheckCircle2 size={20} />}
          tone="green"
          href="/support-desk/history"
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold">Needs attention</h2>
            <Link
              href="/support-desk/tickets"
              className="text-sm font-semibold text-[var(--color-accent)]"
            >
              All tickets
            </Link>
          </div>
          <TicketQueue
            tickets={t.filter((x) => ["open", "pending", "escalated"].includes(x.status))}
          />
        </div>
        <Card>
          <CardHeader title="Tickets by category" sub="Last 30 days" />
          <div className="p-5">
            <HBars
              color="var(--color-support)"
              data={[
                { label: "Order", value: 42 },
                { label: "Payment", value: 31 },
                { label: "Account", value: 12 },
                { label: "Mentor", value: 9 },
                { label: "Complaint", value: 7 },
                { label: "Technical", value: 6 },
              ]}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
