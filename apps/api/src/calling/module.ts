import type { Server } from "node:http";
import {
  attachWebSocketGateway,
  CallService,
  createIceServerProvider,
  iceConfigFromEnv,
  PostgresCallStore,
} from "@agg/calling-server";
import { mayContact, sessionTokenAuth } from "../chat/host.ts";
import type { EdukhataChat } from "../chat/module.ts";
import type { Db } from "../db.ts";
import type { Deps } from "../deps.ts";

/** Browsers reach it through the web origin: <web>/api/calls/ws. */
export const CALLS_WS_PATH = "/calls/ws";

type Logger = {
  info(o: object, m?: string): void;
  warn(o: object, m?: string): void;
  error(o: object, m?: string): void;
};

/**
 * One-to-one audio/video calls through the WAN calling module (saddam22/audio-video-calling).
 * Same contact rule as chat; calls are never recorded (decision Q11).
 */
export function createEdukhataCalling(
  db: Db,
  chat: EdukhataChat,
  notifications: Deps["notifications"],
  logger: Logger,
  env: Record<string, string | undefined> = process.env,
) {
  const store = new PostgresCallStore(db);
  const name = async (id: string) =>
    (await db.query<{ name: string }>("select name from users where id::text = $1", [id])).rows[0]
      ?.name ?? "";

  const service = new CallService({
    store,
    logger,
    // STUN/TURN from CALL_STUN_URLS / CALL_TURN_* (configuration.md of the module).
    iceServers: createIceServerProvider(iceConfigFromEnv(env)),
    identity: {
      async resolveParticipant(id) {
        const r = (
          await db.query<{ id: string; name: string }>(
            `select u.id, u.name from users u where u.id::text = $1 and u.status = 'active'
               and exists (select 1 from user_roles r where r.user_id = u.id)`,
            [id],
          )
        ).rows[0];
        // Names only: no photos, emails or numbers are shown in calls.
        return r ? { id: r.id, displayName: r.name, avatarUrl: null } : null;
      },
    },
    policy: {
      async canCall({ callerId, calleeId, conversationId }) {
        if (!(await mayContact(db, callerId, calleeId))) return false;
        if (!conversationId) return true;
        // A call from a chat needs both people in that chat.
        try {
          const conv = await chat.chat.service.getConversation(callerId, conversationId);
          return conv.members.some((m) => m.userId === calleeId);
        } catch {
          return false;
        }
      },
    },
    notifications: {
      // No native push for ringing yet: the callee must have EduKhata open.
      notifyIncomingCall: () => false,
      async notifyMissedCall({ call, caller }) {
        await notifications.service.notify({
          type: "call.missed",
          recipientIds: [call.calleeId],
          actorId: caller.id,
          payload: call.conversationId ? { conversationId: call.conversationId } : {},
          data: { caller: caller.displayName, media: call.media },
          dedupeKey: `call:${call.id}`,
        });
      },
    },
  });
  return { service, store };
}
export type EdukhataCalling = ReturnType<typeof createEdukhataCalling>;

/** Signalling over WebSocket on the API's HTTP server (media itself is peer-to-peer). */
export function attachCallGateway(
  server: Server,
  db: Db,
  chat: EdukhataChat,
  calling: EdukhataCalling,
  webUrl: string,
) {
  return attachWebSocketGateway({
    server,
    service: calling.service,
    path: CALLS_WS_PATH,
    allowedOrigins: [webUrl],
    // Same token as chat: GET /me/chat-token, bound to the EduKhata session.
    authenticate: sessionTokenAuth(db, chat.tokens),
  });
}
