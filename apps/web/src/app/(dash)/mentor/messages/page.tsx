import { Suspense } from "react";
import { fixtures } from "@edukhata/contracts";
import { ChatView } from "@/components/dash/Chat";
import { PageHeader, Skeleton } from "@/components/ui";

export default function MentorMessages() {
  const convs = fixtures.conversations.slice(0, 1).map((c) => ({
    ...c,
    peer: "Mahfuz Rahman",
    peerHue: 210,
    messages: c.messages.map((m) => ({
      ...m,
      from: m.from === "me" ? ("peer" as const) : ("me" as const),
    })),
  }));
  const extra = {
    ...fixtures.conversations[1]!,
    id: "c3",
    title: "EK-24521 · Human heart drawing",
    orderCode: "EK-24521",
    peer: "Sadia Islam",
    peerHue: 330,
    lastMessage: "Please label the bicuspid valve more clearly.",
    unread: 1,
    online: true,
    messages: [
      {
        from: "peer" as const,
        text: "Please label the bicuspid valve and aorta more clearly.",
        at: fixtures.at(-8),
      },
    ],
  };
  return (
    <>
      <PageHeader title="Messages" />
      <Suspense fallback={<Skeleton className="h-[480px]" />}>
        <ChatView conversations={[...convs, extra]} />
      </Suspense>
    </>
  );
}
