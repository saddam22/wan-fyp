"use client";

import "@chat-module/react/styles.css";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { createChatClient } from "@chat-module/client";
import { ChatProvider, en, type ChatMessages } from "@chat-module/react";
import { ChatApp } from "@chat-module/react/web";
import { useT } from "@/lib/i18n/client";

/** EduKhata wording where the module's defaults speak about its first host app. */
const EN: ChatMessages = {
  ...en,
  "list.emptyHint": "Message EduKhata support with New chat. Order chats appear here.",
  "new.search": "Type a name",
};
const BN: Partial<ChatMessages> = {
  "list.emptyHint": "নতুন চ্যাট দিয়ে এডুখাতা সাপোর্টকে লিখুন। অর্ডারের চ্যাট এখানে আসবে।",
  "new.search": "নাম লিখুন",
};

let cached: { token: string; exp: number } | null = null;

/** Chat tokens come from the session cookie (GET /api/me/chat-token), 15 minutes each. */
async function fetchToken(): Promise<string | null> {
  const res = await fetch("/api/me/chat-token", { cache: "no-store" });
  if (!res.ok) return (cached = null);
  const t = (await res.json()) as { token: string; expiresAt: string };
  cached = { token: t.token, exp: Date.parse(t.expiresAt) };
  return t.token;
}
const getAccessToken = () =>
  cached && cached.exp - Date.now() > 60_000 ? cached.token : fetchToken();

/** The WAN chat module's messaging screen, signed in as the EduKhata user. */
export function LiveChat({ userId }: { userId: string }) {
  const { lang } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const conversationId = useSearchParams().get("c");
  const client = useMemo(
    () =>
      createChatClient({
        baseUrl: "",
        prefix: "/api/chat",
        socketPath: "/api/chat/socket.io",
        userId,
        getAccessToken,
        refreshAccessToken: fetchToken,
      }),
    [userId],
  );
  return (
    <ChatProvider
      client={client}
      {...(lang === "en" ? { messages: EN, locale: "en-GB" } : { messages: BN, locale: "bn-BD" })}
    >
      <div
        data-testid="live-chat"
        className="edk-chat h-[calc(100dvh-11rem)] min-h-[480px] overflow-hidden rounded-xl border border-line bg-white"
      >
        <ChatApp
          conversationId={conversationId}
          onConversationChange={(id) => router.replace(id ? `${pathname}?c=${id}` : pathname)}
        />
      </div>
    </ChatProvider>
  );
}
