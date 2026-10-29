import type { FastifyPluginAsync } from "fastify";
import * as oidc from "openid-client";
import { homeFor } from "@edukhata/contracts";
import type { Deps } from "../deps.ts";
import { audit } from "../lib/audit.ts";
import { sha256 } from "../lib/crypto.ts";
import { clearSessionCookie, rolesOf, SESSION_COOKIE, startSession } from "../lib/session.ts";

/** Only same-site paths, never "//host" or "/\\host" (open redirects). */
export function safeNext(v: unknown): string {
  const s = typeof v === "string" ? v : "";
  return /^\/(?![/\\])[\w\-./?=&%~]*$/.test(s) ? s : "";
}

export const authRoutes: FastifyPluginAsync<Deps> = async (app, { db, config, hub }) => {
  const limited = { config: { rateLimit: { max: 30, timeWindow: "5 minutes" } } };

  /** Starts WAN sign-in: remembers state, nonce and the PKCE verifier, then redirects to the hub. */
  app.get<{ Querystring: { next?: string } }>("/auth/login", limited, async (req, reply) => {
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const url = await hub.authorizationUrl({
      state,
      nonce,
      codeChallenge: await oidc.calculatePKCECodeChallenge(codeVerifier),
    });
    await db.query("delete from auth_transactions where expires_at < now()");
    await db.query(
      "insert into auth_transactions (state, nonce, code_verifier, next_path, expires_at) values ($1, $2, $3, $4, now() + interval '10 minutes')",
      [state, nonce, codeVerifier, safeNext(req.query.next)],
    );
    return reply.redirect(url.href);
  });

  /**
   * The hub sends the browser back here. Verifies everything, then upserts the person by
   * `sub` and starts an EduKhata session. Never grants a marketplace role.
   */
  app.get<{ Querystring: Record<string, string> }>(
    "/auth/callback",
    limited,
    async (req, reply) => {
      const q = req.query;
      if (q.error) {
        // The hub refuses users whose EduKhata access is suspended or declined.
        const reason = q.error === "access_denied" ? "denied" : "failed";
        return reply.redirect(`/access-request?reason=${reason}`);
      }
      const state = String(q.state ?? "");
      const t = (
        await db.query<{ nonce: string; code_verifier: string; next_path: string }>(
          "delete from auth_transactions where state = $1 and expires_at > now() returning nonce, code_verifier, next_path",
          [state],
        )
      ).rows[0];
      if (!t) return reply.redirect("/login?error=expired");

      const currentUrl = new URL(`${config.webUrl}/api/auth/callback`);
      for (const [k, v] of Object.entries(q)) currentUrl.searchParams.set(k, String(v));
      let claims;
      try {
        claims = await hub.callback(currentUrl, {
          state,
          nonce: t.nonce,
          codeVerifier: t.code_verifier,
        });
      } catch (error) {
        req.log.warn({ err: error }, "OIDC callback rejected");
        return reply.redirect("/login?error=signin");
      }

      const user = (
        await db.query<{ id: string; status: string }>(
          `insert into users (wan_sub, name, email, email_verified, phone, phone_verified, locale, last_login_at)
         values ($1, $2, $3, $4, $5, $6, $7, now())
         on conflict (wan_sub) do update set
           name = excluded.name, email = excluded.email, email_verified = excluded.email_verified,
           phone = excluded.phone, phone_verified = excluded.phone_verified, locale = excluded.locale,
           last_login_at = now()
         returning id, status`,
          [
            claims.sub,
            claims.name || "WAN user",
            claims.email ?? null,
            claims.email_verified === true,
            claims.phone_number ?? null,
            claims.phone_number_verified === true,
            claims.locale ?? null,
          ],
        )
      ).rows[0]!;
      if (user.status !== "active") return reply.redirect("/access-request?reason=suspended");

      await startSession(db, config, req, reply, user.id);
      await audit(db, { actorId: user.id, action: "auth.login", ip: req.ip });
      const roles = await rolesOf(db, user.id);
      return reply.redirect(roles.length === 0 ? "/onboarding" : t.next_path || homeFor(roles));
    },
  );

  app.post("/auth/logout", async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token)
      await db.query(
        "update sessions set revoked_at = now() where token_hash = $1 and revoked_at is null",
        [sha256(token)],
      );
    clearSessionCookie(config, reply);
    return { ok: true };
  });
};
