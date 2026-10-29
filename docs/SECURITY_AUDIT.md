# Security Audit

## Phase 0 — findings in existing modules that EduKhata would reuse or copy

Found by reading source; not exploited or run. None of these repos were modified.

| #   | Repo / location                                                       | Finding                                                                                                                                                                        | Impact for EduKhata                    | Severity   |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- | ---------- |
| S1  | ictspark `routes/payment.routes.js` → `GET/POST /payments/:id/manual` | No authentication or ownership check (supports guest checkout). Anyone who has or guesses a payment ObjectId can read its details and submit/overwrite the TrxID while pending | Do not copy; require login + ownership | Medium     |
| S2  | ictspark `sendmoney.controller.js` `submitManual`                     | Duplicate-TrxID check is `exists()` then `save()` — two concurrent submissions with the same TrxID can both pass; no unique index                                              | Use a DB unique constraint             | Medium     |
| S3  | ictspark `GET /payments/:id/invoice.pdf`                              | No auth; invoice (name, amount) readable by anyone with the id                                                                                                                 | Invoices behind auth or signed URL     | Low–Medium |
| S4  | ictspark `adminVerify`                                                | Single admin approves money; no second approver, no accountant role                                                                                                            | Maker-checker for EduKhata             | Process    |
| S5  | wan-identity-hub                                                      | No platform API to approve access requests → platforms would need direct DB access (unsafe) to approve                                                                         | Add H2 API in hub                      | Design     |
| S6  | wan-identity-hub                                                      | Production refuses to start without SMS/email provider (good), but none implemented                                                                                            | Blocks production login                | Blocker    |
| S7  | audio-video-calling demo                                              | Password-less demo login (documented "never on the internet")                                                                                                                  | Never deploy the demo app              | Info       |

Owner action: S1–S3 also affect ICTSpark.online today. I have **not** changed ICTSpark; say if you want a separate fix PR there.

## Phase 2 — identity & access controls (implemented and tested)

| Control                    | Implementation                                                                                                                       | Test                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| No tokens in the browser   | OIDC runs server-side; browser holds only `ek_sid` (httpOnly, SameSite=Lax, Secure in prod)                                          | api.test                                      |
| Session token at rest      | Only SHA-256 stored; 12 h idle, 7 day absolute expiry; revocation on logout, suspension                                              | api.test                                      |
| OIDC checks                | PKCE S256, state (single use, 10 min), nonce, issuer `iss`, RS256 ID token, `client_secret_basic`                                    | api.test (replay, unknown state, wrong nonce) |
| Open redirect              | `next` accepted only as a same-site path                                                                                             | api.test                                      |
| CSRF                       | Unsafe methods require `Origin` = web origin                                                                                         | api.test, e2e-wan                             |
| Role escalation            | Roles never from sign-in; admins can't touch staff roles; last super admin protected; advisory lock + actor roles re-read under lock | api.test (incl. concurrent demotion)          |
| Platform suspension        | Hub refuses sign-in; sessions re-check entitlement and end                                                                           | hub tests, api.test, e2e-wan                  |
| Hub platform API isolation | A client sees only its own platform; Basic auth with constant-time compare; outside cookie/CSRF API                                  | hub platform-api.test                         |
| Rate limits                | API global + auth routes; hub platform API 300/min                                                                                   | —                                             |
| Proxy trust                | API trusts X-Forwarded-For only from `TRUST_PROXY` (default loopback); API must not be public                                        | config                                        |

Findings during Phase 2: **S8** (hub) — a suspended user could never request access again (fixed, tested). **S9** (EduKhata) — an admin demoted mid-request could act on stale roles (fixed by re-reading roles under the lock, tested).

Known gaps: hub entitlement check fails open while the hub is unreachable (documented choice); no RP/back-channel logout yet; marketplace routes beyond identity/admin don't exist yet (Phase 4+).

## Phase 3 — integrations (implemented and tested)

| Control              | Implementation                                                                                                                                                                                                                                                                                                                     | Test                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Guardian link codes  | ICTSpark stored the code in plain text, with no expiry and no attempt limit. EduKhata stores only its SHA-256 and uses 8 characters (~40 bits) with a 24 h expiry. A code works once. 10 wrong tries per guardian per hour. One answer for wrong contact, code or expired code. Max 6 children under a per-guardian advisory lock. | guardians.test (incl. concurrent linking) |
| Guardian visibility  | Student-set permissions; either side unlinks; access ends at once; audited; guardians never see chats                                                                                                                                                                                                                              | guardians.test, e2e-wan                   |
| Referrals            | Set once at first onboarding (serialized); no self-referral (DB check); staff and suspended codes invalid; public lookup reveals a first name only                                                                                                                                                                                 | referrals.test, e2e-wan                   |
| Chat/call tokens     | 15 min HMAC token bound to the session; every use re-checks session, status and onboarding; the session cookie stays httpOnly                                                                                                                                                                                                      | chat.test, calling.test                   |
| Off-platform contact | Messaging and calls need staff on one side; search shows non-staff only the support team; groups off; names only, no contact details                                                                                                                                                                                               | chat.test, calling.test, e2e-wan          |
| Chat files           | Signed upload URL binds key, size, type and expiry; magic-byte check (module); EXIF/GPS removed; files never public                                                                                                                                                                                                                | chat.test                                 |
| Notifications        | No message text in notifications or push; recipients only see their own (ownership on read/open)                                                                                                                                                                                                                                   | notifications.test, chat.test             |
| Realtime origin      | Socket.IO and call WebSocket accept only the web origin                                                                                                                                                                                                                                                                            | config; e2e-wan                           |
| Ads                  | No personal data sent; labelled; never in dashboards or payment flows                                                                                                                                                                                                                                                              | manual check (TESTING_REPORT)             |

