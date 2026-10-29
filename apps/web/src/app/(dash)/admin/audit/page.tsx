import { fixtures } from "@edukhata/contracts";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { LiveAuditTable, type LiveAuditEntry } from "@/components/dash/admin-live";
import { SuperAdminOnly } from "@/components/dash/AreaLayout";
import { AuditTable } from "@/components/dash/AuditTable";
import { PageHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";

export default async function AdminAudit() {
  const live = authMode() === "wan";
  const res = live ? await apiFetch("/admin/audit") : null;
  return (
    <SuperAdminOnly path="/admin/audit">
      <PageHeader
        title="Audit Log"
        sub={live ? "Sign-ins, onboarding, role and status changes, access decisions." : undefined}
      />
      {!live ? (
        <AuditTable entries={fixtures.auditLog} />
      ) : res!.ok ? (
        <LiveAuditTable entries={(await res!.json()) as LiveAuditEntry[]} />
      ) : (
        <ApiProblem status={res!.status} />
      )}
    </SuperAdminOnly>
  );
}
