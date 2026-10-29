# Chat & Communication Integration

Status: **Phase 3 done** for notifications, support chat and 1:1 calls. Order chats (student ↔ assigned mentor) arrive with orders in Phase 4.

## What runs today (`AUTH_MODE=wan`)

| Capability                                                                 | Module (submodule under `modules/`)                                                                          | EduKhata glue                                                                                                                                  | Notes                                                                                                                                                                                   |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| In-app notifications, preferences, Web Push                                | `social-module` (`@amar/social-modules`): `NotificationService`, `PushSubscriptionService`, `DeliveryWorker` | `apps/api/src/social/*` (PostgreSQL repositories, migration 002), `/me/notifications*`, bell + inbox in every dashboard                        | Only notification features are on (follow/groups/pages off). Types in `packages/contracts/src/notifications.ts`. Mandatory: role changes, guardian links. Push only with `VAPID_*` set. |
| Support chat (text, photos, files, voice; read receipts, typing, presence) | `chat-messaging` (`@chat-module/server`, `client`, `react`)                                                  | `apps/api/src/chat/*`, `routes/chat.ts`; web `LiveChat` on `/student/messages`, `/mentor/messages`, `/guardian/messages`, `/support-desk/chat` | Tables `chat_*`, own migration history (`drizzle.__chat_migrations`). Socket.IO at `/api/chat/socket.io/`.                                                                              |
| 1:1 audio/video calls                                                      | `audio-video-calling` (`@agg/calling-*`)                                                                     | `apps/api/src/calling/module.ts`; web `LiveCalls` (overlay on every dashboard page) + call buttons in direct chats                             | Tables `calls`, `call_active_users`. Signalling `/api/calls/ws`; media peer-to-peer WebRTC. **Never recorded** (Q11).                                                                   |
| Email                                                                      | social-module email interface only                                                                           | —                                                                                                                                              | Needs a provider (Q10)                                                                                                                                                                  |
| SMS                                                                        | none                                                                                                         | —                                                                                                                                              | Needs a provider (Q10)                                                                                                                                                                  |

## Rules EduKhata adds

- **Who may message or call whom (Phase 3):** one side must be EduKhata staff (supporter, accountant, admin, super admin). People who aren't staff can only find the support team in chat search. This keeps contact details and deals on the platform until order chats exist. Calls started from a chat also need both people in that chat.
- **Group chats are off.** This uses `features.groups = false`, a switch added upstream in `chat-messaging` (branch `ccr-5992ee5d-65mqhc`, default on for other hosts).
- **Privacy:** chat and calls show names only (no emails, phones or photos). Photos are re-encoded with `sharp`, which removes EXIF/GPS. Message text never appears in notifications or push. Guardians never see their children's chats.
- **Identity:** the chat and call modules take bearer tokens. `GET /api/me/chat-token` issues a 15-minute HMAC token bound to the EduKhata session; every use re-checks that the session is live, the user is active and onboarded. Signing out or suspension ends chat and call access.
- **Files:** signed, 10-minute upload URLs on the API (`PUT /api/chat-files/*`, type and size bound into the signature), 10 MB cap, stored on local disk (`CHAT_UPLOAD_DIR`). Downloads use the module's signed attachment URLs after a membership check.

## Phase 4 hook — order chats

When an order is assigned, the API opens a direct conversation between the student and the assigned mentor and records it in an `order_conversations` table. The contact rule then allows `student ↔ mentor` only through that mapping. On reassignment, the previous mentor loses access. Supporters join on escalation. Disputes use the same conversation.

## Not done / limits

- Ringing a closed or backgrounded app (native push, CallKit/ConnectionService): the callee must have EduKhata open.
- TURN server for calls behind strict NATs and mobile networks: not configured (`CALL_TURN_*`). Calls work on open networks with STUN only.
- Chat files on local disk = single API instance. Move to S3-compatible storage (the module supports it) before scaling out.
- Scheduled consultations: not built.
