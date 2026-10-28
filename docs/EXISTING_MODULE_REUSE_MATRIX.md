# Existing Module Reuse Matrix

For each candidate integration: source, what exists, integration method, auth, data ownership, what is missing, security implications, tests. "Proposed" = my recommendation, pending your approval.

## Summary

| Capability                                         | Source                      | Proposed reuse                                                       | Integration method                                                         |
| -------------------------------------------------- | --------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Identity, login, registration, 2FA, password reset | wan-identity-hub            | **Reuse (mandatory)**                                                | OIDC Code + PKCE; EduKhata is a confidential client                        |
| Platform access / roles                            | wan-identity-hub + EduKhata | **Split**: hub = "may use EduKhata"; EduKhata DB = marketplace roles | Hub extension needed (server-to-server entitlement API)                    |
| Chat                                               | chat-messaging              | **Reuse**                                                            | git submodule + `ChatHost` adapter in EduKhata API (Fastify 5, PostgreSQL) |
| 1:1 calls                                          | audio-video-calling         | **Reuse** (1:1 only)                                                 | git submodule + host adapter                                               |
| Notifications, push, follow, groups                | social-module               | **Reuse**                                                            | npm/git dependency + Postgres repositories                                 |
| Ads / sponsored content                            | central-ad-platform         | **Reuse** for labelled ad slots                                      | `@adp/sdk` `<AdSlot>` + register app & placements                          |
| Paid profile boosts / featured mentors             | —                           | **Build in EduKhata**                                                | Marketplace monetization, not advertising                                  |
| Manual payment + TrxID verification                | ictspark                    | **Port business rules** (not code)                                   | Re-implement in TS/PostgreSQL with fixes                                   |
| Ledger, maker-checker, reconciliation, audit chain | central-ad-platform         | **Port patterns**                                                    | Re-implement                                                               |
| Referral                                           | ictspark                    | **Port rules**                                                       | Re-implement, ledger-backed                                                |
| Guardian linking                                   | ictspark                    | **Port rules** (one-time link code)                                  | Re-implement                                                               |
| Reviews (text/video, moderation)                   | ictspark                    | **Port rules**                                                       | Re-implement                                                               |
| Blog, forum, rewards, marketing                    | ictspark                    | **Link out / later**                                                 | Decision Q3                                                                |
| Listings / jobs                                    | marketplace-jobs            | **Do not use as order engine**; reuse UI stack conventions           | —                                                                          |
| Mentor skill tests                                 | ictspark exam engine        | **Later** (Phase 6)                                                  | Decision Q3                                                                |

## Detail

### 1. WAN Identity Hub

1. **Source:** `saddam22/wan-identity-hub` (`server/src/oidc`, `routes/platforms.ts`, `migrations/001_init.sql`).
2. **Existing:** accounts, verified contacts, 2FA, sessions, OIDC provider, entitlement + access-request tables, hub-side documents (under review).
3. **Method:** OIDC Authorization Code + PKCE from the EduKhata **server** (BFF). New client `edukhata` (platformId `edukhata`) in `config.ts`/`OIDC_CLIENTS`.
4. **Auth:** client secret ≥ 32 chars, server-side only.
5. **Data ownership:** hub owns person/contacts/credentials; EduKhata owns marketplace profile, roles, orders, money. Join key = OIDC `sub`.
6. **Missing:** server-to-server entitlement read; platform-side approve/reject of access requests; email/SMS providers; back-channel logout; KYC review.
7. **Security:** never put tokens in the browser; EduKhata session cookie httpOnly; re-check entitlement on login and periodically; respect hub "suspended".
8. **Tests:** login happy path, no-entitlement → access-request page, suspended platform refused, role escalation impossible from the client.

### 2. Central Advertising Platform

1. **Source:** `saddam22/central-ad-platform` (`docs/integrating-an-app.md`, `packages/sdk`).
2. **Existing:** campaign stack, review, SDK, placements, child-safety flag, reports.
3. **Method:** register app `edukhata`, placements e.g. `home-feed` (native), `blog-end` (text/native), `mentor-list` (native), `order-success` (banner_300x250). Render `<AdSlot>`.
4. **Auth:** public `app_…` key in the web app; no user data sent (contextual only).
5. **Ownership:** ad platform owns campaigns, money and counting.
6. **Missing:** nothing needed for basic slots; EduKhata should enable "Students use this app".
7. **Security/trust:** ads always labelled "Sponsored/বিজ্ঞাপন"; never inside order, payment, exam or dispute screens; no incentives for clicking; organic ranking never influenced by ad spend.
8. **Tests:** SDK renders nothing when no ad; no ad on blocked routes; label present.

### 3. Chat Messaging

1. **Source:** `saddam22/chat-messaging`.
2. **Existing:** full chat incl. files and realtime.
3. **Method:** submodule under `modules/chat`; mount Fastify plugin at `/chat`; `ChatHost` maps EduKhata session → user UUID.
4. **Auth:** EduKhata-issued short-lived token verified server-side.
5. **Ownership:** chat tables in EduKhata's PostgreSQL (module schema); `order_conversations(order_id, conversation_id)` in EduKhata.
6. **Missing:** order context on conversations (mapping table instead of changing the module); supporter joining an order conversation (group membership API covers it).
7. **Security:** only order participants + assigned supporter/admin are members; chat files private bucket; block respected.
8. **Tests:** non-participant cannot read order chat; mentor removed on reassignment.

### 4. Audio/Video Calling

1. Source `saddam22/audio-video-calling`. 2. 1:1 WebRTC calls + history. 3. Submodule + host adapter; TURN required in production. 4. Host auth. 5. Call history in EduKhata DB. 6. **Missing: recording, scheduling, group calls** — "Live Chat & Video with Recording" in the mockup cannot be delivered from this module; needs a new decision (SFU/recording provider + consent + retention). 7. Calls allowed only between order participants. 8. E2E in two Chromium contexts (module already has this pattern).

### 5. Social Module

1. Source `saddam22/social-module`. 2. Notifications, follow, groups, pages, push. 3. Dependency + Postgres repositories (port Prisma reference to EduKhata's data layer). 4. Actor built server-side. 5. EduKhata DB. 6. Email delivery is an interface only; SMS absent; no posts store. 7. Notification deep links must be in-app paths only. 8. Notification per order event; preferences honored; mandatory types (payment, deadline) cannot be muted.

### 6. Marketplace / Jobs

1. Source `saddam22/marketplace-jobs`. 2. Listings, jobs, services directory — no orders/payments. 3. **Not integrated** as the order engine. Optional later: cross-post "mentor wanted" jobs. 4–8. N/A until approved.

### 7. ICTSpark

1. Source `saddam22/ictspark`. 2. Payments (manual + gateways), referral, guardian, reviews, blog, forum, rewards, support, marketing, mentor applications. 3. **Port rules** into EduKhata (TS/PostgreSQL) because of stack/auth mismatch; or HTTP integration if you want one shared blog/forum (Q3). 4. ICTSpark has its own users — no WAN Identity login today. 5. Separate DB. 6. See `SECURITY_AUDIT.md` (manual-payment endpoints without auth, race on TrxID uniqueness, no proof upload, no accountant role). 7. Do not copy those weaknesses. 8. Port ICTSpark's behaviour as test cases.
