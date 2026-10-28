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

## Planned controls (Module 17) — tracked in FEATURE_TRACEABILITY_MATRIX.md M17-*
