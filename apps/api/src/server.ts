import { buildApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { createDb, migrate } from "./db.ts";
import { createHub } from "./lib/hub.ts";
import { CHAT_SOCKET_PATH, createEdukhataChat } from "./chat/module.ts";
import { createNotifications } from "./social/notifications.ts";

const config = loadConfig();
const db = createDb(config.databaseUrl);
const applied = await migrate(db);
const notifications = createNotifications(db, config, {
  warn: (msg, meta) => console.warn(`[notifications] ${msg}`, meta ?? {}),
  error: (msg, meta) => console.error(`[notifications] ${msg}`, meta ?? {}),
});
// The chat module never logs message content.
const chat = createEdukhataChat(db, config, notifications, {
  info: () => undefined,
  warn: (o, m) => console.warn(`[chat] ${m ?? ""}`, o),
  error: (o, m) => console.error(`[chat] ${m ?? ""}`, o),
});
const app = await buildApp({
  db,
  config,
  hub: createHub(config),
  notifications,
  chat,
  logger: { level: config.production ? "info" : "warn" },
});
await app.listen({ host: config.host, port: config.port });
// Realtime chat. Browsers connect through the web origin: <web>/api/chat/socket.io.
const gateway = chat.chat.attachGateway(app.server, {
  allowedOrigins: [config.webUrl],
  path: CHAT_SOCKET_PATH,
});
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void gateway
      .close()
      .then(() => app.close())
      .then(() => db.end())
      .finally(() => process.exit(0));
  });
}
console.log(
  `EduKhata API on :${config.port}${applied.length ? ` (migrated: ${applied.join(", ")})` : ""}`,
);

// Push delivery worker (social module) and daily retention, single API instance.
if (notifications.pushEnabled) {
  setInterval(
    () => void notifications.worker.runOnce().catch((e) => console.error("[push]", e)),
    15_000,
  ).unref();
}
// Unsent chat uploads older than a day.
setInterval(
  () => void chat.chat.service.purgeStaleUploads().catch((e) => console.error("[chat]", e)),
  3600_000,
).unref();
setInterval(
  () => void notifications.service.runRetention().catch((e) => console.error("[retention]", e)),
  24 * 3600_000,
).unref();
