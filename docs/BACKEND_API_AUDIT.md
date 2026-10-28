# Backend API Audit

## Existing APIs EduKhata would call (Phase 0)

| Service | Contract document | Used for |
|---|---|---|
| WAN Identity Hub | `wan-identity-hub/README.md` (API table) + `/oidc/.well-known/openid-configuration` | Login, profile claims, entitlements (after hub extension H2) |
| Chat module | `chat-messaging/docs/api-contract.md` (REST + Socket.IO, `CONTRACT_VERSION`) | Order and support chat |
| Calling module | `audio-video-calling/docs/calling/api-contract.md` | 1:1 calls |
| Ad Platform | `central-ad-platform/docs/api/API.md`, SDK | Ad slots |
| ICTSpark | no API docs; routes in `server/src/routes` | Rules reference only (no runtime calls proposed) |

EduKhata's own API does not exist yet. It will be documented as OpenAPI from Zod contracts in Phase 4.
