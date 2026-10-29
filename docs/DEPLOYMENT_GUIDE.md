# Deployment Guide

Not applicable yet. Written in Phase 8 (staging, environment validation, domain/SSL, backup/restore, rollback).
Nothing is deployed. Production deployment requires the owner's explicit approval.

## Notes collected so far (Phases 2–3)

- Three processes: WAN Identity Hub, EduKhata API (`apps/api`), EduKhata web (`apps/web`). Only the web and the hub are public; the API listens on an internal address and is reached through the web's `/api` rewrite.
- `API_INTERNAL_URL` is read when the web app is **built** (the rewrite is baked in) and at runtime for server-side calls — set it for both.
- Production: `NODE_ENV=production`, HTTPS `WEB_URL`/`WAN_HUB_URL`, the same `EDK_CLIENT_SECRET` on hub and API, `AUTH_MODE=wan`, `NEXT_PUBLIC_DEMO_MODE=false` once marketplace data is real, `TRUST_PROXY` set to the web server's address.
- The first super admin is created with the `grant-role` CLI on the server.
- Build order: `pnpm build` runs `build:modules` first (chat, calling, social, ad SDK in `modules/`), then the apps. Clone with `git submodule update --init`.
- Realtime goes through the web origin: Socket.IO at `/api/chat/socket.io/` (the web rewrite keeps the trailing slash; `skipTrailingSlashRedirect` is on) and call signalling at `/api/calls/ws`. A reverse proxy in front of the web app must pass WebSocket upgrades.
- API secrets: `CHAT_SECRET` (32+ chars, required in production), optional `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` for Web Push.
- Calls: `CALL_STUN_URLS`, and a TURN server (`CALL_TURN_URLS` + `CALL_TURN_SECRET` or `CALL_TURN_USERNAME`/`CALL_TURN_CREDENTIAL`) — required for reliable calls on mobile networks; not set up yet.
- Chat files: `CHAT_UPLOAD_DIR` on a persistent, backed-up volume; single API instance only (S3-compatible storage before scaling out). The chat, call and notification services also assume one API instance (in-memory realtime delivery and rate limiters).
- Ads: `NEXT_PUBLIC_ADS_URL` and `NEXT_PUBLIC_ADS_APP_KEY` at build time.
