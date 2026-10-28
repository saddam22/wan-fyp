# Deployment Guide

Not applicable yet. Written in Phase 8 (staging, environment validation, domain/SSL, backup/restore, rollback).
Nothing is deployed. Production deployment requires the owner's explicit approval.

## Notes collected so far (Phase 2)

- Three processes: WAN Identity Hub, EduKhata API (`apps/api`), EduKhata web (`apps/web`). Only the web and the hub are public; the API listens on an internal address and is reached through the web's `/api` rewrite.
- `API_INTERNAL_URL` is read when the web app is **built** (the rewrite is baked in) and at runtime for server-side calls — set it for both.
- Production: `NODE_ENV=production`, HTTPS `WEB_URL`/`WAN_HUB_URL`, the same `EDK_CLIENT_SECRET` on hub and API, `AUTH_MODE=wan`, `NEXT_PUBLIC_DEMO_MODE=false` once marketplace data is real, `TRUST_PROXY` set to the web server's address.
- The first super admin is created with the `grant-role` CLI on the server.
