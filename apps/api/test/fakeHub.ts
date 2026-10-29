/**
 * A stand-in WAN Identity Hub for API tests: real OIDC discovery, JWKS, a token endpoint
 * that checks client_secret_basic + PKCE + redirect_uri, RS256 ID tokens, and the
 * platform API. The real hub is exercised by the end-to-end suite.
 */
import { createHash, randomBytes } from "node:crypto";
import Fastify from "fastify";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

export interface FakeHub {
  url: string;
  issuer: string;
  /** Simulates the browser visiting the authorization URL as `sub`; returns the callback query. */
  authorize(
    authUrl: string,
    user: { sub: string; name: string; email?: string },
    opts?: { nonce?: string },
  ): Record<string, string>;
  entitlements: Map<string, string>;
  requests: {
    id: string;
    sub: string;
    name: string;
    username: string;
    roleId: string;
    roleName: string;
    reason: string;
    status: string;
    createdAt: string;
    decidedAt: string | null;
    reviewerNote: string | null;
  }[];
  down: boolean;
  close(): Promise<void>;
}

export async function startFakeHub(clientId: string, clientSecret: string): Promise<FakeHub> {
  const app = Fastify();
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256", use: "sig" };
  const codes = new Map<
    string,
    {
      nonce: string;
      challenge: string;
      redirect: string;
      user: { sub: string; name: string; email?: string };
    }
  >();
  let issuer = ""; // set once listening
  const hub: FakeHub = {
    url: "",
    issuer: "",
    entitlements: new Map(),
    requests: [],
    down: false,
    authorize(authUrl, user, opts = {}) {
      const u = new URL(authUrl);
      if (u.searchParams.get("client_id") !== clientId) throw new Error("wrong client");
      if (u.searchParams.get("code_challenge_method") !== "S256")
        throw new Error("PKCE S256 required");
      const code = randomBytes(16).toString("hex");
      codes.set(code, {
        nonce: opts.nonce ?? u.searchParams.get("nonce")!,
        challenge: u.searchParams.get("code_challenge")!,
        redirect: u.searchParams.get("redirect_uri")!,
        user,
      });
      hub.entitlements.set(user.sub, hub.entitlements.get(user.sub) ?? "active");
      return { code, state: u.searchParams.get("state")!, iss: issuer };
    },
    async close() {
      await app.close();
    },
  };

  /** client_secret_basic: both parts are form-encoded (RFC 6749 §2.3.1). */
  const authed = (h: string | undefined) => {
    const m = /^Basic (.+)$/.exec(h ?? "");
    if (!m) return false;
    const [id, secret] = Buffer.from(m[1]!, "base64")
      .toString()
      .split(":")
      .map((x) => decodeURIComponent(x));
    return id === clientId && secret === clientSecret;
  };

  app.addHook("onRequest", async (_req, reply) => {
    if (hub.down) return reply.code(503).send({ error: "down" });
  });
  app.get("/oidc/.well-known/openid-configuration", async () => ({
    issuer,
    authorization_endpoint: `${issuer}/auth`,
    token_endpoint: `${issuer}/token`,
    jwks_uri: `${issuer}/jwks`,
    response_types_supported: ["code"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["client_secret_basic"],
    authorization_response_iss_parameter_supported: true,
  }));
  app.get("/oidc/jwks", async () => ({ keys: [jwk] }));
  app.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_r, body, done) => done(null, Object.fromEntries(new URLSearchParams(String(body)))),
  );
  app.post<{ Body: Record<string, string> }>("/oidc/token", async (req, reply) => {
    if (!authed(req.headers.authorization))
      return reply.code(401).send({ error: "invalid_client" });
    const c = codes.get(req.body.code ?? "");
    codes.delete(req.body.code ?? "");
    if (!c) return reply.code(400).send({ error: "invalid_grant" });
    const challenge = createHash("sha256")
      .update(req.body.code_verifier ?? "")
      .digest("base64url");
    if (challenge !== c.challenge || req.body.redirect_uri !== c.redirect)
      return reply.code(400).send({ error: "invalid_grant" });
    const idToken = await new SignJWT({
      nonce: c.nonce,
      name: c.user.name,
      email: c.user.email,
      email_verified: true,
    })
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer(issuer)
      .setAudience(clientId)
      .setSubject(c.user.sub)
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(privateKey);
    return { access_token: "opaque", token_type: "Bearer", expires_in: 600, id_token: idToken };
  });

  app.get<{ Params: { sub: string } }>("/platform-api/v1/entitlements/:sub", async (req, reply) => {
    if (!authed(req.headers.authorization)) return reply.code(401).send({});
    return {
      sub: req.params.sub,
      platformId: "edukhata",
      status: hub.entitlements.get(req.params.sub) ?? "none",
      roles: ["Member"],
      grantedAt: null,
    };
  });
  app.get("/platform-api/v1/access-requests", async (req, reply) => {
    if (!authed(req.headers.authorization)) return reply.code(401).send({});
    return hub.requests.filter((r) => r.status === "pending");
  });
  app.post<{ Params: { id: string }; Body: { approve: boolean } }>(
    "/platform-api/v1/access-requests/:id/decision",
    async (req, reply) => {
      if (!authed(req.headers.authorization)) return reply.code(401).send({});
      const r = hub.requests.find((x) => x.id === req.params.id);
      if (!r) return reply.code(404).send({});
      if (r.status !== "pending") return reply.code(409).send({});
      r.status = req.body.approve ? "approved" : "rejected";
      if (req.body.approve) hub.entitlements.set(r.sub, "active");
      return r;
    },
  );
  await app.listen({ port: 0, host: "127.0.0.1" });
  hub.url = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`;
  hub.issuer = issuer = `${hub.url}/oidc`;
  return hub;
}