Findings during Phase 3: **S10** (EduKhata) — importing a constant from a `"use client"` module into a server component gives a client reference (always truthy), so ads looked enabled without settings. Fixed by moving the config to `lib/ads.ts`. **S11** (chat-messaging) — no way to switch group chats off, which would bypass the contact rule. Upstream `features.groups` added.

Known gaps: Web Push needs VAPID keys; no TURN; single-instance realtime and file storage; no native ringing.

## Phase 4 — marketplace core (implemented and tested)

| Control                | Implementation                                                                                                                                                                                            | Test                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Assignment exclusivity | Lock order: mentor advisory lock → order row → offer row. A conditional `UPDATE … WHERE status = 'matching' AND mentor_id IS NULL`; capacity counted under the mentor lock. Never decided in the browser. | matching.test (5 rounds of 3 simultaneous accepts; simultaneous accepts at capacity) |
| Status changes         | Every transition is one conditional UPDATE from allowed statuses (409 otherwise) plus an event row                                                                                                        | delivery/matching/orders tests                                                       |
| Prices                 | Computed on the server from the price list; the client's numbers are ignored; commission and free revisions frozen on the order                                                                           | orders.test                                                                          |
| Order privacy          | Student, assigned mentor, staff, guardians with "view orders"; everyone else 404 (no probing); payout and address shown only to whom they concern                                                         | orders.test                                                                          |
| Files                  | Signed upload bound to key/size/type/expiry; magic-byte check; EXIF removed; previews watermarked; finals locked for the student side until approval; downloads `nosniff` + sandbox CSP + `no-store`      | orders.test, delivery.test                                                           |
| Off-platform contact   | Chat/calls only with staff or the other side of a live order; former contacts become read-only; reviews with phone/email/links/messenger names held for moderation                                        | orderchat.test                                                                       |
| Business rules         | Only super admins change commission and rules; ranges validated; audited                                                                                                                                  | catalog.test                                                                         |
| Staff actions          | Assign, unassign, cancel, close, dispute decisions, moderation: audited                                                                                                                                   | matching/delivery/orderchat tests                                                    |

Known gaps: payments aren't connected yet (Phase 5). An order stays `awaiting_payment` until then, and refunds from dispute decisions are recorded but not paid out. There are no per-user rate limits on order creation beyond the global limit.

## Phase 5 — payments and money (implemented and tested)

ICTSpark's gaps S1–S4 are closed in EduKhata (ICTSpark itself is unchanged).

| Control                  | Implementation                                                                                                                                                            | Test                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Who may pay (S1)         | Sign-in; student, or a guardian with "pay on behalf"; others 404                                                                                                          | payments.test              |
| Duplicate TrxID (S2)     | Unique index on (method, normalised TrxID) — concurrent submissions can't both win; one live payment per order/revision                                                   | payments.test (concurrent) |
| Invoices (S3)            | Behind sign-in and the same relation check; only approved/refunded payments                                                                                               | money.test                 |
| Verification (S4)        | Accountant role; nobody verifies their own payment or one for their own order; reject needs a reason; one transaction for payment, ledger and order                       | payments.test              |
| Money out: maker-checker | Refund approver ≠ requester; payout approver ≠ mentor; payout sender ≠ approver; references unique                                                                        | money.test, e2e-wan        |
| Ledger integrity         | Every transaction balances (deferred trigger), entries immutable, idempotency keys; payout amounts reserved under a per-mentor lock; refunds capped at what is refundable | ledger.test, money.test    |
| Proof files              | Private storage, signed upload, magic bytes; served `nosniff`, `sandbox` CSP, `no-store`; only verifiers and the payer                                                    | payments.test              |
| Abuse                    | Submissions rate-limited per session; all attempts kept                                                                                                                   | not tested yet             |

Known gaps: the fee for sending a payout/refund isn't recorded (Q7); no statement import; the hub's registration limit (10 per 15 min per address) is fine for people but means test suites must reuse accounts.

## Phase 6 — trust and growth (implemented and tested)

