import { ApiProblem } from "@/components/dash/ApiProblem";
import { LiveGuardianLinks, type LiveGuardian } from "@/components/dash/guardian-live";
import { StudentProfile } from "@/components/dash/StudentProfile";
import { PageHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";

async function guardianLinks() {
  const [g, c] = await Promise.all([apiFetch("/me/guardians"), apiFetch("/me/guardian-code")]);
  if (!g.ok || !c.ok) return <ApiProblem status={g.ok ? c.status : g.status} />;
  const code = (await c.json()) as { expiresAt: string | null };
  return (
    <LiveGuardianLinks
      guardians={(await g.json()) as LiveGuardian[]}
      codeExpiresAt={code.expiresAt}
    />
  );
}

export default async function StudentProfilePage() {
  return (
    <>
      <PageHeader title="Profile" />
      <StudentProfile {...(authMode() === "wan" ? { guardianLinks: await guardianLinks() } : {})} />
    </>
  );
}
