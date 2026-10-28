import { buildApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { createDb, migrate } from "./db.ts";
import { createHub } from "./lib/hub.ts";

const config = loadConfig();
const db = createDb(config.databaseUrl);
const applied = await migrate(db);
const app = await buildApp({
  db,
  config,
  hub: createHub(config),
  logger: { level: config.production ? "info" : "warn" },
});
await app.listen({ host: config.host, port: config.port });
console.log(
  `EduKhata API on :${config.port}${applied.length ? ` (migrated: ${applied.join(", ")})` : ""}`,
);