| Control                | Implementation                                                                                                                              | Test                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Identity documents     | Private storage, signed upload, magic bytes, EXIF removed, served `sandbox` + `no-store` to reviewers and the owner; reviewer views audited | trust.test, e2e-wan                          |
| Verification integrity | Decision by someone other than the mentor (API check + DB check), reason required to reject, revocation audited                             | trust.test                                   |
| Paid ≠ verified        | Paid badges labelled "paid", separate featured list; organic ranking and matching ignore promotions                                         | growth.test, trust.test, contracts unit test |
| Skill-test integrity   | Right answers never leave the server; deadline enforced on the server; retake period; attempts bound to the mentor                          | trust.test                                   |
| Money for promotions   | Paid from the balance under the payout lock; ledger-balanced; admin stop returns unused part                                                | growth.test                                  |
| Coupon abuse           | Limits checked under a row lock (concurrent last use: one wins), per-person limit, minimum price                                            | growth.test                                  |
| Blog XSS               | Text is stored as text and rendered as React text nodes (no HTML)                                                                           | code review                                  |
| Content review         | Nobody reviews their own post; others' drafts are private                                                                                   | growth.test                                  |

Known gaps: document retention period is open (Q20); no malware scanning of uploads (magic-byte checks only).

## Phase 7 — hardening and checklist (2026-10-29)

### Automated access sweep (`apps/api/test/security.test.ts`)

The API records every route it registers (166 today). The sweep calls each one:

| Check                                                                             | Expectation                                                                           | Result           |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------- |
| No session, every non-public route                                                | 401 or 403 (signed upload URLs: 403 without a valid signature); never data, never 5xx | pass             |
| Student on every `/admin`, `/accountant`, `/mentor` route                         | 403 or 404                                                                            | pass             |
| Mentor on every `/admin`, `/accountant` route; accountant on every `/admin` route | 403 or 404                                                                            | pass             |
| Admin on super-admin settings and every `/accountant` route                       | 403 or 404                                                                            | pass             |
| Every write with another `Origin`, even with a super admin's session              | 403                                                                                   | pass (after fix) |
| Every route with unknown ids and empty bodies, as a super admin                   | never 5xx                                                                             | pass             |
| Payment submissions per session; sign-in per address                              | 429 after the limit                                                                   | pass             |

The public list is explicit in the test: health, sign-in, catalog, mentor directory/reviews/badges, quote, published content, referral resolve, chat/push config. A new route that is public by mistake fails the test.

Found and fixed by the sweep:

- **Cross-site writes to chat routes.** They were refused but answered `500`, because the chat module's own error handler didn't know our error type. The Origin check now answers `403` itself.
- **Anonymous chat calls.** They got validation errors (`400`) before authentication. Chat routes now need a bearer chat token before the module sees the request.
- **`POST /me/notifications/read`.** It validated the body before checking the session.

### Other hardening

- **Web response headers.** `X-Frame-Options: DENY` and `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera and microphone for calls on this origin only), CSP `base-uri 'self'; object-src 'none'; form-action 'self'`, and HSTS when the site URL is HTTPS. The API already sends helmet's headers.
- **Logs.** API request logs no longer include query strings, which can hold signed-upload signatures.
- **Dependencies.** `pnpm audit` reported:
  - `fastify` 5.12.5 → upgraded to 5.12.6 (GHSA-389g-gv7q-r4x8, low).
  - Two remaining advisories are inside the chat submodule's development tooling: `drizzle-kit` → `esbuild` ≤ 0.24 (moderate, dev server only), and the chat client's dev `fastify`. Neither is in EduKhata's production paths. They should be updated upstream in `chat-messaging`.
- **Secrets.** The repository has no committed secrets; only `.env.example` files are tracked. The web app reads no server secrets (only `NEXT_PUBLIC_*` values reach the browser). Tokens stay server-side: an `httpOnly` session cookie, and chat tokens bound to the session.
- **Performance.** See `TESTING_REPORT.md`: p95 ≤ 130 ms for the hot endpoints on 20,000+ orders at 10 concurrent clients, with the existing indexes.

### Checklist before production

| Item                                                                                        | Status                                    |
| ------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Authorization enforced on the server for every route                                        | Done (sweep)                              |
| CSRF (Origin check) on every write                                                          | Done (sweep)                              |
| Rate limits (global, sign-in, payment submission)                                           | Done (tests)                              |
| Uploads: signed URLs, size and type, magic bytes, EXIF removed, private serving             | Done                                      |
| Money: double-entry, DB-enforced balance and immutability, maker-checker, unique references | Done                                      |
| Audit log for staff and money actions                                                       | Done (no hash chain yet)                  |
| Security headers (web + API)                                                                | Done                                      |
| Dependency audit                                                                            | Done; 2 upstream dev-only advisories open |
| TLS, HSTS, `TRUST_PROXY` behind the reverse proxy                                           | Phase 8 configuration                     |
| Backups and restore drill                                                                   | Phase 8                                   |
| SMS/email providers for the hub (S6)                                                        | **Open — blocks production sign-in**      |
| TURN server for calls                                                                       | Open                                      |
| Malware scanning of uploads                                                                 | Open (recommended: ClamAV sidecar)        |
| Penetration test by a third party                                                           | Recommended before launch                 |

## Planned controls (Module 17) — tracked in FEATURE_TRACEABILITY_MATRIX.md M17-*
