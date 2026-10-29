# Changelog

## 2026-10-29 — Phase 7: security hardening and QA

- Access sweep test over every API route (166): anonymous, student, mentor, accountant, admin, cross-origin, unknown ids; rate-limit tests.
- Fixed: chat routes answered refused cross-site writes with 500; anonymous chat calls were validated before authentication; one notification route checked the session after validation.
- Web security headers (no framing, nosniff, referrer, permissions, CSP basics, HSTS on HTTPS); API request logs without query strings.
- `fastify` 5.12.6 (GHSA-389g-gv7q-r4x8); upstream dev-only advisories documented.
- Seeded performance check (opt-in `PERF=1`).

## 2026-10-29 — Phase 6: trust and growth

- Mentor verification with private documents and an independent reviewer (ICTSpark's application review), revocation, audit of document views.
- Verified mentors rank higher; optional "verified only" matching rule.
- Server-graded skill tests with time limit and retake period; computed badges (verified, skill, top rated, on time, 20+ orders).
- Boosts and Pro paid from mentor earnings through the ledger, labelled as paid, separate from ranking and verification; no auto-renewal.
- Coupons (percent/fixed, caps, limits under lock, released on cancellation) in the live order wizard.
- Blog (mentors submit, another admin publishes) and CMS pages; live public blog and mentor directory.
- Tests: API 85; real end-to-end 7; demo UI suite.

## 2026-10-29 — Phase 5: payments and money

- Manual payments in ICTSpark's flow (bKash/Nagad/Rocket/bank, TrxID + optional proof), with ICTSpark's gaps closed: sign-in and ownership, a unique TrxID index, private proof, accountant verification in one transaction with the ledger and the order.
- Double-entry ledger (balanced and immutable by database triggers, idempotent postings); 20/80 commission frozen per order; mentor earnings pending at approval, available at closure.
- Refunds (cancellations, dispute decisions) and mentor payouts with maker-checker; reconciliation per receiving account; invoices (no VAT, decision Q19).
- Web: pay pages, payments and invoices for students and guardians, accountant verification/payouts/refunds/ledger/reconciliation/receiving accounts/overview, mentor earnings and payouts. Demo-only nav counts hidden with the real backend.
- Tests: API 76; real end-to-end 6, including the full journey order → pay → verify → match → deliver → approve → close → payout; UI 401.

## 2026-10-29 — Phase 4: marketplace core

- Catalog, price list and business rules (commission 20%, 2 free revisions, matching timings; super-admin editable, audited); mentor profiles for matching.
- Orders priced by the server, with private files (signed upload, magic-byte check, EXIF removed, watermarked previews, finals after approval).
- Automatic matching: ranked waves of time-limited offers, atomic first acceptance, capacity under lock, expiry and retry, admin queue, manual assignment and reassignment, release, cancellation.
- Delivery, approval, free and paid revisions (paid ones wait for Phase 5 payment), disputes with release/partial/refund decisions, auto-closure, deadline reminders.
- Order chats via the chat module (former contacts read-only); reviews with moderation of contact details.
- Web: live wizard, order pages for every role, mentor offers and profile, admin disputes/reviews/rules/prices.
- Tests: API 61, real end-to-end 6, UI 401. Open decisions Q16–Q18 added.

## 2026-10-29 — Phase 3: existing module integrations (awaiting review)

- WAN modules as pinned git submodules in `modules/`, built by `pnpm build:modules`.
- Notifications (social-module): bell, inbox, preferences, Web Push plumbing; welcome, role change, guardian, referral, chat and missed-call types.
- Guardian linking (ICTSpark rules, hardened): hashed one-time codes with 24 h expiry, guess limit, max 6 children, student-set permissions, unlink from either side.
- Referrals (ICTSpark rules): codes, `?ref=` links (30 days, first link wins), attribution at first onboarding, Refer & Earn for students and guardians, admin attributions. Rewards come with payments (Phase 5).
- Support chat (chat-messaging): realtime, files with EXIF removed, staff-on-one-side contact rule, groups off, session-bound chat tokens.
- 1:1 audio/video calls (audio-video-calling): overlay on every dashboard page, buttons in chats, missed-call notifications, no recording.
- Ad slots (central-ad-platform SDK) on home and blog: labelled, nothing without settings or fill.
- Upstream (branch `ccr-5992ee5d-65mqhc`): chat-messaging `features.groups`; central-ad-platform SDK compiled build.
- Moved: reviews → Phase 4; referral rewards → Phase 5.
- Tests: API 39, real end-to-end 5, UI 401, module suites run first.

## 2026-10-28 — Phase 2: WAN Identity & access

- New `apps/api` (Fastify 5, PostgreSQL, openid-client): WAN sign-in with Authorization Code + PKCE, server-side sessions (`ek_sid`, hashed, idle/absolute expiry), onboarding gate (student/guardian self-service), EduKhata-owned roles, admin role and suspension management (staff roles super-admin only, last super admin protected), hub access requests, identity audit log, `grant-role` bootstrap CLI, migrations.
- Web: `AUTH_MODE=wan` uses the real session (demo role picker kept for `AUTH_MODE=demo`), `/api` proxied to the API, onboarding submits for real, live `/admin/users`, `/admin/students`, `/admin/access-requests` and `/admin/audit`, access-denied page linking to WAN ID.
- WAN Identity Hub (separate repo, branch `ccr-5992ee5d-65mqhc`): EduKhata client + catalog entry, `/platform-api/v1` (entitlements, access-request decisions), fix for re-requesting access after suspension.
- Tests: API 17, real end-to-end sign-in through the hub 2, UI suite 383, hub 39 + 19 + 10.

## 2026-10-28 — Phase 1: premium frontend (demo data, awaiting review)

- pnpm monorepo: `apps/web` (Next.js 16, React 19, Tailwind 4) and `packages/contracts` (types, money/date helpers, access rules, fixtures, mock adapter).
- 111 pages: public website, sign-in/onboarding, Student, Mentor, Guardian, Admin/Super Admin, Accountant and Supporter dashboards.
- Design tokens from the mockups, per-role accent colours, English + Bengali shell, responsive to 360 px.
- Decisions applied: Live Classes/Exams link to ICTSpark; "with Recording" removed; cart icon → My Orders; mentor/staff roles granted only inside EduKhata.
- Tests: 16 unit, 380 Playwright (3 viewports, every page, access rules, key flows). Lint, typecheck, format and build pass.
- Docs: FRONTEND_AUDIT Phase 1, TESTING_REPORT, traceability FE column (215 features with UI), screenshots.

## 2026-10-28 — Phase 0: audit & plan

- Audited wan-identity-hub, central-ad-platform, chat-messaging, audio-video-calling, social-module, marketplace-jobs, ictspark, wan-fyp (source read, not run).
- Reviewed 3 mockups (2 EduKhata homepage/dashboards, 1 WAN FYP).
- Added docs: inventory, reuse matrix, architecture, identity/ads/payment/chat integration, frontend audit, security findings, roadmap, acceptance criteria, feature traceability matrix (309 features).
