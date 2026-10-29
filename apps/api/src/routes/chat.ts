import type { FastifyPluginAsync } from "fastify";
import { CHAT_MAX_UPLOAD } from "../chat/module.ts";
import type { Deps } from "../deps.ts";
import { ApiError } from "../lib/errors.ts";
import { requireUser } from "../lib/session.ts";

/** Chat (WAN chat module): the module's REST API under /chat, plus EduKhata's glue. */
export const chatRoutes: FastifyPluginAsync<Deps> = async (app, { db, config, hub, chat }) => {
  /** A 15-minute chat token for the signed-in person (the session cookie stays httpOnly). */
  app.get("/me/chat-token", async (req, reply) => {
    const s = await requireUser(db, config, hub, req);
    if (s.roles.length === 0)
      throw new ApiError("forbidden", "Finish setting up your profile first");
    reply.header("cache-control", "no-store");
    const t = chat.tokens.issue(s.sessionId);
    return { token: t.token, expiresAt: t.expiresAt.toISOString(), userId: s.user.id };
  });

  await app.register(chat.chat.routes, { prefix: "/chat" });

  // Signed upload target for chat files (stands in for an S3 pre-signed PUT).
  await app.register(async (scope) => {
    scope.removeAllContentTypeParsers();
    scope.addContentTypeParser(
      "*",
      { parseAs: "buffer", bodyLimit: CHAT_MAX_UPLOAD },
      (_req, body, done) => done(null, body),
    );
    scope.put<{
      Params: { "*": string };
      Querystring: { exp?: string; size?: string; sig?: string };
    }>("/chat-files/*", { bodyLimit: CHAT_MAX_UPLOAD }, async (req, reply) => {
      const key = req.params["*"];
      const { exp, size, sig } = req.query;
      const body = req.body as Buffer | undefined;
      const type = req.headers["content-type"] ?? "";
      if (
        !body ||
        !exp ||
        !size ||
        !sig ||
        !chat.storage.verifyUpload(key, Number(exp), Number(size), type, sig) ||
        body.length !== Number(size)
      ) {
        throw new ApiError("forbidden", "Invalid upload URL");
      }
      await chat.storage.put(key, body);
      return reply.code(200).send();
    });
  });
};
