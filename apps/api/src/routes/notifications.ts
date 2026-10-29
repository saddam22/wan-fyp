import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { NotificationRecord } from "@amar/social-modules";
import type { NotificationDto } from "@edukhata/contracts";
import type { Deps } from "../deps.ts";
import { ApiError } from "../lib/errors.ts";
import { requireUser } from "../lib/session.ts";

const toDto = (n: NotificationRecord): NotificationDto => ({
  id: n.id,
  type: n.type,
  category: n.category,
  link: n.link,
  data: n.data,
  actorCount: n.actorCount,
  createdAt: n.createdAt.toISOString(),
  updatedAt: n.updatedAt.toISOString(),
  readAt: n.readAt?.toISOString() ?? null,
  seenAt: n.seenAt?.toISOString() ?? null,
});

const prefsBody = z.object({
  categories: z
    .partialRecord(
      z.enum(["account", "family", "referral", "messages", "orders"]),
      z.object({ enabled: z.boolean(), push: z.boolean(), email: z.boolean() }),
    )
    .optional(),
  quietHours: z
    .object({ start: z.string(), end: z.string(), timezone: z.string() })
    .nullable()
    .optional(),
});

/** In-app notifications, preferences and Web Push subscriptions for the signed-in person. */
export const notificationRoutes: FastifyPluginAsync<Deps> = async (
  app,
  { db, config, hub, notifications },
) => {
  const actor = async (req: Parameters<typeof requireUser>[3]) => ({
    userId: (await requireUser(db, config, hub, req)).user.id,
  });

  app.get<{ Querystring: { filter?: string; cursor?: string; limit?: string } }>(
    "/me/notifications",
    async (req) => {
      const a = await actor(req);
      const page = await notifications.service.list(a, {
        filter: req.query.filter === "unread" ? "unread" : "all",
        cursor: req.query.cursor ?? null,
        limit: Number(req.query.limit ?? 20),
      });
      return {
        items: page.items.map(toDto),
        nextCursor: page.nextCursor,
        counts: await notifications.service.counts(a),
      };
    },
  );

  app.get("/me/notifications/counts", async (req) =>
    notifications.service.counts(await actor(req)),
  );

  app.post("/me/notifications/seen", async (req) => {
    await notifications.service.markSeen(await actor(req));
    return { ok: true };
  });

  app.post("/me/notifications/read", async (req) => {
    const body = z
      .object({ ids: z.array(z.string()).min(1).max(100), read: z.boolean().optional() })
      .safeParse(req.body);
    if (!body.success) throw new ApiError("validation", "Provide 1–100 notification ids", "ids");
    return {
      changed: await notifications.service.markRead(
        await actor(req),
        body.data.ids,
        body.data.read ?? true,
      ),
    };
  });

  app.post("/me/notifications/read-all", async (req) => ({
    changed: await notifications.service.markAllRead(await actor(req)),
  }));

  /** A click: verifies ownership, marks read, returns the internal link to open. */
  app.post<{ Params: { id: string } }>("/me/notifications/:id/open", async (req) =>
    notifications.service.open(await actor(req), req.params.id),
  );

  app.get("/me/notification-preferences", async (req) =>
    notifications.service.getPreferences(await actor(req)),
  );

  app.put("/me/notification-preferences", async (req) => {
    const body = prefsBody.safeParse(req.body);
    if (!body.success) throw new ApiError("validation", body.error.issues[0]?.message);
    const patch = {
      ...(body.data.categories ? { categories: body.data.categories } : {}),
      ...(body.data.quietHours !== undefined ? { quietHours: body.data.quietHours } : {}),
    };
    return notifications.service.updatePreferences(await actor(req), patch);
  });

  app.get("/push/config", async () => ({
    enabled: notifications.pushEnabled,
    vapidPublicKey: notifications.vapidPublicKey,
  }));

  app.post("/me/push-subscriptions", async (req) => {
    const a = await actor(req);
    const b = (req.body ?? {}) as { endpoint?: unknown; keys?: unknown };
    await notifications.push.subscribe(a, {
      endpoint: b.endpoint,
      keys: b.keys,
      userAgent: req.headers["user-agent"] ?? null,
    });
    return { ok: true };
  });

  app.delete<{ Querystring: { endpoint?: string } }>("/me/push-subscriptions", async (req) => {
    await notifications.push.unsubscribe(await actor(req), String(req.query.endpoint ?? ""));
    return { ok: true };
  });
};
