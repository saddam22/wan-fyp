import webpush from "web-push";
import {
  defineSocialConfig,
  DeliveryWorker,
  MemoryRateLimiter,
  NoopPushProvider,
  NotificationService,
  PushSubscriptionService,
  systemClock,
  uuidGenerator,
  WebPushProvider,
  type Logger,
} from "@amar/social-modules";
import { NOTIFICATION_TYPES, renderNotification } from "@edukhata/contracts";
import type { Config } from "../config.ts";
import type { Db } from "../db.ts";
import {
  pgDeliveries,
  pgNotifications,
  pgPreferences,
  pgPushSubscriptions,
} from "./pgRepositories.ts";

/**
 * Notifications through the WAN social module (NotificationService, push subscriptions
 * and the delivery worker) on EduKhata's PostgreSQL. Only the notification features of
 * the module are switched on; follow, groups and pages stay off.
 */
export function createNotifications(db: Db, config: Config, logger: Logger) {
  const pushOn = !!config.vapid;
  const social = defineSocialConfig({
    features: {
      follow: false,
      followRequestsForPrivateProfiles: false,
      groups: false,
      groupInviteLinks: false,
      pages: false,
      pageReviews: false,
      pageVerification: false,
      notifications: true,
      pushNotifications: pushOn,
      emailNotifications: false,
    },
  });
  const repos = {
    notifications: pgNotifications(db),
    preferences: pgPreferences(db),
    deliveries: pgDeliveries(db),
    subscriptions: pgPushSubscriptions(db),
  };
  const rateLimiter = new MemoryRateLimiter(() => Date.now());
  const service = new NotificationService({
    config: social,
    notifications: repos.notifications,
    preferences: repos.preferences,
    deliveries: repos.deliveries,
    // EduKhata has no block list yet (the chat module keeps its own).
    blocks: { isBlockedEitherWay: async () => false, blockedAmong: async () => [] },
    rateLimiter,
    clock: systemClock,
    ids: uuidGenerator,
    logger,
  });
  for (const t of NOTIFICATION_TYPES) {
    service.registerType({
      type: t.type,
      category: t.category,
      channels: t.channels,
      link: t.link,
      ...(t.mandatory ? { mandatory: true } : {}),
      ...(t.aggregatable ? { aggregatable: true } : {}),
    });
  }

  const provider = pushOn
    ? new WebPushProvider(config.vapid, (sub, payload, opts) =>
        webpush.sendNotification(sub, payload, opts),
      )
    : new NoopPushProvider();
  const pushDeps = {
    config: social,
    subscriptions: repos.subscriptions,
    deliveries: repos.deliveries,
    provider,
    clock: systemClock,
    ids: uuidGenerator,
    logger,
    // Push text in the recipient's language; links are internal paths only.
    render: async (id: string) => {
      const n = await repos.notifications.get(id);
      if (!n) return null;
      const locale = (
        await db.query<{ locale: string | null }>("select locale from users where id = $1", [
          n.recipientId,
        ])
      ).rows[0]?.locale;
      const text = renderNotification(
        n.type,
        n.data,
        n.actorCount,
        locale?.startsWith("bn") ? "bn" : "en",
      );
      return { title: text.title, body: text.body, link: n.link, tag: n.groupKey ?? n.id };
    },
  };
  return {
    service,
    push: new PushSubscriptionService(pushDeps),
    worker: new DeliveryWorker(pushDeps),
    pushEnabled: pushOn,
    vapidPublicKey: config.vapid?.publicKey ?? null,
  };
}

export type Notifications = ReturnType<typeof createNotifications>;
