import * as oidc from "openid-client";
import type { Config } from "../config.ts";
import { ApiError } from "./errors.ts";

/**
 * WAN Identity Hub: OIDC sign-in (Authorization Code + PKCE, client_secret_basic) and the
 * hub's platform API (/platform-api/v1) with the same client credentials.
 */
export interface Hub {
  /** Builds the hub authorization URL for a new sign-in. */
  authorizationUrl(p: { state: string; nonce: string; codeChallenge: string }): Promise<URL>;
  /** Exchanges the callback for verified ID token claims (checks state, nonce, PKCE, issuer). */
  callback(
    currentUrl: URL,
    checks: { state: string; nonce: string; codeVerifier: string },
  ): Promise<HubClaims>;
  entitlement(sub: string): Promise<HubEntitlement>;
  setEntitlement(
    sub: string,
    status: "active" | "suspended",
    reason?: string,
  ): Promise<HubEntitlement>;
  accessRequests(status?: string): Promise<HubAccessRequest[]>;
  decideAccessRequest(id: string, approve: boolean, note?: string): Promise<HubAccessRequest>;
}

export interface HubClaims {
  sub: string;
  name: string;
  email?: string;
  email_verified?: boolean;
  phone_number?: string;
  phone_number_verified?: boolean;
  locale?: string;
}

export interface HubEntitlement {
  sub: string;
  platformId: string;
  status: "active" | "pending" | "rejected" | "suspended" | "none";
  roles: string[];
  grantedAt: string | null;
}

export interface HubAccessRequest {
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
}

export const redirectUri = (config: Config) => `${config.webUrl}/api/auth/callback`;

export function createHub(config: Config): Hub {
  let discovered: Promise<oidc.Configuration> | null = null;
  const configuration = () => {
    discovered ??= oidc
      .discovery(
        new URL(`${config.hubUrl}/oidc`),
        config.clientId,
        undefined,
        oidc.ClientSecretBasic(config.clientSecret),
        config.hubUrl.startsWith("http://") ? { execute: [oidc.allowInsecureRequests] } : undefined,
      )
      .catch((error: unknown) => {
        discovered = null; // retry on the next sign-in
        // Say what was asked and what came back (a redirect or 404 means WAN_HUB_URL is wrong).
        const status = (error as { cause?: { status?: unknown } }).cause?.status;
        throw new ApiError(
          "hub_unavailable",
          `WAN Identity Hub is not reachable at ${config.hubUrl}/oidc/.well-known/openid-configuration: ${(error as Error).message}${typeof status === "number" ? ` (HTTP ${status})` : ""}`,
        );
      });
    return discovered;
  };

  const basic = `Basic ${Buffer.from(`${encodeURIComponent(config.clientId)}:${encodeURIComponent(config.clientSecret)}`).toString("base64")}`;
  async function platformApi<T>(method: string, path: string, body?: object): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${config.hubUrl}/platform-api/v1${path}`, {
        method,
        headers: { authorization: basic, ...(body ? { "content-type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      throw new ApiError(
        "hub_unavailable",
        `WAN Identity Hub is not reachable: ${(error as Error).message}`,
      );
    }
    if (res.status === 404) throw new ApiError("not_found");
    if (res.status === 409) throw new ApiError("conflict", "Already decided");
    if (!res.ok) throw new ApiError("hub_unavailable", `WAN Identity Hub answered ${res.status}`);
    return (await res.json()) as T;
  }

  return {
    async authorizationUrl({ state, nonce, codeChallenge }) {
      return oidc.buildAuthorizationUrl(await configuration(), {
        redirect_uri: redirectUri(config),
        scope: "openid profile email phone",
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      });
    },
    async callback(currentUrl, checks) {
      const tokens = await oidc.authorizationCodeGrant(await configuration(), currentUrl, {
        expectedState: checks.state,
        expectedNonce: checks.nonce,
        pkceCodeVerifier: checks.codeVerifier,
        idTokenExpected: true,
      });
      const claims = tokens.claims();
      if (!claims?.sub) throw new ApiError("unauthorized", "No ID token");
      return claims as unknown as HubClaims;
    },
    entitlement: (sub) => platformApi("GET", `/entitlements/${encodeURIComponent(sub)}`),
    setEntitlement: (sub, status, reason) =>
      platformApi("PUT", `/entitlements/${encodeURIComponent(sub)}`, { status, reason }),
    accessRequests: (status = "pending") =>
      platformApi("GET", `/access-requests?status=${encodeURIComponent(status)}`),
    decideAccessRequest: (id, approve, note) =>
      platformApi("POST", `/access-requests/${encodeURIComponent(id)}/decision`, { approve, note }),
  };
}
