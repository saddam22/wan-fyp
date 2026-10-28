# Chat & Communication Integration

Status: **design only** (Phase 3).

| Need                                                          | Module                                   | Fit                                                                                                                                                                                               |
| ------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Student–mentor order chat, files, read receipts, realtime     | `chat-messaging`                         | Good. Order chat = group conversation (student, mentor; supporter added on escalation) + `order_conversations` mapping table in EduKhata                                                          |
| General support chat                                          | `chat-messaging`                         | Good (direct conversation with a support account, or group with the supporter pool)                                                                                                               |
| In-app notifications, preferences, web push                   | `social-module`                          | Good. Register types `order.offer`, `order.assigned`, `order.delivered`, `order.revision`, `payment.approved`, `payment.rejected`, `deadline.soon`, `payout.paid`, `dispute.update`               |
| Email                                                         | `social-module` email **interface** only | Needs a provider (Q10)                                                                                                                                                                            |
| SMS                                                           | none                                     | Needs a provider (Q10)                                                                                                                                                                            |
| 1:1 audio/video consultation                                  | `audio-video-calling`                    | Good, one-to-one only; TURN server needed in production                                                                                                                                           |
| Call recording ("Live Chat & Video with Recording" in mockup) | none                                     | **Not available.** Requires an SFU/recording service, explicit consent from both parties, retention policy and access control. Proposed: remove "with Recording" from the UI until approved (Q11) |
| Scheduled meetings                                            | none                                     | Build a small scheduling table in EduKhata that opens a 1:1 call at the time                                                                                                                      |

Integration requirements (from the modules' docs): Node ≥ 22.12, Fastify 5, PostgreSQL ≥ 14 with `pg_trgm`, `pg` Pool, S3-compatible storage, React 19 for the web UI. These match the proposed stack.

Membership rule: when an order is reassigned, the previous mentor is removed from the order conversation and keeps history only up to removal (module supports per-join visibility).
