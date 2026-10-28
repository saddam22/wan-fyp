# Identity Integration — WAN Identity Hub

Status: **design only** (Phase 2, after frontend approval).

## Verified facts (from `wan-identity-hub` source)

- OIDC provider at `/oidc` (panva `oidc-provider`): discovery, JWKS, Authorization Code + PKCE S256 required; scopes `openid profile email phone`; only verified contacts are marked verified.
- Clients are configured in `server/src/config.ts` (`AGG_*`, `ADS_*`, `BP_*`) or via `OIDC_CLIENTS` JSON; each client has a `platformId`, and "its entitlement is recorded on sign-in".
- Platform catalog in the hub UI: `src/api/catalog.ts` (each platform: id, name, launchUrl, `selfServiceSignup`, requestable roles).
- `entitlements.status ∈ active | pending | rejected | suspended`; "A platform suspended for a person refuses the sign-in."
- Access requests: user can create/cancel; one pending per platform (unique index). **No endpoint for the platform to approve/reject.**

## Flow

1. Visitor clicks **Login / Register** → EduKhata server starts OIDC (state, nonce, PKCE) → hub login or registration (`?return=…&platform=edukhata`).
2. Callback on EduKhata server → token exchange → validate ID token → upsert `users(sub, name, email_verified, phone_verified)`.
3. Platform access: hub entitlement for `edukhata`.
   - `active` → continue. `suspended` → refused by the hub itself. `pending/none` → "Request access" page linking to hub `#/access-requests`.
4. Marketplace profile gate: until the EduKhata profile is complete (role choice, class/institution for students; application for mentors) only the onboarding pages are reachable.
5. Role-specific actions require the EduKhata role (DB) + any verification condition (e.g. mentor `verified_at`).

## Required hub changes (in `wan-identity-hub`, separate PR, needs your approval)

| # | Change | Reason |
|---|---|---|
| H1 | Register client `edukhata` (`EDK_CLIENT_SECRET`, `EDK_WEB_URL`), platform catalog entry, requestable roles `student`, `guardian`, `mentor` | Login |
| H2 | Server-to-server API for platform backends: read entitlement of a `sub`; approve/reject access request (client-credentials auth) | Spec: "users without permission follow the existing approval process" — today nobody can approve |
| H3 | Back-channel or RP-initiated logout | Sign-out consistency |
| H4 | Email/SMS provider | Hub cannot run in production without one |

Decision needed (Q4): should students self-serve (`selfServiceSignup: true`, entitlement granted at sign-in) and only mentor/staff roles go through approval? Recommended: yes — mentor, accountant, supporter, admin are granted **inside EduKhata** by EduKhata admins, never by hub sign-in.
