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

Validation: Zod. Rate limits: 600/min per client globally, 30 per 5 min on `/auth/login` and `/auth/callback`.

## Existing APIs EduKhata calls

| Service                       | Contract                                           | Used for                              |
| ----------------------------- | -------------------------------------------------- | ------------------------------------- |
| WAN Identity Hub OIDC         | `/oidc/.well-known/openid-configuration`           | sign-in                               |
| WAN Identity Hub platform API | hub README → Platform API                          | entitlement re-check, access requests |
| Chat module                   | `chat-messaging/docs/api-contract.md`              | Phase 3                               |
| Calling module                | `audio-video-calling/docs/calling/api-contract.md` | Phase 3                               |
| Ad Platform                   | `central-ad-platform/docs/api/API.md`, SDK         | Phase 3                               |
