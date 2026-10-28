import { fixtures } from "@edukhata/contracts";
import { SkillTests } from "@/components/dash/mentor";
import { PageHeader } from "@/components/ui";

export default function MentorSkillTests() {
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
