# Testing Report

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
