# Changelog

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
