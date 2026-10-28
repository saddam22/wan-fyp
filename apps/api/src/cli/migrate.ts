import { loadConfig } from "../config.ts";
import { createDb, migrate } from "../db.ts";

const db = createDb(loadConfig().databaseUrl);
const applied = await migrate(db);
console.log(applied.length ? `Applied: ${applied.join(", ")}` : "Up to date");
await db.end();
