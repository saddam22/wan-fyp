import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { SocialError } from "@amar/social-modules";
import type { Deps } from "./deps.ts";
import { ApiError } from "./lib/errors.ts";
import { adminRoutes } from "./routes/admin.ts";
import { authRoutes } from "./routes/auth.ts";
import { guardianRoutes } from "./routes/guardians.ts";
import { meRoutes } from "./routes/me.ts";
import { notificationRoutes } from "./routes/notifications.ts";
import { referralRoutes } from "./routes/referrals.ts";
import { createNotifications } from "./social/notifications.ts";
import { createEdukhataCalling } from "./calling/module.ts";
import { createEdukhataChat } from "./chat/module.ts";
import { orderConversations } from "./chat/orders.ts";
import { createDelivery } from "./market/delivery.ts";
import { createMatching } from "./market/matching.ts";
import { deliveryRoutes } from "./routes/delivery.ts";
import { reviewRoutes } from "./routes/reviews.ts";
import { paymentRoutes } from "./routes/payments.ts";
import { ledgerRoutes } from "./routes/ledger.ts";
import { moneyRoutes } from "./routes/money.ts";
import { contentRoutes } from "./routes/content.ts";
import { growthRoutes } from "./routes/growth.ts";
import { trustRoutes } from "./routes/trust.ts";
import { matchingRoutes } from "./routes/matching.ts";
import { catalogRoutes } from "./routes/catalog.ts";
import { chatRoutes } from "./routes/chat.ts";
import { mentorRoutes } from "./routes/mentors.ts";
import { orderRoutes } from "./routes/orders.ts";

declare module "fastify" {
  interface FastifyInstance {
    /** Module handles (matching sweep in server.ts, gateways in tests). */
    edkDeps: Deps;
    /** Every route registered (method + URL), for the access sweep test. */
    edkRoutes: { method: string; url: string }[];
  }
}

export interface AppOptions extends Omit<
  Deps,
  "notifications" | "chat" | "calling" | "matching" | "delivery"
> {
  /** Defaults to the social-module notification service on `db`. */
  notifications?: Deps["notifications"];
  /** Defaults to the WAN chat module on `db`. */
  chat?: Deps["chat"];
  /** Defaults to the WAN calling module on `db`. */
  calling?: Deps["calling"];
  logger?: boolean | object;
}

/**
 * The API sits behind the web app (Next.js rewrites /api/* here), so browsers only ever
 * talk to the web origin. Cookie session; state-changing requests must carry that origin.
 */
export async function buildApp(opts: AppOptions): Promise<FastifyInstance> {
  const { config } = opts;
  const app = Fastify({
    logger: opts.logger ?? false,
    trustProxy: config.trustProxy,
    bodyLimit: 64 * 1024,
  });
  const notifications =
    opts.notifications ??
    createNotifications(opts.db, config, {
      warn: (msg, meta) => app.log.warn(meta ?? {}, msg),
      error: (msg, meta) => app.log.error(meta ?? {}, msg),
    });
  const chat = opts.chat ?? createEdukhataChat(opts.db, config, notifications, app.log);
  const deps: Deps = {
    ...opts,
    notifications,
    chat,
    calling: opts.calling ?? createEdukhataCalling(opts.db, chat, notifications, app.log),
    matching: createMatching(
      opts.db,
      notifications,
      app.log,
      orderConversations(opts.db, chat, app.log),
    ),
    delivery: createDelivery(opts.db, notifications, app.log),
  };
  // The chat module keeps its own migration history (drizzle.__chat_migrations); the
  // calling module creates its two tables if missing (calls, call_active_users).
  app.decorate("edkDeps", deps);
  const routes: { method: string; url: string }[] = [];
  app.decorate("edkRoutes", routes);
  app.addHook("onRoute", (r) => {
    for (const m of ([] as string[]).concat(r.method)) routes.push({ method: m, url: r.url });
  });
  await deps.chat.chat.migrate();
  await deps.calling.store.migrate();
  await app.register(cookie);
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, { global: true, max: 600, timeWindow: "1 minute" });

  app.setErrorHandler((error, req, reply) => {
    if (error instanceof ApiError) return reply.code(error.status).send(error.toJSON());
    if (error instanceof SocialError) {
      // One validation shape across the API (the module itself uses 422).
      if (error.code === "VALIDATION")
        return reply.code(400).send(new ApiError("validation", error.message).toJSON());
      return reply
        .code(error.httpStatus)
        .send({ error: { code: error.code.toLowerCase(), message: error.message } });
    }
    const e = error as { statusCode?: number; message: string };
    if (e.statusCode === 429)
      return reply.code(429).send(new ApiError("rate_limited", "Too many requests").toJSON());
    if (e.statusCode && e.statusCode < 500)
      return reply.code(e.statusCode).send(new ApiError("validation", e.message).toJSON());
    req.log.error(error);
    return reply.code(500).send(new ApiError("server", "Something went wrong").toJSON());
  });

  // CSRF: unsafe methods only from the EduKhata web origin (browsers can't forge Origin).
  // Answered here (not thrown): module scopes such as chat have their own error handlers.
  app.addHook("onRequest", async (req, reply) => {
    const safe = req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS";
    if (!safe && req.headers.origin !== config.webUrl) {
      const e = new ApiError("forbidden", "Cross-origin request refused");
      return reply.code(e.status).send(e.toJSON());
    }
    // Chat routes need a chat token: refuse anonymous calls before the module validates input.
    const path = req.url.split("?")[0]!;
    if (
      path.startsWith("/chat/") &&
      path !== "/chat/config" &&
      !path.startsWith("/chat/socket.io") &&
      !/^Bearer \S+/.test(req.headers.authorization ?? "")
    ) {
      const e = new ApiError("unauthorized", "Sign in to chat");
      return reply.code(e.status).send(e.toJSON());
    }
  });

  app.get("/health", async () => ({ ok: true }));
  await app.register(authRoutes, deps);
  await app.register(meRoutes, deps);
  await app.register(adminRoutes, deps);
  await app.register(notificationRoutes, deps);
  await app.register(guardianRoutes, deps);
  await app.register(referralRoutes, deps);
  await app.register(chatRoutes, deps);
  await app.register(catalogRoutes, deps);
  await app.register(mentorRoutes, deps);
  await app.register(orderRoutes, deps);
  await app.register(matchingRoutes, deps);
  await app.register(deliveryRoutes, deps);
  await app.register(reviewRoutes, deps);
  await app.register(paymentRoutes, deps);
  await app.register(ledgerRoutes, deps);
  await app.register(moneyRoutes, deps);
  await app.register(trustRoutes, deps);
  await app.register(growthRoutes, deps);
  await app.register(contentRoutes, deps);
  app.setNotFoundHandler(async () => {
    throw new ApiError("not_found");
  });
  return app;
}
