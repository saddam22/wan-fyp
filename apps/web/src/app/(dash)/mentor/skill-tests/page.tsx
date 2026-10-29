import { SkillTestsLive, type MentorTest } from "@/components/dash/live-trust";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";
import { fixtures } from "@edukhata/contracts";
import { SkillTests } from "@/components/dash/mentor";
import { PageHeader } from "@/components/ui";

export default async function MentorSkillTests() {
  if (authMode() === "wan") {
    const res = await apiFetch("/mentor/skill-tests");
    if (!res.ok) return <ApiProblem status={res.status} />;
    return (
      <>
        <PageHeader
          title="Skill Tests"
          sub="Pass a subject test to earn its badge. Graded by the server; answers are never shown."
        />
        <SkillTestsLive tests={(await res.json()) as MentorTest[]} />
      </>
    );
  }
  return (
    <>
      <PageHeader
        title="Skill Tests"
        sub="Pass a subject test to take orders in that subject and earn its badge."
      />
      <SkillTests tests={fixtures.skillTests} />
    </>
  );
}
