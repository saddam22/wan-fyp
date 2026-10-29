# Backend API Audit

## EduKhata API (`apps/api`, Phase 2)

Fastify 5 + PostgreSQL, reached by browsers only through the web origin (`/api/*`). Errors: `{ "error": { "code", "message", "field?" } }`. Unsafe methods require `Origin: <WEB_URL>`.

| Method & path                                                             | Who                                                | Purpose                                                                                                         |
| ------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `GET /health`                                                             | anyone                                             | liveness                                                                                                        |
| `GET /auth/login?next=`                                                   | anyone (rate-limited)                              | start WAN sign-in (PKCE, state, nonce); `next` must be a same-site path                                         |
| `GET /auth/callback`                                                      | hub redirect                                       | verify, upsert person by `sub`, start session; → `/onboarding`, `next` or role home                             |
| `POST /auth/logout`                                                       | signed in                                          | revoke session, clear cookie                                                                                    |
| `GET /me`                                                                 | signed in                                          | user, roles, onboarding state, home, student profile                                                            |
| `POST /me/onboarding`                                                     | signed in                                          | `{kind: student, institution, classLevel, board?, subjects[]}` or `{kind: guardian}`; grants that role only     |
| `GET /me/sessions`, `DELETE /me/sessions/{id}`                            | signed in                                          | own EduKhata sessions                                                                                           |
| `GET /admin/users?q=&role=`                                               | admin, super admin                                 | users with roles                                                                                                |
| `PUT /admin/users/{id}/roles`                                             | admin (student/guardian/mentor), super admin (all) | replace roles; last super admin protected; serialized with an advisory lock; actor roles re-read under the lock |
| `POST /admin/users/{id}/status`                                           | admin (non-staff targets), super admin             | suspend/reactivate; ends sessions                                                                               |
| `GET /admin/access-requests`, `POST /admin/access-requests/{id}/decision` | admin, super admin                                 | hub access requests for EduKhata                                                                                |
| `GET /admin/audit`                                                        | super admin                                        | identity audit log                                                                                              |

### Added in Phase 3

| Method & path                                                                                                    | Who                           | Purpose                                                                                             |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------- |
| `GET /me/notifications?filter=&cursor=&limit=` · `GET /me/notifications/counts`                                  | signed in                     | own notifications (cursor pages) + unread/unseen counts                                             |
| `POST /me/notifications/seen` · `/read` `{ids}` · `/read-all` · `/{id}/open`                                     | signed in                     | mark seen/read; `open` checks ownership and returns the internal link                               |
| `GET`/`PUT /me/notification-preferences`                                                                         | signed in                     | per-category in-app/push switches, quiet hours (mandatory types still arrive)                       |
| `GET /push/config` · `POST`/`DELETE /me/push-subscriptions`                                                      | anyone / signed in            | Web Push key and subscriptions                                                                      |
| `GET`/`POST`/`DELETE /me/guardian-code`                                                                          | student                       | whether a link code is active / create one (shown once, 24 h) / cancel                              |
| `GET /me/guardians` · `PUT`/`DELETE /me/guardians/{guardianId}`                                                  | student                       | linked guardians, set their permissions, unlink                                                     |
| `GET /guardian/children` · `POST /guardian/children` `{contact, code}` · `DELETE /guardian/children/{studentId}` | guardian                      | linked children, link (same 404 for wrong contact/code/expired; 10 wrong tries/hour; max 6), unlink |
| `GET /me/referral`                                                                                               | student, guardian (not staff) | own code, link, invited list                                                                        |
| `GET /referrals/resolve/{code}`                                                                                  | anyone (30/min)               | valid? + owner's first name                                                                         |
| `GET /admin/referrals`                                                                                           | admin, super admin            | who referred whom                                                                                   |
| `GET /me/chat-token`                                                                                             | onboarded user                | 15-minute token for the chat and call modules                                                       |
| `/chat/*` (REST of the chat module, see its `docs/api-contract.md`)                                              | chat token                    | conversations, messages, uploads, attachments, search; group creation 403                           |
| `PUT /chat-files/*?exp&size&sig`                                                                                 | signed URL                    | chat file upload target                                                                             |
| WebSocket `/chat/socket.io/` · `/calls/ws`                                                                       | chat token                    | chat realtime · call signalling (calling module protocol)                                           |

`POST /me/onboarding` now also takes `referralCode` (optional) and reads the `ek_ref` cookie.

Validation: Zod. Rate limits: 600/min per client globally, 30 per 5 min on `/auth/login` and `/auth/callback`.

## Existing APIs EduKhata calls

| Service                       | Contract                                           | Used for                              |
| ----------------------------- | -------------------------------------------------- | ------------------------------------- |
| WAN Identity Hub OIDC         | `/oidc/.well-known/openid-configuration`           | sign-in                               |
| WAN Identity Hub platform API | hub README → Platform API                          | entitlement re-check, access requests |
| Chat module                   | `chat-messaging/docs/api-contract.md`              | mounted in the API (in-process)       |
| Calling module                | `audio-video-calling/docs/calling/api-contract.md` | mounted in the API (in-process)       |
| Social module                 | `social-module` notifications services             | in-process, PostgreSQL repositories   |
| Ad Platform                   | `central-ad-platform/docs/api/API.md`, SDK         | browser → `/v1/serve`, impressions    |
