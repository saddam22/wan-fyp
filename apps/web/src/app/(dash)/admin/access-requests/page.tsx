import { ApiProblem } from "@/components/dash/ApiProblem";
import { LiveAccessRequests, type LiveAccessRequest } from "@/components/dash/admin-live";
import { DemoNote, PageHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";

export default async function AdminAccessRequests() {
  const header = (
    <PageHeader
      title="Access Requests"
      sub="Requests for EduKhata access made in WAN Identity Hub. Your decision is recorded there and the person is notified."
    />
  );
  if (authMode() === "demo")
    return (
      <>
        {header}
        <DemoNote>
          Demo mode: access requests come from WAN Identity Hub when AUTH_MODE=wan.
        </DemoNote>
      </>
    );
  const res = await apiFetch("/admin/access-requests");
  if (!res.ok)
    return (
      <>
        {header}
        <ApiProblem
          status={res.status === 502 ? "502 (WAN Identity Hub unreachable)" : res.status}
        />
      </>
    );
  return (
    <>
      {header}
      <LiveAccessRequests requests={(await res.json()) as LiveAccessRequest[]} />
    </>
  );
}
