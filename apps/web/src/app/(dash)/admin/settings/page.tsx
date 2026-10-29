import { LiveSettingsForm, type LiveSettings } from "@/components/dash/admin-market";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";
import { SuperAdminOnly } from "@/components/dash/AreaLayout";
import { SettingsForm } from "@/components/dash/admin-content";
import { PageHeader } from "@/components/ui";

async function LiveRules() {
  const res = await apiFetch("/admin/settings");
  if (!res.ok) return <ApiProblem status={res.status} />;
  return (
    <>
      <p className="mb-3 text-sm text-muted">Marketplace rules. Changes apply to new orders.</p>
      <LiveSettingsForm settings={(await res.json()) as LiveSettings} />
    </>
  );
}

export default function AdminSettings() {
  return (
    <>
      <SuperAdminOnly path="/admin/settings">
        <PageHeader title="System Settings" />
        {authMode() === "wan" ? <LiveRules /> : <SettingsForm />}
      </SuperAdminOnly>
    </>
  );
}
