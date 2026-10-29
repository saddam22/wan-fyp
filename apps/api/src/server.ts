import { buildApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { createDb, migrate } from "./db.ts";
import { createHub } from "./lib/hub.ts";
import { createNotifications } from "./social/notifications.ts";

const config = loadConfig();
const db = createDb(config.databaseUrl);
const applied = await migrate(db);
const notifications = createNotifications(db, config, {
  warn: (msg, meta) => console.warn(`[notifications] ${msg}`, meta ?? {}),
  error: (msg, meta) => console.error(`[notifications] ${msg}`, meta ?? {}),
});
const app = await buildApp({
  db,
  config,
  hub: createHub(config),
  notifications,
  logger: { level: config.production ? "info" : "warn" },
});
await app.listen({ host: config.host, port: config.port });
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
setInterval(
  () => void notifications.service.runRetention().catch((e) => console.error("[retention]", e)),
  24 * 3600_000,
).unref();
