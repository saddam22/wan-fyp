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

EduKhata's own schema is designed in Phase 4 (proposed: PostgreSQL, one database, module tables for chat/calling/social in their own schemas). Nothing created yet.
