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
import { catalogRoutes } from "./routes/catalog.ts";
import { chatRoutes } from "./routes/chat.ts";
import { mentorRoutes } from "./routes/mentors.ts";
import { orderRoutes } from "./routes/orders.ts";

export interface AppOptions extends Omit<Deps, "notifications" | "chat" | "calling"> {
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
  };
  // The chat module keeps its own migration history (drizzle.__chat_migrations); the
  // calling module creates its two tables if missing (calls, call_active_users).
  // Tests reach the module handles (e.g. to attach the call gateway).
  app.decorate("edkDeps", deps);
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
  app.addHook("onRequest", async (req) => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return;
    if (req.headers.origin !== config.webUrl)
      throw new ApiError("forbidden", "Cross-origin request refused");
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
  app.setNotFoundHandler(async () => {
    throw new ApiError("not_found");
  });
  return app;
}
