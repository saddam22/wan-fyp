import { MentorVerificationLive, type VStatus } from "@/components/dash/live-trust";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";
import { BadgeCheck } from "lucide-react";
import { VerificationDocs } from "@/components/dash/mentor";
import { Card, PageHeader } from "@/components/ui";

export default async function MentorVerification() {
  if (authMode() === "wan") {
    const res = await apiFetch("/mentor/verification");
    if (!res.ok) return <ApiProblem status={res.status} />;
    return (
      <>
        <PageHeader
          title="Verification"
          sub="Identity and qualification review by EduKhata staff."
        />
        <MentorVerificationLive status={(await res.json()) as VStatus} />
      </>
    );
  }
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
