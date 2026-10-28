# Implementation Roadmap

| Phase | Scope | Exit gate | Status |
|---|---|---|---|
| 0 | Repository audit, mockup review, inventory, reuse matrix, architecture, traceability | Q1, Q2 answered; Q3–Q13 open (see PROJECT_OVERVIEW) | **Done** |
| 1 | Premium frontend: design tokens, components, all public pages, all 6 role dashboards + guardian, all states, mock adapters, responsive, build + Playwright screenshots | **Your review & approval (STOP)** | Not started |
| 2 | WAN Identity integration (OIDC BFF), hub changes H1–H2, roles, profile gates, auth tests | Login/role tests green | Not started |
| 3 | Chat, calling, notifications/push, ads slots, ICTSpark rule ports (referral, guardian, reviews) | Integration tests | Not started |
| 4 | Catalog, services, orders, matching (concurrency-safe), files, delivery countdown, revisions, approval, disputes | E2E order journey | Not started |
| 5 | Payments (manual/TrxID + proof), ledger, commission, earnings, payouts, refunds, reconciliation, invoices | Ledger balances under tests; no duplicate payout | Not started |
| 6 | Verification queue, ranking, skill tests, badges, boosts, subscriptions, CMS/blog, coupons | | Not started |
| 7 | Security hardening, unauthorized-access tests, performance, dependency review | Security checklist | Not started |
| 8 | Docker, staging, env validation, backups/restore drill, deploy & rollback guide | **Your production approval** | Not started |

## Phase 1 work breakdown (HD mockups, Q12, still wanted)

1. Scaffold pnpm monorepo: `apps/web` (Next.js 16), `apps/api` (Fastify 5, empty health route only), `packages/contracts` (Zod DTOs shared by mocks and API), `packages/ui`.
2. Design tokens + primitives (Button, Input, Select, Badge, Card, Tabs, Table, Modal, Drawer, Toast, Skeleton, EmptyState, Stepper, Countdown, Rating, Avatar, FileDrop, StatCard, Chart).
3. Public shell (header ×2 rows, mobile drawer, footer) + homepage sections.
4. Remaining public pages.
5. Dashboard shell + Student → Mentor → Admin → Accountant → Supporter → Guardian.
6. Order detail page (shared by student/mentor/admin views with permission-based actions).
7. bn/en strings; Bengali digits.
8. Checks: typecheck, lint, unit (Vitest), Playwright smoke + screenshots at 390/768/1440 px; `next build`.
9. Update FRONTEND_AUDIT, traceability (FE column), CHANGELOG; present for review.
