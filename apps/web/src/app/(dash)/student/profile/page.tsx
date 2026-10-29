import { StudentProfileLive, type StudentProfileData } from "@/components/dash/live-site";
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
  if (authMode() === "wan") {
    const [p, me, cat] = await Promise.all([
      apiFetch("/me/student-profile"),
      apiFetch("/me"),
      apiFetch("/catalog"),
    ]);
    if (!p.ok || !me.ok || !cat.ok)
      return <ApiProblem status={[p, me, cat].find((r) => !r.ok)!.status} />;
    const { user } = (await me.json()) as { user: { name: string } };
    const { subjects } = (await cat.json()) as { subjects: { id: string; name: string }[] };
    return (
      <>
        <PageHeader title="Profile" />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <StudentProfileLive
            initial={(await p.json()) as StudentProfileData}
            name={user.name}
            subjects={subjects}
          />
          <div>{await guardianLinks()}</div>
        </div>
      </>
    );
  }
  return (
    <>
      <PageHeader title="Profile" />
      <StudentProfile {...(authMode() === "wan" ? { guardianLinks: await guardianLinks() } : {})} />
    </>
  );
}
