import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import type { Deps } from "./deps.ts";
import { ApiError } from "./lib/errors.ts";
import { adminRoutes } from "./routes/admin.ts";
import { authRoutes } from "./routes/auth.ts";
import { meRoutes } from "./routes/me.ts";

export interface AppOptions extends Deps {
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
  await app.register(cookie);
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, { global: true, max: 600, timeWindow: "1 minute" });

  app.setErrorHandler((error, req, reply) => {
    if (error instanceof ApiError) return reply.code(error.status).send(error.toJSON());
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
  await app.register(authRoutes, opts);
  await app.register(meRoutes, opts);
  await app.register(adminRoutes, opts);
  app.setNotFoundHandler(async () => {
    throw new ApiError("not_found");
  });
  return app;
}
