"use client";

import "@agg/calling-react/styles.css";
import { useEffect, useMemo } from "react";
import { CallManager } from "@agg/calling-client";
import {
  bnMessages,
  CallButton,
  CallOverlay,
  CallProvider,
  enMessages,
  useOptionalCallContext,
} from "@agg/calling-react";
import type { ConversationDto } from "@chat-module/core";
import { useT } from "@/lib/i18n/client";
import { getRealtimeToken } from "@/lib/realtime-token";

/**
 * 1:1 audio/video calls (WAN calling module) for the signed-in person: incoming calls
 * ring anywhere in the dashboard. Signalling goes through <web>/api/calls/ws; media is
 * peer-to-peer WebRTC. Calls are never recorded.
 */
export function LiveCalls({ children }: { children: React.ReactNode }) {
  const { lang } = useT();
  const manager = useMemo(
    () =>
      typeof window === "undefined"
        ? null
        : new CallManager({
            url: `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/calls/ws`,
            getToken: async () => (await getRealtimeToken()) ?? "",
          }),
    [],
  );
  useEffect(() => () => manager?.destroy(), [manager]);
  if (!manager) return <>{children}</>;
  return (
    <CallProvider manager={manager} messages={lang === "en" ? enMessages : bnMessages}>
      {children}
      <CallOverlay />
    </CallProvider>
  );
}

/** Audio and video buttons in a direct chat's header (the server re-checks who may call). */
export function ChatCallButtons({
  conversation,
  userId,
}: {
  conversation: ConversationDto;
  userId: string;
}) {
  const calls = useOptionalCallContext();
  if (!calls || conversation.kind !== "direct") return null;
  const peer = conversation.members.find((m) => m.userId !== userId);
  if (!peer || peer.user.status !== "active") return null;
  const p = { id: peer.userId, displayName: peer.user.displayName, avatarUrl: null };
  return (
    <span className="flex items-center gap-1">
      <CallButton peer={p} media="audio" conversationId={conversation.id} />
      <CallButton peer={p} media="video" conversationId={conversation.id} />
    </span>
  );
}
