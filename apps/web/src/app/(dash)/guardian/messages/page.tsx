import { LiveMessages } from "@/components/dash/MessagesPage";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { authMode } from "@/lib/auth-mode";

export default function GuardianMessages() {
  return (
    <>
      <PageHeader
        title="Support chat"
        sub="Talk to EduKhata support. You never see your child's own conversations."
      />
      {authMode() === "wan" ? (
        <LiveMessages />
      ) : (
        <Card>
          <EmptyState
            title="No conversations"
            body="Sign in with your WAN ID to chat with EduKhata support."
          />
        </Card>
      )}
    </>
  );
}
