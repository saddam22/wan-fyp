/**
 * Runtime configuration from the environment. Development defaults work on localhost
 * against a local WAN Identity Hub; production refuses to start without real values.
 */

export interface Config {
  production: boolean;
  host: string;
  port: number;
  databaseUrl: string;
  /** Public origin of the EduKhata web app (no trailing slash). The API is reached at <webUrl>/api. */
  webUrl: string;
  /** WAN Identity Hub origin; its OIDC issuer is <hubUrl>/oidc. */
  hubUrl: string;
  clientId: string;
  clientSecret: string;
  cookieSecure: boolean;
  /** Absolute session lifetime and idle timeout. */
  sessionTtlMs: number;
  sessionIdleMs: number;
  /** How often a session re-checks the user's EduKhata entitlement at the hub. */
  hubCheckIntervalMs: number;
  /**
   * Proxies whose X-Forwarded-For is trusted (the web server in front). The API must not
   * be reachable from the internet directly.
   */
  trustProxy: string;
  /** HMAC secret for chat tokens, signed upload URLs and attachment URLs (32+ chars). */
  chatSecret: string;
  /** Where chat files are stored on disk (single API instance; see chat/storage.ts). */
  chatUploadDir: string;
  /** Web Push (VAPID). Null = push off; in-app notifications still work. */
  vapid: { publicKey: string; privateKey: string; subject: string } | null;
}

/** Same development default as the hub's DEV_EDK_SECRET (server/src/config.ts there). */
const DEV_CLIENT_SECRET = "dev-only-edukhata-secret-change-me-0123";
const DEV_CHAT_SECRET = "dev-only-edukhata-chat-secret-change-me-0123";

const trim = (u: string) => u.replace(/\/+$/, "");

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const production = env.NODE_ENV === "production";
  const databaseUrl = env.DATABASE_URL ?? "";
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const webUrl = trim(env.WEB_URL ?? "http://localhost:3200");
  const hubUrl = trim(env.WAN_HUB_URL ?? "http://localhost:4100");
  const clientSecret = env.EDK_CLIENT_SECRET ?? (production ? "" : DEV_CLIENT_SECRET);
  if (clientSecret.length < 32) throw new Error("EDK_CLIENT_SECRET must be 32+ characters");
  const chatSecret = env.CHAT_SECRET || (production ? "" : DEV_CHAT_SECRET);
  if (chatSecret.length < 32) throw new Error("CHAT_SECRET must be 32+ characters");
  if (production && (!webUrl.startsWith("https://") || !hubUrl.startsWith("https://"))) {
    throw new Error("WEB_URL and WAN_HUB_URL must use https in production");
  }
  return {
    production,
    host: env.HOST ?? "0.0.0.0",
    port: Number(env.PORT ?? 4200),
    databaseUrl,
    webUrl,
    hubUrl,
    clientId: env.EDK_CLIENT_ID ?? "edukhata",
    clientSecret,
    cookieSecure: production || env.COOKIE_SECURE === "true",
    sessionTtlMs: 7 * 24 * 3600_000,
    sessionIdleMs: 12 * 3600_000,
    hubCheckIntervalMs: Number(env.HUB_CHECK_INTERVAL_SEC ?? 600) * 1000,
    chatSecret,
    chatUploadDir: env.CHAT_UPLOAD_DIR ?? ".data/chat-uploads",
    trustProxy: env.TRUST_PROXY ?? "127.0.0.1,::1,::ffff:127.0.0.1",
    vapid:
      env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT
        ? {
            publicKey: env.VAPID_PUBLIC_KEY,
            privateKey: env.VAPID_PRIVATE_KEY,
            subject: env.VAPID_SUBJECT,
          }
        : null,
  };
}
