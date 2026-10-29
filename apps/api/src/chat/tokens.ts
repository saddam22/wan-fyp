import { createHmac, timingSafeEqual } from "node:crypto";

/** Chat tokens live 15 minutes; the client fetches a new one from the session cookie. */
export const CHAT_TOKEN_TTL_MS = 15 * 60_000;

/**
 * Short-lived bearer tokens for the chat module (REST + Socket.IO), bound to an
 * EduKhata session: base64url(sessionId.expiry).hmac. The session cookie itself is
 * httpOnly and never reaches JavaScript.
 */
export function chatTokens(secret: string, now: () => number = Date.now) {
  const mac = (payload: string) =>
    createHmac("sha256", `edukhata-chat:${secret}`).update(payload).digest("base64url");
  return {
    issue(sessionId: string) {
      const exp = now() + CHAT_TOKEN_TTL_MS;
      const payload = Buffer.from(`${sessionId}.${exp}`).toString("base64url");
      return { token: `${payload}.${mac(payload)}`, expiresAt: new Date(exp) };
    },
    verify(token: string): { sessionId: string; expiresAt: Date } | null {
      const [payload, sig, extra] = token.split(".");
      if (!payload || !sig || extra !== undefined) return null;
      const expected = Buffer.from(mac(payload));
      const given = Buffer.from(sig);
      if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
      const [sessionId, exp] = Buffer.from(payload, "base64url").toString().split(".");
      const expiresAt = new Date(Number(exp));
      if (!sessionId || !(expiresAt.getTime() > now())) return null;
      return { sessionId, expiresAt };
    },
  };
}
export type ChatTokens = ReturnType<typeof chatTokens>;
