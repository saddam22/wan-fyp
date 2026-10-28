# EduKhata — Assignment & Practical Khata Marketplace

Part of the WANBAHJAHKAS ecosystem. Students (and guardians) order assignments, handwritten practical notebooks, drawings and diagrams from verified mentors; the platform handles matching, delivery, revisions, payment, 20/80 commission, payouts, support and administration. Bangladesh first, international later.

## Current state (2026-10-28)

- **Phase 0 complete:** all 8 accessible repositories audited by reading source; mockups reviewed; 309 features tracked.
- **Phase 1 frontend complete — waiting for owner review (STOP gate).** 111 pages, demo data only, no backend, nothing deployed. See `FRONTEND_AUDIT.md` → Phase 1 and `TESTING_REPORT.md`.

## How to resume in a new session

1. Read this file, `IMPLEMENTATION_ROADMAP.md`, `CHANGELOG.md`.
2. `git log` and `git status` in this repo.
3. Re-verify any "done" claim against code and tests before building on it.

## Documents

| File                                     | Content                                                     |
| ---------------------------------------- | ----------------------------------------------------------- |
| MODULE_INVENTORY.md                      | What each ecosystem repo really contains; what is missing   |
| EXISTING_MODULE_REUSE_MATRIX.md          | Reuse decision per capability (8-point analysis)            |
| ARCHITECTURE.md                          | Proposed stack and domain rules                             |
| IDENTITY_INTEGRATION.md                  | WAN Identity Hub flow + required hub changes                |
| ADVERTISING_INTEGRATION.md               | Ad placements; ads vs boosts vs verification                |
| PAYMENT_AND_COMMISSION.md                | ICTSpark manual flow, fixes, ledger model, policy questions |
| CHAT_AND_COMMUNICATION_INTEGRATION.md    | Chat, calls, notifications fit                              |
| FRONTEND_AUDIT.md                        | Mockup reading, design tokens, conflicts, route inventory   |
| BACKEND_API_AUDIT.md / DATABASE_AUDIT.md | Existing contracts and schemas                              |
| SECURITY_AUDIT.md                        | Findings in existing modules                                |
| FEATURE_TRACEABILITY_MATRIX.md           | Every feature with ID and status (generated)                |
| ACCEPTANCE_CRITERIA.md                   | Project and module acceptance                               |
| IMPLEMENTATION_ROADMAP.md                | Phases and gates                                            |
| TESTING_REPORT.md / DEPLOYMENT_GUIDE.md  | Filled from Phase 1 / Phase 8                               |

## Decisions

| ID    | Question                                                                     | Decision / recommendation                                                                | Blocks                        |
| ----- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------- |
| Q1    | Where does EduKhata's code live?                                             | **Decided:** `saddam22/wan-fyp`                                                          | —                             |
| Q2    | WAN FYP mockup in scope?                                                     | **Decided:** separate project, later                                                     | —                             |
| Q3    | Live Classes / Exams / Blog / Forum                                          | **Decided:** Blog + FAQ in EduKhata; Live Classes/Exams link to ICTSpark                 | —                             |
| Q4    | Students/guardians self-serve; mentor & staff roles only granted in EduKhata | **Decided:** yes                                                                         | —                             |
| Q5    | Holding customer funds until approval ("Money Hold") — legally OK?           | Open — get legal confirmation                                                            | Phase 5                       |
| Q6–Q9 | Refund rules, fees/VAT, payout holding/minimum, paid revision price, coupons | Open — UI shows placeholders                                                             | Phase 5                       |
| Q10   | Email and SMS providers                                                      | Open — e.g. SES/Mailgun + a BD SMS gateway                                               | Hub production, notifications |
| Q11   | Call recording                                                               | **Decided:** removed from UI until a solution, consent and retention policy are approved | —                             |
| Q12   | HD originals of all mockups                                                  | Open — still wanted to refine dashboards                                                 | Phase 1 polish                |
| Q13   | Cart icon                                                                    | **Decided:** replaced with My Orders                                                     | —                             |
| Q14   | Phase 1 frontend approval                                                    | **Waiting for owner review** (see FRONTEND_AUDIT → Phase 1)                              | Phase 2                       |

## Policy note

Selling completed assignments can breach institutions' academic-integrity rules. Recommended: Terms that position deliverables as reference/learning material and handwritten practical khata services, a reporting channel for institutions, and no marketing that promises submittable graded work. Needs your/legal sign-off before launch copy is final.
