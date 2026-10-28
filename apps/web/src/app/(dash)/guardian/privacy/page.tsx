import { ShieldCheck } from "lucide-react";
import { fixtures } from "@edukhata/contracts";
import { Card, CardHeader, PageHeader } from "@/components/ui";

export default function GuardianPrivacy() {
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
            {fixtures.children.map((c) => (
              <tr key={c.studentId}>
                <td className="px-4 py-3 font-semibold">{c.name}</td>
                {[
                  c.permissions.viewOrders,
                  c.permissions.viewPayments,
                  c.permissions.payOnBehalf,
                ].map((v, i) => (
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
