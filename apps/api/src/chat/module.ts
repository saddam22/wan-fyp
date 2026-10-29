import sharp from "sharp";
import { DEFAULT_FEATURES, type ChatFeatures } from "@chat-module/core";
import { createChatModule } from "@chat-module/server";
import type { Config } from "../config.ts";
import type { Db } from "../db.ts";
import type { Deps } from "../deps.ts";
import { edukhataChatHost } from "./host.ts";
import { diskChatStorage } from "./storage.ts";
import { chatTokens } from "./tokens.ts";

/** Browsers reach the API at <web>/api, so the module's own URLs carry that prefix. */
export const CHAT_PUBLIC_PREFIX = "/api/chat";
export const CHAT_SOCKET_PATH = "/chat/socket.io";
export const CHAT_MAX_UPLOAD = 10 * 1024 * 1024;

// Defaults of the WAN chat module, with uploads capped at 10 MB and groups off.
const attachments = Object.fromEntries(
  Object.entries(DEFAULT_FEATURES.attachments).map(([k, rule]) => [
    k,
    { ...rule, maxBytes: Math.min(rule.maxBytes, CHAT_MAX_UPLOAD) },
  ]),
) as ChatFeatures["attachments"];

/** The WAN chat module (saddam22/chat-messaging) set up for EduKhata. */
export function createEdukhataChat(
  db: Db,
  config: Config,
  notifications: Deps["notifications"],
  logger: {
    info(o: object, m?: string): void;
    warn(o: object, m?: string): void;
    error(o: object, m?: string): void;
  },
) {
  const tokens = chatTokens(config.chatSecret);
  const storage = diskChatStorage(
    config.chatUploadDir,
    config.chatSecret,
    `${CHAT_PUBLIC_PREFIX}-files`,
  );
  const chat = createChatModule({
    pool: db,
    host: edukhataChatHost(db, tokens),
    storage,
    secret: config.chatSecret,
    routePrefix: CHAT_PUBLIC_PREFIX,
    logger,
    features: { groups: false, attachments },
    // Re-encode photos: removes EXIF (GPS location, device) before anyone sees them.
    imageProcessor: async (body) => {
      const { data, info } = await sharp(body, { limitInputPixels: 50_000_000 })
        .rotate()
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });
      return { body: data, contentType: "image/webp", width: info.width, height: info.height };
    },
    // Message text never goes into notifications or push (notificationPreviews off).
    notifier: {
      async onMessage(e) {
        const sender = (
          await db.query<{ name: string }>("select name from users where id = $1", [e.senderId])
        ).rows[0];
        await notifications.service.notify({
          type: "chat.message",
          recipientIds: e.recipientIds,
          actorId: e.senderId,
          payload: { conversationId: e.conversationId },
          data: { sender: sender?.name ?? "", preview: "" },
          groupKey: `chat:${e.conversationId}`,
        });
      },
    },
  });
  return { chat, storage, tokens };
}
export type EdukhataChat = ReturnType<typeof createEdukhataChat>;
