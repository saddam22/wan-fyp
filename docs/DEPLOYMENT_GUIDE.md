# Deployment Guide

## Production: wanfyp.online (2026-10-31)

Approved by the owner. Docker Compose on the shared CyberPanel VPS, sign-in through the central
WAN ID hub (https://id.wanbd.online, client `edukhata`). Files in `deploy/`:

- `deploy/Dockerfile` — one image (pnpm workspace incl. submodules) for the API and the web app.
- `deploy/compose.yml` — PostgreSQL 16, API (`:4200`, internal), web (`127.0.0.1:${WEB_PORT}`, default 3210).
- `deploy/setup.sh <domain>` — first run: creates `deploy/.env` (DB password, chat secret), connects the
  hub with `wan-identity-hub/deploy/add-site.sh edukhata`, builds, starts, adds the LiteSpeed proxy
  (incl. WebSockets for chat and calls) to the domain's vhost. Later runs: `./setup.sh` pulls,
  rebuilds and restarts.
- First super admin: `docker compose exec api pnpm --filter @edukhata/api grant-role <email> super_admin`.
- Not set up yet: TURN for calls on mobile networks, Web Push keys, backups of the `pgdata`/`apidata` volumes.

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
