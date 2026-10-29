import { fixtures } from "@edukhata/contracts";
import { AuditTable } from "@/components/dash/AuditTable";
import { PageHeader } from "@/components/ui";

export default function AccountantAudit() {
  return (
    <>
      <PageHeader
        title="Financial Audit History"
        sub="Every money decision with who, when and from where."
      />
      <AuditTable
        entries={fixtures.auditLog.filter(
          (a) =>
            a.action.startsWith("payment") ||
            a.action.startsWith("payout") ||
            a.action.startsWith("settings"),
        )}
      />
    </>
  );
}
