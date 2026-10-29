# Implementation Roadmap

| Phase | Scope                                                                                                                                                                  | Exit gate                                           | Status                             |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------- |
| 0     | Repository audit, mockup review, inventory, reuse matrix, architecture, traceability                                                                                   | Q1, Q2 answered; Q3–Q13 open (see PROJECT_OVERVIEW) | **Done**                           |
| 1     | Premium frontend: design tokens, components, all public pages, all 6 role dashboards + guardian, all states, mock adapters, responsive, build + Playwright screenshots | **Your review & approval (STOP)**                   | **Done — approved**                |
| 2     | WAN Identity integration (OIDC BFF), hub changes H1–H2, roles, profile gates, auth tests                                                                               | Login/role tests green                              | **Done — approved**                |
| 3     | Chat, calling, notifications/push, ads slots, ICTSpark rule ports (referral, guardian; reviews → Phase 4)                                                              | Integration tests                                   | **Done — waiting for your review** |
| 4     | Catalog, services, orders, matching (concurrency-safe), files, delivery countdown, revisions, approval, disputes, order chats, reviews                                 | E2E order journey                                   | **Done**                           |
| 5     | Payments (manual/TrxID + proof), ledger, commission, earnings, payouts, refunds, reconciliation, invoices                                                              | Ledger balances under tests; no duplicate payout    | **Done**                           |
| 6     | Verification queue, ranking, skill tests, badges, boosts, subscriptions, CMS/blog, coupons                                                                             |                                                     | **Done**                           |
| 7     | Security hardening, unauthorized-access tests, performance, dependency review                                                                                          | Security checklist                                  | **Done**                           |
| 8     | Docker, staging, env validation, backups/restore drill, deploy & rollback guide                                                                                        | **Your production approval**                        | Not started                        |

## Phase 1 outcome

Delivered as planned, with two deviations: shared UI lives in `apps/web/src/components` (no separate `packages/ui` yet), and `apps/api` was not scaffolded — it starts in Phase 2 with real routes. Details: `FRONTEND_AUDIT.md` → Phase 1, `TESTING_REPORT.md`.

## Phase 2 outcome

Done: hub H1 + H2 (+ a hub bug fix), `apps/api` (Fastify 5 + PostgreSQL), real WAN sign-in with server-side sessions, onboarding gate, roles in EduKhata, admin role/status management, hub access requests, audit log, entitlement re-check. Not done in Phase 2: RP/back-channel logout (H3), SMS (H4), a UI for listing own sessions (API exists), audit hash chain.

## Phase 3 outcome

Done: notifications (social-module), guardian linking and referral attribution (ICTSpark rules, hardened), support chat (chat-messaging), 1:1 calls (audio-video-calling), ad slots (central-ad-platform SDK). Every module's own test suite ran first. Two small additive upstream changes were made: chat `features.groups` and the ad SDK compiled build. Moved: **reviews to Phase 4** (they need completed orders); **referral rewards to Phase 5** (they need payments). Not done: TURN server, native ringing, email/SMS providers, chat files on S3. Details: `CHAT_AND_COMMUNICATION_INTEGRATION.md`, `ADVERTISING_INTEGRATION.md`, `TESTING_REPORT.md`.

## Phase 4 outcome

Done (API + web in `AUTH_MODE=wan`):

- Admin-managed catalog, price list and business rules.
- Mentor profiles.
- Orders priced by the server, with private files (magic-byte checked, EXIF removed, previews watermarked).
- Automatic matching: ranked waves of time-limited offers, first valid acceptance wins atomically, capacity enforced, expiry and retry, fallback to the admin queue, manual assignment and reassignment, release, cancellation.
- Delivery, approval, free and paid revisions, disputes (release, partial or full refund), auto-closure and deadline reminders.
- Order chats through the chat module, with former contacts made read-only.
- Reviews with moderation of contact details.

The full browser journey needs payment approval to start matching; it comes with Phase 5. Mentor "services" (per-mentor price lists) are not built: matching uses the platform price list, so any eligible mentor can take any order at one price. Per-mentor pricing would change matching and is left for a decision.

## Phase 5 outcome

Done (API + web, `AUTH_MODE=wan`): ICTSpark's manual payment flow with S1–S4 closed (sign-in and ownership, unique TrxID index, private proof, accountant verification in one transaction), receiving accounts, double-entry ledger with database-enforced balance and immutability, 20/80 commission frozen per order, mentor pending → available earnings, payouts and refunds with maker-checker, reconciliation, invoices, and the accountant, mentor, student and guardian money pages. The full browser journey (order → pay → verify → match → deliver → approve → close → payout) runs end to end against the real hub, API and web. Fees, refunds and tax rules: `PAYMENT_AND_COMMISSION.md`. Not built: gateways (no merchant credentials), referral rewards (needs a reward rule), statement import.

## Phase 6 outcome

Done (API + web, `AUTH_MODE=wan`):

- **Mentor verification.** Follows ICTSpark's MentorApplication review. Documents are private (magic bytes checked, EXIF removed, served sandboxed) and every view by a reviewer is audited. A different admin approves or sends back with a reason, and can later revoke.
- **Matching and directory.** Verified mentors rank higher. An optional `require_verified_mentors` rule limits offers to verified mentors.
- **Skill tests.** Server-graded: answers are never sent to the browser, there is a time limit and a retake period.
- **Badges.** Computed from checked facts: verified, skill, top rated, on time, 20+ orders.
- **Paid boosts and Pro.**
  - Bought from earnings through the ledger, with no auto-renewal.
  - Always labelled "paid" and shown in a separate Featured row.
  - They never change the organic order, matching or verification.
- **Coupons.** Server-checked, with limits under a row lock, and released on cancellation.
- **Blog.** Mentors and staff write posts; another admin publishes them (ICTSpark's status flow). CMS pages are served at `/p/…`.
- **Public pages.** The live mentor directory and blog.

Not built:

- Student ranking or leaderboard: `/leaderboard` still shows sample data.
- Student or institution verification.
- Profile completion score.
- A jobs/tuition board: `marketplace-jobs` is a different domain, a job board with applications. It is kept for a later decision rather than bolted on.
- Banners and website messaging admin pages: still sample data.

## Phase 7 outcome

Done:

- An automated access sweep over all 166 API routes (anonymous, each role, cross-origin, unknown ids). It found and fixed three issues.
- Rate-limit tests.
- Web security headers.
- Query strings dropped from logs.
- A dependency audit: `fastify` upgraded; two upstream dev-only advisories in the chat submodule.
- A secrets check.
- A seeded performance check.

The production checklist is in `SECURITY_AUDIT.md`. Open blockers for production:

- Hub SMS/email providers (S6).
- A TURN server.
- Malware scanning of uploads (recommended).
- A third-party penetration test (recommended).

## Next — Phase 8

Docker images and compose, environment validation, backup and restore scripts with a drill, a staging configuration, and the deploy and rollback guide. **No production deployment without the owner's approval.**
