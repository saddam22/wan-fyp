# Implementation Roadmap

| Phase | Scope                                                                                                                                                                  | Exit gate                                           | Status                             |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------- |
| 0     | Repository audit, mockup review, inventory, reuse matrix, architecture, traceability                                                                                   | Q1, Q2 answered; Q3–Q13 open (see PROJECT_OVERVIEW) | **Done**                           |
| 1     | Premium frontend: design tokens, components, all public pages, all 6 role dashboards + guardian, all states, mock adapters, responsive, build + Playwright screenshots | **Your review & approval (STOP)**                   | **Done — approved**                |
| 2     | WAN Identity integration (OIDC BFF), hub changes H1–H2, roles, profile gates, auth tests                                                                               | Login/role tests green                              | **Done — approved**                |
| 3     | Chat, calling, notifications/push, ads slots, ICTSpark rule ports (referral, guardian; reviews → Phase 4)                                                              | Integration tests                                   | **Done — waiting for your review** |
| 4     | Catalog, services, orders, matching (concurrency-safe), files, delivery countdown, revisions, approval, disputes, order chats, reviews                                 | E2E order journey                                   | Not started                        |
| 5     | Payments (manual/TrxID + proof), ledger, commission, earnings, payouts, refunds, reconciliation, invoices                                                              | Ledger balances under tests; no duplicate payout    | Not started                        |
| 6     | Verification queue, ranking, skill tests, badges, boosts, subscriptions, CMS/blog, coupons                                                                             |                                                     | Not started                        |
| 7     | Security hardening, unauthorized-access tests, performance, dependency review                                                                                          | Security checklist                                  | Not started                        |
| 8     | Docker, staging, env validation, backups/restore drill, deploy & rollback guide                                                                                        | **Your production approval**                        | Not started                        |

## Phase 1 outcome

Delivered as planned, with two deviations: shared UI lives in `apps/web/src/components` (no separate `packages/ui` yet), and `apps/api` was not scaffolded — it starts in Phase 2 with real routes. Details: `FRONTEND_AUDIT.md` → Phase 1, `TESTING_REPORT.md`.

## Phase 2 outcome

Done: hub H1 + H2 (+ a hub bug fix), `apps/api` (Fastify 5 + PostgreSQL), real WAN sign-in with server-side sessions, onboarding gate, roles in EduKhata, admin role/status management, hub access requests, audit log, entitlement re-check. Not done in Phase 2: RP/back-channel logout (H3), SMS (H4), a UI for listing own sessions (API exists), audit hash chain.

## Phase 3 outcome

Done: notifications (social-module), guardian linking and referral attribution (ICTSpark rules, hardened), support chat (chat-messaging), 1:1 calls (audio-video-calling), ad slots (central-ad-platform SDK). Every module's own test suite ran first. Two small additive upstream changes were made: chat `features.groups` and the ad SDK compiled build. Moved: **reviews to Phase 4** (they need completed orders); **referral rewards to Phase 5** (they need payments). Not done: TURN server, native ringing, email/SMS providers, chat files on S3. Details: `CHAT_AND_COMMUNICATION_INTEGRATION.md`, `ADVERTISING_INTEGRATION.md`, `TESTING_REPORT.md`.

## Next — Phase 4 (marketplace core)

Catalog and services, assignment orders, automatic matching with atomic assignment, files, delivery countdown, revisions, approval, disputes, order conversations (student ↔ assigned mentor through the chat module) and reviews.
