# Architecture (proposed — awaiting approval)

## Stack decision

The WAN ecosystem's reusable modules (chat, calling, ads, jobs, identity server) are all **TypeScript + Fastify 5 + PostgreSQL**, and the two Next.js apps (ads web, jobs web) use **Next.js 16 + React 19 + Tailwind CSS 4**. ICTSpark is the exception (MERN, JavaScript, MongoDB).

Proposed for EduKhata:

| Layer    | Choice                                                         | Why                                                                                           |
| -------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Monorepo | pnpm workspaces, Node 22.12+                                   | Same as chat, calling, jobs; chat/calling are consumed as submodules in a pnpm workspace      |
| Web      | Next.js 16 (App Router) + React 19 + Tailwind 4 + lucide-react | Matches jobs/ads web; SSR for SEO on public pages (Module 01)                                 |
| API      | Fastify 5 + Zod                                                | Chat and calling are Fastify 5 plugins — they mount directly                                  |
| DB       | PostgreSQL 16                                                  | Required by chat (`pg_trgm`), calling store, matches ledger patterns (row locks, constraints) |
| Jobs     | PostgreSQL-backed queue (e.g. `pg-boss`)                       | Offer expiry, deadline reminders, auto-approve, reconciliation — no extra infra               |
| Files    | S3-compatible private bucket + signed URLs                     | Order files, ID documents, chat attachments                                                   |
| Auth     | WAN Identity Hub (OIDC) via server-side BFF session            | Spec: no second identity system                                                               |
| i18n     | bn-BD default + en, extensible (Hub's i18n shape)              | Module 15                                                                                     |

ICTSpark features are **ported** (rules + UX), not linked as code, unless you choose otherwise (Q3).

## Component diagram

```
Browser (Next.js pages, bn/en)
   │  httpOnly session cookie (no tokens in JS)
   ▼
EduKhata Web (Next.js server)  ──OIDC Code+PKCE──►  WAN Identity Hub (/oidc)
   │ REST (same-site)                                   ▲ entitlement check (needs hub extension)
   ▼                                                    │
EduKhata API (Fastify 5) ───────────────────────────────┘
   ├── marketplace core: catalog, services, orders, matching, revisions, disputes
   ├── money: payments (manual/TrxID → gateway later), ledger, commission, payouts, refunds
   ├── people: marketplace profiles, roles, mentor verification, guardians, referrals
   ├── support: tickets, escalation
   ├── /chat     ← @chat-module/server (submodule)
   ├── /calls    ← @calling/server (submodule)
   ├── notifications/push ← @amar/social-modules
   └── worker (pg-boss): offer expiry, reminders, auto-approve, reconciliation, payouts batch
   │
PostgreSQL ── S3-compatible private storage

Ads: browser ← @adp/sdk AdSlot ← Central Ad Platform (separate service)
```

## Key domain rules (to be implemented in Phase 4–5)

- **Roles** live in EduKhata (`student, mentor, guardian, supporter, accountant, admin, super_admin`); a user may hold several. Hub authentication never implies a role. Mentor requires approved application + verification.
- **Order lifecycle:** `draft → awaiting_payment → payment_review → matching → assigned → in_progress → delivered → (revision_requested ↔ delivered) → approved → closed`; side states `cancelled, disputed, refunded`. Every transition is a server-side command with an `order_status_history` row.
- **Matching exclusivity:** `UPDATE orders SET mentor_id=$m, status='assigned' WHERE id=$o AND status='matching' AND mentor_id IS NULL` inside a transaction with the offer row locked; 0 rows → "already taken". Tested with concurrent acceptances.
- **Money:** integer minor units + ISO currency; double-entry ledger (`ledger_entries` must balance per transaction, enforced by constraint/trigger); commission rate stored on the order at payment time (default 20%) so later config changes never rewrite history.
- **Mentor earnings** become _available_ only after order approval/closure and a configurable holding period; payouts are idempotent (unique request key) and approved maker-checker.
