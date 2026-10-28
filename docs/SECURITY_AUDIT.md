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

## Planned controls (Module 17) — tracked in FEATURE_TRACEABILITY_MATRIX.md M17-*
