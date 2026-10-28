import { fixtures } from "@edukhata/contracts";
import { SuperAdminOnly } from "@/components/dash/AreaLayout";
import { AuditTable } from "@/components/dash/AuditTable";
import { PageHeader } from "@/components/ui";

export default function AdminAudit() {
  return (
    <>
      <SuperAdminOnly path="/admin/audit">
        <PageHeader title="Audit Log" />
        <AuditTable entries={fixtures.auditLog} />
      </SuperAdminOnly>
    </>
  );
}
