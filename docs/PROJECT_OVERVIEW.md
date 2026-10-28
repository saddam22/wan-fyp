# EduKhata — Assignment & Practical Khata Marketplace

Part of the WANBAHJAHKAS ecosystem. Students (and guardians) order assignments, handwritten practical notebooks, drawings and diagrams from verified mentors; the platform handles matching, delivery, revisions, payment, 20/80 commission, payouts, support and administration. Bangladesh first, international later.

## Current state (2026-10-28)

- **Phase 0 complete:** all 8 accessible repositories audited by reading source; mockups reviewed; 309 features tracked.
- No EduKhata code exists yet. Nothing has been built, run or deployed.
- Phase 1 (frontend) can start; HD mockups (Q12) are still needed for faithful dashboards.

## How to resume in a new session

1. Read this file, `IMPLEMENTATION_ROADMAP.md`, `CHANGELOG.md`.
2. `git log` and `git status` in this repo.
3. Re-verify any "done" claim against code and tests before building on it.

## Documents

| File | Content |
|---|---|
| MODULE_INVENTORY.md | What each ecosystem repo really contains; what is missing |
| EXISTING_MODULE_REUSE_MATRIX.md | Reuse decision per capability (8-point analysis) |
| ARCHITECTURE.md | Proposed stack and domain rules |
| IDENTITY_INTEGRATION.md | WAN Identity Hub flow + required hub changes |
| ADVERTISING_INTEGRATION.md | Ad placements; ads vs boosts vs verification |
| PAYMENT_AND_COMMISSION.md | ICTSpark manual flow, fixes, ledger model, policy questions |
| CHAT_AND_COMMUNICATION_INTEGRATION.md | Chat, calls, notifications fit |
| FRONTEND_AUDIT.md | Mockup reading, design tokens, conflicts, route inventory |
| BACKEND_API_AUDIT.md / DATABASE_AUDIT.md | Existing contracts and schemas |
| SECURITY_AUDIT.md | Findings in existing modules |
| FEATURE_TRACEABILITY_MATRIX.md | Every feature with ID and status (generated) |
| ACCEPTANCE_CRITERIA.md | Project and module acceptance |
| IMPLEMENTATION_ROADMAP.md | Phases and gates |
| TESTING_REPORT.md / DEPLOYMENT_GUIDE.md | Filled from Phase 1 / Phase 8 |

## Open decisions

| ID | Question | My recommendation | Blocks |
|---|---|---|---|
| Q1 | Where does EduKhata's code live? | **Decided 2026-10-28:** `saddam22/wan-fyp` repo | — |
| Q2 | The 3rd mockup is **WAN FYP** (Final Year Project portal). In scope? | **Decided:** separate project, later — not part of EduKhata | — |
| Q3 | Live Classes / Exams / Blog / Forum: link to ICTSpark, port, or drop from nav? | Blog + FAQ built in EduKhata; Live Classes/Exams link to ICTSpark or hidden | Nav |
| Q4 | Students/guardians self-serve access; mentor and staff roles granted only inside EduKhata? | Yes | Phase 2 |
| Q5 | Holding customer funds until approval ("Money Hold") — legally OK? | Get legal confirmation; until then mentor share released on approval from platform account | Phase 5 |
| Q6–Q9 | Refund rules, fees/VAT, payout holding period/minimum, paid revision price, coupon funding | — | Phase 5 |
| Q10 | Email and SMS providers | e.g. SES/Mailgun + a BD SMS gateway | Hub production, notifications |
| Q11 | Call recording | Remove "with Recording" until a recording solution, consent and retention are approved | UI copy |
| Q12 | HD originals of all mockups (incl. dashboard screens) | Needed for faithful dashboards | Phase 1 quality |
| Q13 | Cart icon meaning | Replace with "My Orders" | Header |

## Policy note

Selling completed assignments can breach institutions' academic-integrity rules. Recommended: Terms that position deliverables as reference/learning material and handwritten practical khata services, a reporting channel for institutions, and no marketing that promises submittable graded work. Needs your/legal sign-off before launch copy is final.
