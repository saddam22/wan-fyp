import { notFound } from "next/navigation";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { SkillTestsAdmin, type AdminTest } from "@/components/dash/live-trust";
import { PageHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";

export default async function AdminSkillTests() {
  if (authMode() !== "wan") notFound();
  const [res, cat] = await Promise.all([apiFetch("/admin/skill-tests"), apiFetch("/catalog")]);
  if (!res.ok || !cat.ok) return <ApiProblem status={res.ok ? cat.status : res.status} />;
  const { subjects } = (await cat.json()) as { subjects: { id: string; name: string }[] };
  return (
    <>
      <PageHeader
        title="Skill Tests"
        sub="Multiple-choice tests per subject. Questions can't change once a mentor has taken the test."
      />
      <SkillTestsAdmin tests={(await res.json()) as AdminTest[]} subjects={subjects} />
    </>
  );
}
