# Testing Report

## Owner decisions Q7, Q20, Q24 (2026-10-29)

| Suite                                             | Result                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| marketplace-jobs' own suites (before integrating) | contracts 17, server 65 (real PostgreSQL), UI 8 — all pass                                                                                                                                                                                                                                                                                                        |
| API integration                                   | **103 / 103** (+3): payout fee (cap, received amount, ledger unchanged); document retention (pending kept, 5 months kept, 7 months deleted, verified status stays); jobs board (post, public listing, fake PDF refused, CV private to the employer, status → EduKhata notification, employer verification by EduKhata admins only, module role management closed) |
| Access sweep                                      | now also covers the module's routes: anonymous writes 401, `/local/admin/*` staff only, role management 403                                                                                                                                                                                                                                                       |
| Real end-to-end                                   | **9 / 9**: new — a coaching centre posts a tuition job, a mentor finds it on `/jobs` and applies with a PDF CV in the module's dialog, the centre sees the application and the CV                                                                                                                                                                                 |
| Demo UI suite                                     | 404 pass (the `/jobs` placeholder added)                                                                                                                                                                                                                                                                                                                          |

Bugs found: a missing import in the API's new request gate (caught by the sweep as 500s); the jobs provider needed a stable token getter.

## Owner decisions applied (2026-10-29)

| Suite           | Result                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API integration | **100 / 100** (+4): both-sides confirmation (no confirm before approval, staff close and timer refused without the mentor, one reminder, only the assigned mentor, closes at once); contact messages (validation, honeypot, rate limit, handling note); banners (link rules incl. `javascript:` and `//`, order, active only); leaderboard (opt-in, short names, earned points) and homepage figures |
| Real end-to-end | **8 / 8**: the journey now ends with "Confirm completion" by the mentor (the admin has no close button while it waits); new — contact form → admin inbox → handled; an admin banner becomes the homepage slide; no "demo figures" on the live homepage; a student opts in and appears on the leaderboard as "Rafi X."                                                                                |
| Demo UI suite   | 401 pass                                                                                                                                                                                                                                                                                                                                                                                             |

## Phase 8 — staging packaging (2026-10-29)

