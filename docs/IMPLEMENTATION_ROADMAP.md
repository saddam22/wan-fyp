# Implementation Roadmap

| Phase | Scope                                                                                                                                                                  | Exit gate                                           | Status                             |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------- |
| 0     | Repository audit, mockup review, inventory, reuse matrix, architecture, traceability                                                                                   | Q1, Q2 answered; Q3–Q13 open (see PROJECT_OVERVIEW) | **Done**                           |
| 1     | Premium frontend: design tokens, components, all public pages, all 6 role dashboards + guardian, all states, mock adapters, responsive, build + Playwright screenshots | **Your review & approval (STOP)**                   | **Done — waiting for your review** |
| 2     | WAN Identity integration (OIDC BFF), hub changes H1–H2, roles, profile gates, auth tests                                                                               | Login/role tests green                              | **Done (2026-10-28)**              |
| 3     | Chat, calling, notifications/push, ads slots, ICTSpark rule ports (referral, guardian, reviews)                                                                        | Integration tests                                   | Not started                        |
| 4     | Catalog, services, orders, matching (concurrency-safe), files, delivery countdown, revisions, approval, disputes                                                       | E2E order journey                                   | Not started                        |
| 5     | Payments (manual/TrxID + proof), ledger, commission, earnings, payouts, refunds, reconciliation, invoices                                                              | Ledger balances under tests; no duplicate payout    | Not started                        |
| 6     | Verification queue, ranking, skill tests, badges, boosts, subscriptions, CMS/blog, coupons                                                                             |                                                     | Not started                        |
| 7     | Security hardening, unauthorized-access tests, performance, dependency review                                                                                          | Security checklist                                  | Not started                        |
| 8     | Docker, staging, env validation, backups/restore drill, deploy & rollback guide                                                                                        | **Your production approval**                        | Not started                        |

## Phase 1 outcome

Delivered as planned, with two deviations: shared UI lives in `apps/web/src/components` (no separate `packages/ui` yet), and `apps/api` was not scaffolded — it starts in Phase 2 with real routes. Details: `FRONTEND_AUDIT.md` → Phase 1, `TESTING_REPORT.md`.

## Phase 2 outcome

Done: hub H1 + H2 (+ a hub bug fix), `apps/api` (Fastify 5 + PostgreSQL), real WAN sign-in with server-side sessions, onboarding gate, roles in EduKhata, admin role/status management, hub access requests, audit log, entitlement re-check. Not done in Phase 2: RP/back-channel logout (H3), SMS (H4), a UI for listing own sessions (API exists), audit hash chain.

## Next — Phase 3 (existing module integrations)

Chat (order conversations), 1:1 calls, notifications/push, ad slots, and ICTSpark rule ports (manual payment flow lands in Phase 5; referral, guardian linking, reviews in Phase 3). Each integration starts by running that module's own tests here, like the hub.
