import { formatDate } from "@edukhata/contracts";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { ReferralConfig } from "@/components/dash/admin-content";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";

interface Attribution {
  referrer: string;
  referred: string;
  code: string;
  source: "link" | "code";
  at: string;
}

async function Attributions() {
  const res = await apiFetch("/admin/referrals");
  if (!res.ok) return <ApiProblem status={res.status} />;
  const rows = (await res.json()) as Attribution[];
  return (
    <Card className="mt-5">
      <CardHeader
        title="Who referred whom"
        sub="Set once, when a person first joins EduKhata. Rewards start with payments."
      />
      {rows.length === 0 ? (
        <EmptyState title="No referrals yet" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-muted uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Referrer</th>
                <th className="px-4 py-2 text-left">Joined</th>
                <th className="px-4 py-2 text-left">Code</th>
                <th className="px-4 py-2 text-left">Via</th>
                <th className="px-4 py-2 text-left">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={`${r.code}-${r.referred}-${r.at}`}>
                  <td className="px-4 py-3 font-semibold">{r.referrer}</td>
                  <td className="px-4 py-3">{r.referred}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.code}</td>
                  <td className="px-4 py-3">{r.source === "link" ? "Link" : "Typed code"}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(r.at, "en", true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function AdminReferrals() {
  return (
    <>
      <PageHeader title="Referral Configuration" />
      <ReferralConfig />
      {authMode() === "wan" && <Attributions />}
    </>
  );
}