| Check                                                | Result                                                                                                                                                                                                                                   |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check` (format, build, lint, typecheck, tests) | pass. API 96 (+2 config tests); the performance check is opt-in                                                                                                                                                                          |
| Docker images (`--target api`, `--target web`)       | both built in this session. Docker Hub refused anonymous pulls of `node` (429), so the build used a local base made from `postgres:16.11-bookworm` plus Node 22.22.0. The staging build uses `node:22.22.0-bookworm-slim` (`NODE_IMAGE`) |
| Containers: PostgreSQL + API + web on one network    | API `/health` ok; the 13 migrations applied at start; web `/` 200; `/api/catalog` proxied; `/api/admin/users` 401; cross-site POST 403; `/mentors` 200; both containers run as `node`; logs without query strings                        |
| Backup → restore drill (`scripts/backup-drill.sh`)   | passed on the e2e database (202 users, 67 ledger lines; ledger still refuses deletes) and the test database (1,301 users, 10,000 orders); restore about 1 s each                                                                         |
| `restore.sh` on a non-empty database                 | refused, as designed                                                                                                                                                                                                                     |

Bug found by the image build: after the Phase 7 `fastify` upgrade the chat module still used 5.12.5, so the API typecheck failed. That commit had been pushed without re-running the typecheck. Fixed in the next commit with a workspace override, and `pnpm check` now runs before every push.

Not done here: Caddy/TLS with a real domain, the WAN Identity Hub in the same stack, a deploy to a staging server (none is available to this session).

## Phase 7 — security and performance (2026-10-29)

| Suite                                                                                                                                         | Result                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| API integration incl. the access sweep                                                                                                        | **94 / 94** (+9): route inventory; anonymous, student, mentor, accountant and admin sweeps over all 166 routes; cross-origin writes; no 5xx on unknown ids; payment-submission and sign-in rate limits |
| Performance (`PERF=1`, seeded: 300 mentors, 1,000 students, 10,000+ orders, 2,000 reviews; 100 requests at 10 concurrent clients, in-process) | p95: catalog 52 ms, mentors 120–126 ms, staff orders 121 ms, candidates 102 ms, balances 29 ms, ledger 22 ms, posts 8 ms                                                                               |
| Real end-to-end / demo UI                                                                                                                     | rerun after the hardening (see Phase 6 counts)                                                                                                                                                         |

Bugs found by the sweep: chat routes answered refused cross-site writes with 500; anonymous chat calls got 400 before 401; one notification route validated before checking the session.

Not covered: load over a real network and reverse proxy; many API instances (the design is single-instance for now).

## Phase 6 — trust and growth (2026-10-29)

| Suite                             | Result                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API integration (real PostgreSQL) | **85 / 85** (+9): verification 3 (documents, EXIF removed, privacy, independent reviewer, revocation, ranking and "verified only"), skill tests 2 (no answers sent, grading, retake period, late answers), promotions 1 (ledger, stacking, paid labels, admin stop), coupons 2 (cap, minimum, per-person, concurrent last use, release, minimum price), blog 1         |
| Real end-to-end (`pnpm e2e:wan`)  | **7 / 7**: new — mentor uploads NID and certificate → admin opens the document and approves → "Verified mentor" badge on the dashboard and the public directory; admin creates a coupon → the student applies it in the wizard and the order costs ৳450 instead of ৳500; mentor writes a post → admin publishes → the public blog renders its heading and list as text |
| Demo UI suite                     | 401 pass                                                                                                                                                                                                                                                                                                                                                               |

Bugs found and fixed: the ledger's account check had no `revenue:promotions`; "already being reviewed" was hidden behind document checks; the order offer list could show orders left by earlier e2e runs (the journey now accepts its own order by code); the order page called every assigned mentor "Verified mentor" (now only in the demo).

## Phase 5 — payments and money (2026-10-29)

| Suite                             | Result                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API integration (real PostgreSQL) | **76 / 76** (+15): payments 6, ledger 4, money 5                                                                                                                                                                                                                                                                                            |
| Real end-to-end (`pnpm e2e:wan`)  | **6 / 6**: the order journey now runs to the end — receiving account → pay by TrxID → accountant approves → offer accepted → start → deliver (watermarked preview + final) → student approves → admin closes → mentor sees ৳520 (80% of ৳650) → invoice → payout requested → approved → the approver is refused as sender → trial balance 0 |
| Demo UI suite                     | 401 pass (live-only pages are excluded from the demo sweep and hidden from the demo sidebar)                                                                                                                                                                                                                                                |

Money evidence: every transaction balances (database trigger), edits and deletes of entries are refused, re-posting an event is a no-op; concurrent submissions of one TrxID give one success; odd prices round the mentor share down; refunds can't exceed what is refundable; one open payout per mentor; maker-checker refusals for refunds and payouts.

Bugs found and fixed: the hub's limit of 10 registrations per 15 minutes per address was exceeded by the suite (the journey now reuses the super admin); mentors left in the e2e database by earlier runs took the offer (they are paused at the start of the journey); a sidebar link named "Invoices" matched a locator for "Invoice".

Not covered: the per-session submission rate limit; payout/refund transfer fees (not modelled, Q7).

## Phase 4 — marketplace core (2026-10-29)

| Suite                             | Result                                                                                                                                        |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| API integration (real PostgreSQL) | **61 / 61** (+22): catalog 3, orders 5, matching 6, delivery 4, order chat & reviews 4; full suite green 3× in a row                          |
| Real end-to-end (`pnpm e2e:wan`)  | **6 / 6**: new — a student places an order through the wizard with a PDF at the server's price (8 × ৳50); a mentor saves the matching profile |
| Demo UI suite                     | 401 pass                                                                                                                                      |
| `pnpm check`                      | pass                                                                                                                                          |

Concurrency evidence: 5 rounds × 3 mentors accepting the same order at once always give exactly one 200 and two 409; offer rows end as accepted/withdrawn/withdrawn. Simultaneous accepts by one mentor at capacity 1 give one 200 and one 409.

Bugs found and fixed: test sign-ins hit the per-IP sign-in limit (test browsers now have their own addresses); a mentor approving got 404 instead of 403 (kept as 404, consistent with no-probing); file "round" counting differed between upload and delivery for withdrawn revisions; two earlier test fixes had silently not been applied (guardian concurrency test was flaky ~25%; one referral assertion was vacuous) — both fixed and verified.

Not covered yet: the full browser journey (pay → match → deliver → approve), which needs Phase 5; watermark appearance is checked only by content type, not visually.

## Phase 3 — module integrations (2026-10-29)

| Suite                                                               | Where              | Result                                                                                                        |
| ------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------- |
| Each module's own tests before integrating                          | module repos       | chat 79 (incl. 2 new for `features.groups`), calling 82, social 47, ad SDK 9                                  |
| EduKhata API integration (Vitest, real PostgreSQL)                  | `apps/api/test`    | **39 / 39**: identity 17, notifications 5, guardians 6, referrals 4, chat 4, calls 3 (real WebSocket clients) |
| Real end-to-end (Playwright, real hub + API + web, `AUTH_MODE=wan`) | `apps/web/e2e-wan` | **5 / 5**                                                                                                     |
| Demo-mode UI suite                                                  | `apps/web/e2e`     | **401 pass**, 2 skipped                                                                                       |
| Unit (contracts + i18n)                                             | `pnpm test`        | 16 / 16                                                                                                       |
| Lint, typecheck, format, build (modules + apps)                     | `pnpm check`       | Pass                                                                                                          |

New end-to-end journeys:

- **Notifications:** role change → bell dot → dropdown → inbox → opening a notification follows its link.
- **Guardian:** a student creates a code; a guardian's wrong code is refused with the generic message; the right code links (case-insensitive); the child shows class and institution. The student turns off "view payments" (the guardian's privacy page shows it) and unlinks; the guardian loses access.
- **Referral:** someone opens `/how-it-works?ref=CODE` before having a WAN ID → registers → onboarding shows "invited by" → the referrer's Refer & Earn page and notifications show the new friend.
- **Chat + call:** a student can't find other students and has no group option. They message support; it arrives live at the support desk with a notification. Support replies live. The student places a real WebRTC audio call from the chat header (Chromium fake devices); support accepts on another page; both see the timer; the student ends the call.

API tests also cover: dedupe/aggregation, pagination, mandatory types surviving opted-out categories, ownership on read/open. Guardian codes: hash-only storage, expiry, regeneration revokes, the guess limit, max 6 under concurrent linking, 409 rollback keeping the code, role checks, the audit trail, BD mobile matching. Referrals: typed code beating the link, first attribution kept, staff/suspended codes ignored. Chat/calls: tokens die with the session, signed upload tampering (signature, type, size) refused, EXIF removed, groups 403, missed call notification.

Manual check (not automated, because ad settings are baked in at build time): built with ad settings and intercepted the ad server. A filled ad shows labelled "Sponsored" with `rel=sponsored`; no-fill shows nothing; requests carry only app key, placement and random ids; no request without settings.

Bugs found by testing and fixed: zod v4 `record` over an enum requires all keys (preferences); the module's 422 vs the API's 400 for validation; IP-keyed limit on code creation would block whole schools; the permission checkbox waited for the server; Next stripped Socket.IO's trailing slash (redirect, then rewrite); the stale chat module build; the S10 client-reference bug (ads enabled without settings).

Not tested: TURN/relay calls, real phones and mobile networks, Web Push delivery (no VAPID keys), ad impression beacons.

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
