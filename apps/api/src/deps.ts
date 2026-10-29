import type { EdukhataCalling } from "./calling/module.ts";
import type { EdukhataChat } from "./chat/module.ts";
import type { Config } from "./config.ts";
import type { Db } from "./db.ts";
import type { Hub } from "./lib/hub.ts";
import type { Delivery } from "./market/delivery.ts";
import type { Matching } from "./market/matching.ts";
import type { Notifications } from "./social/notifications.ts";

export interface Deps {
  db: Db;
  config: Config;
  hub: Hub;
  notifications: Notifications;
  chat: EdukhataChat;
  calling: EdukhataCalling;
  matching: Matching;
  delivery: Delivery;
}
