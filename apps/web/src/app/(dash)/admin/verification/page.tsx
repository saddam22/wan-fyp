import { VerificationQueue } from "@/components/dash/admin-people";
import { PageHeader } from "@/components/ui";

export default function AdminVerification() {
  return (
    <>
      <PageHeader
        title="Verification Queue"
        sub="Identity, qualification and institution documents."
      />
      <VerificationQueue />
    </>
  );
}
