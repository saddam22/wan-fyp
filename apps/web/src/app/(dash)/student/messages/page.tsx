import { LiveMessages } from "@/components/dash/MessagesPage";
import { authMode } from "@/lib/auth-mode";
import { Suspense } from "react";
import { fixtures } from "@edukhata/contracts";
import { ChatView } from "@/components/dash/Chat";
import { PageHeader, Skeleton } from "@/components/ui";

export default async function StudentMessages() {
  if (authMode() === "wan")
    return (
      <>
        <PageHeader
          title="Messages"
          sub="Talk to EduKhata support. Order chats with mentors open when orders go live."
        />
        <LiveMessages />
      </>
    );
  return (
    <>
      <PageHeader title="Messages" sub="Order conversations with your mentors and support." />
      <Suspense fallback={<Skeleton className="h-[480px]" />}>
        <ChatView conversations={fixtures.conversations} />
      </Suspense>
    </>
  );
}
