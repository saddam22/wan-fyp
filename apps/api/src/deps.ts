import type { Config } from "./config.ts";
import type { Db } from "./db.ts";
import type { Hub } from "./lib/hub.ts";

export interface Deps {
  db: Db;
  config: Config;
  hub: Hub;
}
