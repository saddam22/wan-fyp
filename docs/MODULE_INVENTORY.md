# Module Inventory — Phase 0

Audit date: 2026-10-28. Every repository below was cloned in this session and its **source was read** (README, docs, manifests, migrations, routes, key services). No repository was built, run or tested in Phase 0; where a repository's own docs report test results, they are quoted as _self-reported_.

## 1. Repositories available

| Repository                                | Branch audited                 | Last commit                                                             | Stack                                                                                         | DB                                      | Auth                                                                                                  |
| ----------------------------------------- | ------------------------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `saddam22/wan-identity-hub`               | `ccr-5992ee5d-65mqhc` (= main) | cb08948 Blood Probashi as a WAN sign-in client                          | React 19 SPA (custom bundler) + Fastify server, TypeScript                                    | PostgreSQL                              | Owns identity; OIDC provider (`oidc-provider`), cookie sessions + CSRF, TOTP 2FA                      |
| `saddam22/central-ad-platform`            | same                           | 13d24d4 first run on PostgreSQL, WAN Identity Hub login, Next.js 16.4.2 | Next.js 16 web + Fastify API + `@adp/sdk` (web, React Native), TypeScript                     | PostgreSQL (9 migrations)               | OIDC resource server (`OIDC_ISSUER`; Keycloak default, WAN hub client `ads` exists)                   |
| `saddam22/chat-messaging`                 | same                           | 7aad607                                                                 | Fastify 5 plugin + Socket.IO + Drizzle, `@chat-module/{core,server,client,react}`, pnpm       | PostgreSQL (+ `pg_trgm`)                | Host-supplied: `ChatHost.authenticate(token)`                                                         |
| `saddam22/audio-video-calling`            | same                           | 539d2e6                                                                 | `@calling/{core,server,client,react}`, WebRTC P2P + STUN/TURN, WebSocket signalling, pnpm     | PostgreSQL or in-memory store           | Host-supplied                                                                                         |
| `saddam22/social-module`                  | same                           | 7390f75                                                                 | `@amar/social-modules` framework-agnostic TS services + React UI; Prisma reference adapter    | Host-supplied (Prisma reference schema) | Host builds `Actor` server-side                                                                       |
| `saddam22/marketplace-jobs` ("Local Hub") | same                           | 9e31a9e                                                                 | Fastify plugin + SQL migrations + Next.js 16 / Tailwind 4 screens, pnpm                       | PostgreSQL                              | Host-supplied                                                                                         |
| `saddam22/ictspark` (ICT School)          | same                           | 16820bd                                                                 | **MERN**: Express 4 + Mongoose + Socket.IO; React 18 + Vite + Tailwind + Zustand (JavaScript) | **MongoDB**                             | Own JWT + refresh cookie, own `User` with roles `super_admin, admin, teacher, student, parent, agent` |
| `saddam22/wan-fyp`                        | same                           | 33352fa Initial commit                                                  | — (README only)                                                                               | —                                       | —                                                                                                     |

EduKhata is developed in `saddam22/wan-fyp` (owner decision, 2026-10-28). The WAN FYP portal mockup is a separate, later project.

## 2. What each repository actually provides (verified by reading code)

### WAN Identity Hub

- Endpoints: registration (contact verified first), login + lockout + TOTP 2FA, password reset, profile, avatar, identity documents (always "under review", never auto-verified), platforms, `GET /me/entitlements`, access requests (create/cancel), security/sessions/devices, activity, notifications, admin role-builder (draft/submit only), audit.
- OIDC: discovery, JWKS, Authorization Code + PKCE (S256), scopes `profile email phone`. Clients configured in `server/src/config.ts` (`AGG_*`, `ADS_*`, `BP_*`) or `OIDC_CLIENTS` JSON. A client with `resource` gets RS256 JWT access tokens.
- Entitlement model: `entitlements(user_id, platform_id, status active|pending|rejected|suspended, roles[], permissions[])`. Hub records but never computes platform access.
- **Gaps relevant to EduKhata:** no server-to-server API for a platform to read a user's entitlement or to approve/reject an access request; no admin approval of role submissions; email/SMS providers not implemented (dev outbox only; production refuses to start without them); passkeys/Google/Apple refuse; no back-channel logout; KYC review workflow missing.

### Central Ad Platform

