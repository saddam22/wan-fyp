import { BadgeCheck } from "lucide-react";
import { VerificationDocs } from "@/components/dash/mentor";
import { Card, PageHeader } from "@/components/ui";

export default function MentorVerification() {
  return (
    <>
      <PageHeader title="Verification" sub="Identity and qualification review." />
      <Card className="mb-5 flex items-center gap-3 bg-green-50 p-4 text-sm text-green-900">
        <BadgeCheck className="text-success" /> You are <b>Verified</b>. Keep documents current to
        keep the badge.
      </Card>
      <VerificationDocs />
    </>
  );
}
