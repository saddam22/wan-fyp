# Testing Report

## Phase 2 — identity & access (2026-10-28)

| Suite                                                                                                   | Where                               | Result                                      |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------- |
| EduKhata API integration (Vitest, real PostgreSQL, stand-in hub with real RS256 ID tokens)              | `apps/api/test`                     | **17 / 17** (stable over repeated runs)     |
| Real end-to-end sign-in (Playwright): **real WAN Identity Hub** + EduKhata API + web in `AUTH_MODE=wan` | `apps/web/e2e-wan` (`pnpm e2e:wan`) | **2 / 2**, 5 consecutive green runs         |
| Demo-mode UI suite (unchanged pages + new access-requests page)                                         | `apps/web/e2e`                      | **383 pass**, 2 skipped                     |
| Unit (contracts + i18n)                                                                                 | `pnpm test`                         | 16 / 16                                     |
| Lint, typecheck, format, build                                                                          | `pnpm check`                        | Pass                                        |
| WAN Identity Hub after its changes                                                                      | hub repo                            | server **39/39**, unit 19/19, browser 10/10 |

The real end-to-end journey: register a WAN ID on the hub → "Continue with WAN ID" → onboarding gate → student dashboard → no access to admin/mentor → second person signs in, `grant-role` CLI makes them super admin → super admin grants the student the mentor role in `/admin/users` → student opens the mentor dashboard → audit log shows it → the hub suspends the student's EduKhata access via the platform API → the student's next page ends the session (`/access-request?reason=denied`) and WAN sign-in is refused → the student asks again in the hub → the admin approves in `/admin/access-requests` → the student signs in again → sign out. Plus: cross-site write refused, unauthenticated admin call refused.

API integration tests also cover: PKCE/state/nonce/redirect URI, replayed and unknown state, wrong nonce, hub `access_denied`, open-redirect attempts, cookie flags, token stored hashed, Origin check, onboarding validation (no mentor/admin self-grant), admin vs super-admin role rules, last-super-admin protection incl. concurrent demotion, suspension ending sessions and blocking re-sign-in, hub suspension ending sessions, hub outage tolerance, access-request decisions (and 409 on repeat), idle session expiry.

Bugs found and fixed: hub refused repeated access requests from suspended users; stale actor roles under concurrency; e2e test-data clash on repeated runs.

## Phase 1 — frontend (2026-10-28)

All run locally in the cloud session against a production build (`next build` + `next start`).

| Check                                           | Command             | Result                                                                                                                                                                                                                                                                         |
| ----------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Format                                          | `pnpm format:check` | Pass                                                                                                                                                                                                                                                                           |
| Lint (ESLint + Next core-web-vitals + TS rules) | `pnpm lint`         | Pass, 0 warnings                                                                                                                                                                                                                                                               |
| Typecheck (strict)                              | `pnpm typecheck`    | Pass, 0 errors                                                                                                                                                                                                                                                                 |
| Unit tests (Vitest)                             | `pnpm test`         | **16 / 16 pass** — money grouping/formatting, commission split always sums, Bengali digits, TrxID + mobile normalisation, countdown/urgency, area access rules (accountant ≠ admin, super-admin-only pages), organic ranking ignores paid badges, translation key parity bn/en |
| Production build                                | `pnpm build`        | Pass — 111 pages                                                                                                                                                                                                                                                               |
| E2E (Playwright, Chromium)                      | `pnpm e2e`          | **380 pass, 2 skipped** (desktop 1440 px, Pixel 7 412 px, small phone 360 px)                                                                                                                                                                                                  |

### What the E2E suite checks

- **Every page** (discovered from `src/app`) on all three viewports: HTTP 200, a visible `h1`, the demo banner, no unexpected "forbidden", **no horizontal scrolling**, **no console errors or uncaught exceptions**.
- **Access rules (UI level):** anonymous → sign-in redirect; student ✗ mentor/admin; mentor ✗ accountant; guardian ✗ student; accountant ✗ admin; supporter ✗ ledger; admin ✗ settings/roles/staff/audit/security; super admin ✓ settings; admin sidebar hides super-admin links; a student gets 404 for another student's order; demo sign-in lands on the role dashboard.
- **Flows:** order wizard step validation → coupon → terms → payment page; manual payment rejects bad sender/TrxID, a reused TrxID, accepts Bengali digits; mentor sees "another mentor accepted first"; student approves delivery and final files unlock; revision request needs instructions; accountant rejection requires a reason; language switch to Bengali and back.

Skipped by design: two desktop-only checks on mobile (sidebar/drawer).

### Bugs found by testing and fixed

- Mobile header overflowed by ~20–120 px (a `hidden` class lost to `inline-flex` on the Login button and language switch).
- Dashboard grids widened the page on 360–390 px phones (grid items' `min-width: auto`); fixed globally.
- Demo offers and delivered orders showed "Overdue" because demo times were anchored to the current hour.

### Not tested yet (no backend)

API integration, database, real authorization, payments, concurrency of mentor acceptance, file security, performance. These belong to Phases 2–7.

## Phase 0

Existing modules' test results quoted in MODULE_INVENTORY.md are **self-reported** by those repositories and were not re-run.
