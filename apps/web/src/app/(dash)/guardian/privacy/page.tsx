import { ShieldCheck } from "lucide-react";
import { fixtures } from "@edukhata/contracts";
import { ApiProblem } from "@/components/dash/ApiProblem";
import type { LiveChild } from "@/components/dash/guardian-live";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";

export default async function GuardianPrivacy() {
  let rows = fixtures.children.map((c) => ({ id: c.studentId, name: c.name, p: c.permissions }));
  if (authMode() === "wan") {
    const res = await apiFetch("/guardian/children");
    if (!res.ok) return <ApiProblem status={res.status} />;
    rows = ((await res.json()) as LiveChild[]).map((c) => ({
      id: c.studentId,
      name: c.name,
      p: c.permissions,
    }));
  }
  return (
    <>
      <PageHeader
        title="Privacy & Permissions"
        sub="What you can see is decided by each student."
      />
      <Card>
        <CardHeader title="Granted to you" />
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-muted uppercase">
            <tr>
              <th className="px-4 py-2 text-left">Child</th>
              <th className="px-4 py-2">Orders</th>
              <th className="px-4 py-2">Payments</th>
              <th className="px-4 py-2">Pay on behalf</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted">
                  No children linked yet.
                </td>
              </tr>
            )}
            {rows.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-semibold">{c.name}</td>
                {[c.p.viewOrders, c.p.viewPayments, c.p.payOnBehalf].map((v, i) => (
                  <td key={i} className="px-4 py-3 text-center">
                    {v ? "✓" : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card className="mt-5 flex gap-3 p-5 text-sm text-slate-700">
        <ShieldCheck className="shrink-0 text-success" />
        <p>
          Guardians never see chat messages or mentor contact details. Students can change these
          permissions or unlink a guardian at any time; changes apply immediately.
        </p>
      </Card>
    </>
  );
}
