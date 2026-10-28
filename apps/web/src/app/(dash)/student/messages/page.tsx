import { Suspense } from "react";
import { fixtures } from "@edukhata/contracts";
import { ChatView } from "@/components/dash/Chat";
import { PageHeader, Skeleton } from "@/components/ui";

export default function StudentMessages() {
  return (
    <>
      <PageHeader title="Messages" sub="Order conversations with your mentors and support." />
      <Suspense fallback={<Skeleton className="h-[480px]" />}>
        <ChatView conversations={fixtures.conversations} />
      </Suspense>
    </>
  );
}
