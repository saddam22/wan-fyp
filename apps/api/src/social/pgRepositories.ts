/**
 * PostgreSQL implementations of the WAN social module's notification, preference,
 * delivery and push-subscription repository contracts (modules/social/src/.../types.ts).
 * Tables: migrations/002_notifications.sql.
 */
import {
  decodeCursor,
  encodeCursor,
  UniqueViolation,
  type DeliveryRecord,
  type DeliveryRepository,
  type NotificationPreferences,
  type NotificationRecord,
  type NotificationRepository,
  type PreferenceRepository,
  type PushSubscriptionRecord,
  type PushSubscriptionRepository,
} from "@amar/social-modules";
import type { Db } from "../db.ts";

interface NotificationRow {
  id: string;
  recipient_id: string;
  type: string;
  category: string;
  actor_ids: string[];
  actor_count: number;
  target_type: string | null;
  target_id: string | null;
  link: string;
  group_key: string | null;
  dedupe_key: string | null;
  data: NotificationRecord["data"];
  created_at: Date;
  updated_at: Date;
  seen_at: Date | null;
  read_at: Date | null;
  archived_at: Date | null;
}

const toRecord = (r: NotificationRow): NotificationRecord => ({
  id: r.id,
  recipientId: r.recipient_id,
  type: r.type,
  category: r.category,
  actorIds: r.actor_ids,
  actorCount: r.actor_count,
  target: r.target_type ? { type: r.target_type as never, id: r.target_id ?? "" } : null,
  link: r.link,
  groupKey: r.group_key,
  dedupeKey: r.dedupe_key,
  data: r.data ?? {},
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  seenAt: r.seen_at,
  readAt: r.read_at,
  archivedAt: r.archived_at,
});

const params = (n: NotificationRecord) => [
  n.id,
  n.recipientId,
  n.type,
  n.category,
  n.actorIds,
  n.actorCount,
  n.target?.type ?? null,
  n.target?.id ?? null,
  n.link,
  n.groupKey,
  n.dedupeKey,
  JSON.stringify(n.data),
  n.createdAt,
  n.updatedAt,
  n.seenAt,
  n.readAt,
  n.archivedAt,
];

