# Database Audit

## Existing databases in the ecosystem (Phase 0)

| Repo                | Engine                | Schema source                                   | Notes                                                                                                                                                |
| ------------------- | --------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| wan-identity-hub    | PostgreSQL 14+        | `server/migrations/001_init.sql`                | users, sessions, codes, registrations, documents, entitlements, access_requests, activity, notifications, role_submissions, audit_log, oidc_payloads |
| central-ad-platform | PostgreSQL            | `db/migrations/0001–0009`                       | ledger + funding, campaigns, events, settlements, creators, earnings, stars                                                                          |
| chat-messaging      | PostgreSQL (+pg_trgm) | Drizzle `packages/server/drizzle`               | conversations, members, messages, attachments, reactions…                                                                                            |
| audio-video-calling | PostgreSQL or memory  | calling-server store                            | call history                                                                                                                                         |
| marketplace-jobs    | PostgreSQL            | `packages/server/migrations/0001_local_hub.sql` | `lh_*` tables                                                                                                                                        |
| social-module       | host-provided         | `reference/schema.prisma`                       | notifications, follows, groups, pages, push                                                                                                          |
| ictspark            | MongoDB               | Mongoose models (41)                            | Payment, User (roles), ReferralReward, Review, …                                                                                                     |

## EduKhata database (PostgreSQL, `apps/api/migrations`)

Migrations run in name order, each once, in a transaction (`schema_migrations`). Applied on API start and with `pnpm --filter @edukhata/api migrate`.

| Table                                   | Purpose                                                                         | Key constraints                              |
| --------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------- |
| `users`                                 | Person from WAN ID (`wan_sub` unique), contact copies, marketplace `status`     | `status in (active, suspended)`              |
| `user_roles`                            | Marketplace roles, who granted them                                             | PK (user, role); role check list             |
| `student_profiles`, `guardian_profiles` | Onboarding data                                                                 | 1 row per user                               |
| `sessions`                              | Browser sessions: SHA-256 of token, expiry, idle, hub re-check time, revocation | `token_hash` unique                          |
| `auth_transactions`                     | OIDC state → nonce + PKCE verifier + next path                                  | single use (deleted on callback), 10 min     |
| `audit_log`                             | Sign-ins, onboarding, role/status changes, access decisions                     | append-only by convention (hash chain later) |

### Added in Phase 3

| Table                                                                                        | Migration                                                         | Purpose                                                | Key constraints                                                                                    |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `notifications`, `notification_preferences`, `notification_deliveries`, `push_subscriptions` | `002_notifications.sql`                                           | social-module notification repositories                | unique (recipient, dedupe_key); one pending delivery per notification/channel; internal links only |
| `guardian_link_codes`                                                                        | `003_guardians.sql`                                               | one active code per student, SHA-256 only, expiry      | `code_hash` unique                                                                                 |
| `guardian_links`                                                                             | `003`                                                             | guardian ↔ student with the student's permissions      | PK (guardian, student), no self-link                                                               |
| `guardian_link_failures`                                                                     | `003`                                                             | wrong-code attempts for the hourly limit               | index (guardian, at)                                                                               |
| `referral_codes`, `referrals`                                                                | `004_referrals.sql`                                               | one code per person; one referrer per person, set once | `referred_id` PK, no self-referral                                                                 |
| `chat_*` (conversations, members, messages, attachments, reactions, user state)              | chat module (Drizzle, `drizzle.__chat_migrations`)                | support chat                                           | see chat-messaging docs                                                                            |
| `calls`, `call_active_users`                                                                 | calling module (`PostgresCallStore.migrate()`, create-if-missing) | call state and history                                 | one active call per user                                                                           |

### Added in Phase 4

| Table                                                       | Migration                     | Purpose                                                                 | Key constraints                                               |
| ----------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| `subjects`, `categories`, `price_list`, `platform_settings` | `005_catalog_mentors.sql`     | catalog, prices (minor units), business rules                           | slugs checked; ranges validated in the API                    |
| `mentor_profiles`                                           | `005`                         | subjects, types of work, levels, availability, capacity                 | capacity 1–20                                                 |
| `orders`                                                    | `006_orders.sql`              | the order; price, commission rate and free revisions fixed at placement | status check list; mentor ≠ student; courier needs an address |
| `order_events`                                              | `006`                         | timeline of every change                                                | append-only by the API                                        |
| `order_offers`                                              | `006`                         | matching offers                                                         | unique (order, mentor)                                        |
| `order_files`                                               | `006`                         | requirement / preview / final files per round                           | unique storage key                                            |
| `order_revisions`                                           | `006`, `008`                  | revisions with fee and payment status                                   | PK (order, n)                                                 |
| `disputes`                                                  | `006`                         | disputes and decisions                                                  | one open per order (partial unique index)                     |
| `reviews`                                                   | `007_reviews.sql`             | one per order                                                           | rating 1–5                                                    |
| `order_conversations`                                       | `009_order_conversations.sql` | order → chat conversation                                               | —                                                             |

### Added in Phase 5

| Table                                   | Migration                 | Purpose                                    | Key constraints                                                                                                                      |
| --------------------------------------- | ------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `payment_accounts`                      | `010_payments.sql`        | receiving bKash/Nagad/Rocket/bank accounts | bank ⇔ bank channel                                                                                                                  |
| `payments`                              | `010`                     | one per order price or paid revision       | invoice number unique; one live payment per (order, purpose, revision) (partial unique index); `payments_trx_unique` (method, TrxID) |
| `payment_attempts`                      | `010`                     | every submission and its decision          | append-only by the API                                                                                                               |
| `ledger_transactions`, `ledger_entries` | `011_ledger.sql`          | double-entry journal                       | deferred trigger: each transaction sums to 0; update/delete refused; `idempotency_key` unique                                        |
| `refunds`                               | `012_refunds_payouts.sql` | refund decisions, approval, transfer       | reference unique; status flow requested → approved → paid                                                                            |
| `payouts`                               | `012`                     | mentor payout requests                     | `payouts_one_open` (one open per mentor); reference unique                                                                           |

Module tables are created by the modules themselves on API start, so they follow upgrades of the pinned submodule. The calling tables use `text` ids without a foreign key to `users` (module design). Money tables (Phase 5) use signed integer paisa (`bigint`).
