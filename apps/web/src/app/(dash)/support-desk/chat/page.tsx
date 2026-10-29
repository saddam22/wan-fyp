import { LiveMessages } from "@/components/dash/MessagesPage";
import { authMode } from "@/lib/auth-mode";
import { Suspense } from "react";
import { fixtures } from "@edukhata/contracts";
import { ChatView } from "@/components/dash/Chat";
import { PageHeader, Skeleton } from "@/components/ui";

export default async function SupportChat() {
  if (authMode() === "wan")
    return (
      <>
        <PageHeader title="Messages" sub="Conversations with students, mentors and guardians." />
        <LiveMessages />
      </>
    );
  const convs = [
    {
      id: "s1",
      title: "Support · payment question",
      peer: "Ayesha Siddiqua",
      peerHue: 300,
      lastMessage: "I paid by Nagad 30 minutes ago…",
      at: fixtures.at(-2),
      unread: 1,
      online: true,
      messages: [
        {
          from: "peer" as const,
          text: "I paid by Nagad 30 minutes ago but my order says payment review.",
          at: fixtures.at(-2),
        },
      ],
    },
    {
      id: "s2",
      title: "Support · revision delay",
      peer: "Sadia Islam",
      peerHue: 330,
      lastMessage: "Thank you!",
      at: fixtures.at(-3),
      unread: 0,
      online: false,
      messages: [
        {
          from: "peer" as const,
          text: "Mentor hasn't replied to my revision.",
          at: fixtures.at(-10),
        },
        {
          from: "me" as const,
          text: "I've reminded the mentor. The revision is still within the order time.",
          at: fixtures.at(-3),
        },
        { from: "peer" as const, text: "Thank you!", at: fixtures.at(-3) },
      ],
    },
  ];
  return (
    <>
      <PageHeader title="Live Chat" sub="Support conversations (WAN chat module in Phase 3)." />
      <Suspense fallback={<Skeleton className="h-[480px]" />}>
        <ChatView conversations={convs} />
      </Suspense>
    </>
  );
}