- Advertisers, businesses, ad accounts (BDT/USD), maker-checker funding, campaigns → ad sets → ads, review queue, formats `text, native, banner_300x250, banner_320x50, video_reel, video_instream`, SDK `<AdSlot client placement contentId/>`, viewability-based impressions, IVT filtering, reports, daily settlement into ledger, reconciliation checks, creator program (B1–B3), stars/tips (simulated).
- App integration: register app + placements in Platform admin → public SDK key `app_…`; optional server secret `aps_…` for content ownership. "Students use this app" flag blocks finance/health ads; gambling/dating/tobacco/alcohol always blocked; "max ads per page".
- **Self-reported:** core 80/80, SDK 9/9, Chromium 25/25; DB integration tests "written, not yet run" in HANDOFF.md (latest commit says first PostgreSQL run happened — needs re-verification).
- Payments are simulation only (DB-enforced).

### Chat Messaging

- 1:1 and group chats, text/image/file/voice, replies, edits, deletes, reactions, typing, delivered/read cursors, presence, search, block, rate limits, magic-byte file checks, signed attachment URLs, S3-compatible storage port.
- Integration: git submodule into host pnpm workspace; host implements `ChatHost` (authenticate, user lookup, search, block).
- **Gap:** conversation kinds are `direct | group` only — no "context" (order) reference; order chats must be mapped in EduKhata's DB.

### Audio/Video Calling

- One-to-one audio/video, server-authoritative signalling, call history, TURN credentials, block-aware, bn/en React UI.
- **Not available:** group calls, screen share, **recording** (explicitly absent), scheduling.

### Social Module

- Notifications (registry, aggregation, preferences, quiet hours, deep links), Follow, Groups, Pages (with reviews, verification requests), Web Push delivery worker, email adapter _interface_.
- Host supplies repositories (Prisma reference schema provided), routes and auth.
- **No posts/feed storage** — "posts" belong to the host app.

### Marketplace / Jobs (Local Hub)

- Services directory, maps, events, emergency directory, classified **marketplace listings** (draft→published→sold, saves, inquiries) and **jobs** (applications, employer).
- Explicitly **no payments, escrow, delivery or orders** (`docs/architecture.md`).
- Conclusion: does not support assignment ordering, matching, revisions or file delivery. Reusable as UI/contract _patterns_ (Next.js 16 + Tailwind 4 + Bengali fonts) and for reviews/moderation logic ideas, not as the order engine.

### ICTSpark (ICT School)

- Courses, live classes, exams, assignments (course homework, not marketplace), notes, question bank, certificates, forum, rewards/XP/badges, blog, reviews (text + video, admin approval), chat (own Socket.IO), support, website messages, referral (code `ICTBD-NAME-XXXX`, `?ref=`, first-payment commission, admin payout), agent/branch system, parent linking (one-time link code, max 6 children), marketing (UTM, scheduler), mentor applications, university application service, code lab.
- **Payments:** providers `bkash, nagad, rocket, card, mock, manual, sendmoney, sslcommerz`; statuses `pending, paid, failed, cancelled, refunded`; manual "send money + TrxID" flow with admin verification (details in `PAYMENT_AND_COMMISSION.md`); PDF invoices.
- **Not reusable as shared code** without a large refactor: different language (JS), DB (MongoDB), auth (own JWT users, not WAN Identity) and runtime model. Reuse = port the proven business rules and UX into EduKhata, or call ICTSpark over HTTP for features that should stay there (decision Q3).

## 3. Missing items / things I could not inspect

| Item                                                                                                     | Why it matters                                                                                           |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| ICTSpark production configuration (payment accounts, SSLCommerz/bKash merchant credentials)              | Gateway flows cannot be verified; only the manual flow is usable                                         |
| WAN Identity Hub deployment URL + production client registration process                                 | Needed for Phase 2                                                                                       |
| Central Ad Platform deployment URL, an `app_…` key for EduKhata                                          | Needed for ad placements                                                                                 |
| Email + SMS provider choice                                                                              | Hub cannot run in production without one; also needed for order notifications                            |
| Object storage (S3/R2/MinIO) for private files                                                           | Chat module + order files require it                                                                     |
| HD originals of the mockups                                                                              | Supplied images are phone screenshots (~720 px wide); small text is unreadable (see `FRONTEND_AUDIT.md`) |
| Legal review: platform-held funds ("money hold"), academic-integrity terms, NID handling, call recording | Blocks finalizing payments, verification and recording                                                   |
