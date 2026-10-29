# Identity Integration — WAN Identity Hub

Status: **implemented in Phase 2 (2026-10-28)**, tested against the real hub.

## How it works

```
Browser ──► EduKhata web (Next.js, :3200) ──/api/* rewrite──► EduKhata API (Fastify, :4200)
   │                                                               │  OIDC client "edukhata"
   └──────────── WAN Identity Hub (:4100) ◄────────────────────────┘  + /platform-api/v1
```

1. **Sign in** — `/login` → "Continue with WAN ID" → `GET /api/auth/login?next=…`. The API stores `state`, `nonce` and a PKCE verifier (`auth_transactions`, 10 min, single use) and redirects to the hub's `/oidc/auth` (Authorization Code + PKCE S256, scopes `openid profile email phone`).
2. **Hub** — not signed in → the hub's own login or registration, then back. A user whose EduKhata entitlement is suspended or declined is refused by the hub (`error=access_denied`).
3. **Callback** — `GET /api/auth/callback`: openid-client verifies state, issuer (`iss`), PKCE, nonce and the RS256 ID token (client authentication `client_secret_basic`). The person is upserted by `sub` (name, verified email/phone, locale). **No role is granted.** A new session starts (`ek_sid`: random, httpOnly, SameSite=Lax, Secure in production; only its SHA-256 is stored; 12 h idle / 7 days absolute).
4. **Profile gate** — people without any marketplace role land on `/onboarding`; every dashboard redirects there until it's done. Students and guardians get their role there (decision Q4). Mentor and staff roles are only granted by EduKhata admins (`/admin/users`); the first super admin is created on the server with `pnpm --filter @edukhata/api grant-role <email> super_admin`.
5. **Platform access** — every `HUB_CHECK_INTERVAL_SEC` (default 10 min) a session re-reads the user's EduKhata entitlement from the hub's platform API. Suspended/declined → all the user's EduKhata sessions end and the web shows `/access-request?reason=denied` with a link to request access again in the hub. If the hub is unreachable the session continues (the hub allowed this sign-in) and the check is retried.
6. **Access requests** — requests made in the hub for EduKhata appear in `/admin/access-requests`; approving/declining writes back to the hub (which notifies the person).
7. **Sign out** — revokes the EduKhata session. It does not sign the person out of WAN Identity (RP-initiated/back-channel logout is still open, M02-16).

## Hub changes (in `saddam22/wan-identity-hub`, branch `ccr-5992ee5d-65mqhc`)

| #   | Change                                                                                                                                                                                | Status     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| H1  | Client `edukhata` (`EDK_CLIENT_SECRET`, `EDK_WEB_URL`; callback `<EDK_WEB_URL>/api/auth/callback`), catalog entry, "Member" requestable role, bn/en strings, rebuilt `dist/`          | Done       |
| H2  | `/platform-api/v1` (client credentials, HTTP Basic): `GET/PUT /entitlements/{sub}`, `GET /access-requests`, `POST /access-requests/{id}/decision` (row-locked), notifications + audit | Done       |
| H2b | Fix: a suspended/declined user can request access again (found by the EduKhata e2e test)                                                                                              | Done       |
| H3  | Back-channel or RP-initiated logout                                                                                                                                                   | Open       |
| H4  | SMS provider (email via Resend already exists)                                                                                                                                        | Open (Q10) |

Hub tests after the change: server 39/39, frontend unit 19/19, browser 10/10.

## Realtime modules (Phase 3)

The chat and calling modules authenticate with bearer tokens, not cookies. `GET /api/me/chat-token` (cookie session, onboarded users only) returns a 15-minute HMAC token `base64url(sessionId.expiry).sig` signed with `CHAT_SECRET`. The modules call `sessionTokenAuth`, which accepts the token only while its session is not revoked, expired or idle, and the user is active with at least one marketplace role. Signing out, suspension or hub denial therefore also ends chat and call access. The browser fetches a fresh token before expiry and never sees the session cookie.

## Configuration

| Where | Variable                                                       | Meaning                                                                         |
| ----- | -------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Hub   | `EDK_CLIENT_SECRET`                                            | 32+ chars; required in production to enable the client                          |
| Hub   | `EDK_WEB_URL`                                                  | EduKhata web origin (callback + platforms page link)                            |
| API   | `WAN_HUB_URL`, `EDK_CLIENT_ID`, `EDK_CLIENT_SECRET`            | Same secret as the hub                                                          |
| API   | `WEB_URL`                                                      | Web origin; writes must carry this `Origin`                                     |
| API   | `HUB_CHECK_INTERVAL_SEC`                                       | Entitlement re-check interval                                                   |
| Web   | `AUTH_MODE=wan`, `API_INTERNAL_URL`, `NEXT_PUBLIC_WAN_HUB_URL` | Real sign-in; `AUTH_MODE=demo` keeps the Phase 1 role picker for design reviews |
