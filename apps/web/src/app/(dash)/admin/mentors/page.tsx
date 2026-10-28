import { fixtures } from "@edukhata/contracts";
import { MentorApplications } from "@/components/dash/admin-people";
import { PageHeader } from "@/components/ui";

export default function AdminMentors() {
  return (
    <>
      <PageHeader
        title="Mentor Applications"
        sub="Approve mentors after document review and skill test."
      />
      <MentorApplications apps={fixtures.mentorApplications} />
    </>
  );
}