/** Recipients and actors are EduKhata user ids (uuid); anything else matches nothing. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function pgNotifications(db: Db): NotificationRepository {
  const one = async (sql: string, args: unknown[]) => {
    const r = (await db.query<NotificationRow>(sql, args)).rows[0];
    return r ? toRecord(r) : null;
  };
  return {
    get: (id) =>
      UUID.test(id)
        ? one("select * from notifications where id = $1", [id])
        : Promise.resolve(null),
    findByDedupeKey: (recipientId, key) =>
      one("select * from notifications where recipient_id = $1 and dedupe_key = $2", [
        recipientId,
        key,
      ]),
    findOpenGroup: (recipientId, groupKey, since) =>
      one(
        `select * from notifications where recipient_id = $1 and group_key = $2 and archived_at is null and updated_at >= $3
          order by updated_at desc limit 1`,
        [recipientId, groupKey, since],
      ),
    async insert(n) {
      try {
        await db.query(
          `insert into notifications (id, recipient_id, type, category, actor_ids, actor_count, target_type, target_id, link,
             group_key, dedupe_key, data, created_at, updated_at, seen_at, read_at, archived_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
          params(n),
        );
      } catch (e) {
        if ((e as { code?: string }).code === "23505")
          throw new UniqueViolation("notification_dedupe");
        throw e;
      }
    },
    async update(n) {
      await db.query(
        `update notifications set recipient_id=$2, type=$3, category=$4, actor_ids=$5, actor_count=$6, target_type=$7, target_id=$8,
           link=$9, group_key=$10, dedupe_key=$11, data=$12, created_at=$13, updated_at=$14, seen_at=$15, read_at=$16, archived_at=$17
         where id = $1`,
        params(n),
      );
    },
    async list(recipientId, filter, page) {
      const c = decodeCursor(page.cursor);
      const rows = (
        await db.query<NotificationRow>(
          `select * from notifications
            where recipient_id = $1 and archived_at is null and ($2 = 'all' or read_at is null)
              and ($3::timestamptz is null or (updated_at, id) < ($3::timestamptz, $4::uuid))
            order by updated_at desc, id desc limit $5`,
          [recipientId, filter, c?.at ?? null, c?.id ?? null, page.limit + 1],
        )
      ).rows;
      const more = rows.length > page.limit;
      const slice = (more ? rows.slice(0, page.limit) : rows).map(toRecord);
      const last = slice.at(-1);
      return {
        items: slice,
        nextCursor: more && last ? encodeCursor(last.updatedAt, last.id) : null,
      };
    },
    countUnread: async (id) =>
      Number(
        (
          await db.query(
            "select count(*) from notifications where recipient_id = $1 and archived_at is null and read_at is null",
            [id],
          )
        ).rows[0].count,
      ),
    countUnseen: async (id) =>
      Number(
        (
          await db.query(
            "select count(*) from notifications where recipient_id = $1 and archived_at is null and seen_at is null",
            [id],
          )
        ).rows[0].count,
      ),
    async markSeenAll(recipientId, at) {
      await db.query(
        "update notifications set seen_at = $2 where recipient_id = $1 and seen_at is null",
        [recipientId, at],
      );
    },
    async setRead(recipientId, ids, at) {
      const valid = ids.filter((i) => UUID.test(i));
      if (!valid.length) return 0;
      const r = await db.query(
        "update notifications set read_at = $3, seen_at = coalesce(seen_at, $3) where recipient_id = $1 and id = any($2::uuid[])",
        [recipientId, valid, at],
      );
      return r.rowCount ?? 0;
    },
    async markAllRead(recipientId, at) {
      const r = await db.query(
        "update notifications set read_at = $2, seen_at = coalesce(seen_at, $2) where recipient_id = $1 and read_at is null",
        [recipientId, at],
      );
      return r.rowCount ?? 0;
    },
    async archive(recipientId, id, at) {
      if (!UUID.test(id)) return false;
      return (
        ((
          await db.query(
            "update notifications set archived_at = $3 where recipient_id = $1 and id = $2 and archived_at is null",
            [recipientId, id, at],
          )
        ).rowCount ?? 0) > 0
      );
    },
    archiveReadBefore: async (before, at) =>
      (
        await db.query(
          "update notifications set archived_at = $2 where archived_at is null and read_at < $1",
          [before, at],
        )
      ).rowCount ?? 0,
    deleteCreatedBefore: async (before) =>
      (await db.query("delete from notifications where created_at < $1", [before])).rowCount ?? 0,
  };
}

export function pgPreferences(db: Db): PreferenceRepository {
  return {
    async get(userId) {
      const r = (
        await db.query<{
          categories: NotificationPreferences["categories"];
          quiet_hours: NotificationPreferences["quietHours"];
          email_digest: NotificationPreferences["emailDigest"];
          muted_sources: string[];
        }>(
          "select categories, quiet_hours, email_digest, muted_sources from notification_preferences where user_id = $1",
          [userId],
        )
      ).rows[0];
      return r
        ? {
            userId,
            categories: r.categories,
            quietHours: r.quiet_hours,
            emailDigest: r.email_digest,
            mutedSources: r.muted_sources,
          }
        : null;
    },
    async save(p) {
      await db.query(
        `insert into notification_preferences (user_id, categories, quiet_hours, email_digest, muted_sources, updated_at)
         values ($1, $2, $3, $4, $5, now())
         on conflict (user_id) do update set categories = excluded.categories, quiet_hours = excluded.quiet_hours,
           email_digest = excluded.email_digest, muted_sources = excluded.muted_sources, updated_at = now()`,
        [
          p.userId,
          JSON.stringify(p.categories),
          p.quietHours ? JSON.stringify(p.quietHours) : null,
          p.emailDigest,
          p.mutedSources,
        ],
      );
    },
  };
}

interface DeliveryRow {
  id: string;
  notification_id: string;
  recipient_id: string;
  channel: "push" | "email";
  status: DeliveryRecord["status"];
  attempts: number;
  last_error_code: string | null;
  next_attempt_at: Date;
  created_at: Date;
}
const toDelivery = (r: DeliveryRow): DeliveryRecord => ({
  id: r.id,
  notificationId: r.notification_id,
  recipientId: r.recipient_id,
  channel: r.channel,
  status: r.status,
  attempts: r.attempts,
  lastErrorCode: r.last_error_code,
  nextAttemptAt: r.next_attempt_at,
  createdAt: r.created_at,
});

export function pgDeliveries(db: Db): DeliveryRepository {
  return {
    async enqueue(d) {
      await db.query(
        `insert into notification_deliveries (id, notification_id, recipient_id, channel, status, attempts, last_error_code, next_attempt_at, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict do nothing`,
        [
          d.id,
          d.notificationId,
          d.recipientId,
          d.channel,
          d.status,
          d.attempts,
          d.lastErrorCode,
          d.nextAttemptAt,
          d.createdAt,
        ],
      );
    },
    async claimDue(now, limit) {
      // Claim by pushing next_attempt_at forward inside the same statement, so two workers
      // never send the same delivery (SKIP LOCKED inside a single-statement CTE).
      const rows = (
        await db.query<DeliveryRow>(
          `with due as (
             select id from notification_deliveries where status = 'pending' and next_attempt_at <= $1
              order by next_attempt_at limit $2 for update skip locked)
           update notification_deliveries d set next_attempt_at = $1 + interval '5 minutes'
             from due where d.id = due.id returning d.*`,
          [now, limit],
        )
      ).rows;
      return rows.map(toDelivery);
    },
    async save(d) {
      await db.query(
        "update notification_deliveries set status = $2, attempts = $3, last_error_code = $4, next_attempt_at = $5 where id = $1",
        [d.id, d.status, d.attempts, d.lastErrorCode, d.nextAttemptAt],
      );
    },
  };
}

interface PushRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: Date;
  last_used_at: Date | null;
}
const toSub = (r: PushRow): PushSubscriptionRecord => ({
  id: r.id,
  userId: r.user_id,
  endpoint: r.endpoint,
  keys: { p256dh: r.p256dh, auth: r.auth },
  userAgent: r.user_agent,
  createdAt: r.created_at,
  lastUsedAt: r.last_used_at,
});

export function pgPushSubscriptions(db: Db): PushSubscriptionRepository {
  return {
    async upsert(s) {
      await db.query(
        `insert into push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, created_at, last_used_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8)
         on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent`,
        [
          s.id,
          s.userId,
          s.endpoint,
          s.keys.p256dh,
          s.keys.auth,
          s.userAgent,
          s.createdAt,
          s.lastUsedAt,
        ],
      );
    },
    listForUser: async (userId) =>
      (
        await db.query<PushRow>("select * from push_subscriptions where user_id = $1", [userId])
      ).rows.map(toSub),
    async removeByEndpoint(userId, endpoint) {
      const r = userId
        ? await db.query("delete from push_subscriptions where user_id = $1 and endpoint = $2", [
            userId,
            endpoint,
          ])
        : await db.query("delete from push_subscriptions where endpoint = $1", [endpoint]);
      return (r.rowCount ?? 0) > 0;
    },
    async touch(id, at) {
      await db.query("update push_subscriptions set last_used_at = $2 where id = $1", [id, at]);
    },
  };
}
