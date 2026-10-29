import { sweepPromotions } from "./routes/growth.ts";
import { buildApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { createDb, migrate } from "./db.ts";
import { createHub } from "./lib/hub.ts";
import { attachCallGateway, createEdukhataCalling } from "./calling/module.ts";
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
const calling = createEdukhataCalling(db, chat, notifications, {
  info: () => undefined,
  warn: (o, m) => console.warn(`[calls] ${m ?? ""}`, o),
  error: (o, m) => console.error(`[calls] ${m ?? ""}`, o),
});
const app = await buildApp({
  db,
  config,
  hub: createHub(config),
  notifications,
  chat,
  calling,
  logger: { level: config.production ? "info" : "warn" },
});
await app.listen({ host: config.host, port: config.port });
// Realtime chat. Browsers connect through the web origin: <web>/api/chat/socket.io.
const gateway = chat.chat.attachGateway(app.server, {
  allowedOrigins: [config.webUrl],
  path: CHAT_SOCKET_PATH,
});
// 1:1 calls (signalling only; media is peer-to-peer WebRTC). Browsers: <web>/api/calls/ws.
const callGateway = attachCallGateway(app.server, db, chat, calling, config.webUrl);
await calling.service.recoverAfterRestart(); // single API instance
calling.service.start();
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    calling.service.stop();
    void Promise.all([callGateway.close(), gateway.close()])
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
// Matching (expire offers, next wave) and delivery (auto-close, deadline reminders); single API instance.
const matchingSweep = setInterval(() => {
  void app.edkDeps.matching.sweep().catch((e: unknown) => console.error("[matching]", e));
  void app.edkDeps.delivery.sweep().catch((e: unknown) => console.error("[delivery]", e));
  void sweepPromotions(app.edkDeps.db, app.edkDeps.notifications).catch((e: unknown) =>
    console.error("[promotions]", e),
  );
}, 30_000);
matchingSweep.unref();
// Unsent chat uploads older than a day.
setInterval(
  () => void chat.chat.service.purgeStaleUploads().catch((e) => console.error("[chat]", e)),
  3600_000,
).unref();
setInterval(
  () => void notifications.service.runRetention().catch((e) => console.error("[retention]", e)),
  24 * 3600_000,
).unref();
