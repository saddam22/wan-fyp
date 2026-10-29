# Deployment Guide

**Nothing is deployed. Production deployment requires the owner's explicit approval.** This guide covers staging, and the steps for production once it is approved.

## What runs

| Process                            | Image / source                                                      | Public?                       | State                                                                             |
| ---------------------------------- | ------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------- |
| PostgreSQL 16                      | `postgres:16.11-bookworm`                                           | no                            | `pgdata` volume                                                                   |
| EduKhata API (`apps/api`, Fastify) | `Dockerfile --target api`                                           | **no**, internal network only | `files` volume (`/data`: order files, proofs, verification documents, chat files) |
| EduKhata web (`apps/web`, Next.js) | `Dockerfile --target web`                                           | yes, via Caddy                | none                                                                              |
| Caddy (TLS, reverse proxy)         | `caddy:2.10.2`                                                      | yes, ports 80/443             | `caddy` volume (certificates)                                                     |
| WAN Identity Hub                   | its own repository (`saddam22/wan-identity-hub`, branch with H1/H2) | yes                           | its own database                                                                  |

Browsers talk only to the web origin. `/api/*` is proxied to the API, including WebSockets: Socket.IO at `/api/chat/socket.io/` and calls at `/api/calls/ws`. The API, the chat, the calls and the background sweeps (matching, delivery, promotions) assume **one API instance**: realtime delivery and rate limiters are in memory, and files are on local disk.

## Prerequisites

- A Linux host with Docker Engine and the Compose plugin, and a DNS name pointing at it (for example `staging.edukhata.example`).
- A running WAN Identity Hub reachable over HTTPS, with the EduKhata client configured. Its `EDK_CLIENT_SECRET` must equal ours, and its redirect URI must be `https://<site>/api/auth/callback`.
- **Before production:** the hub needs SMS/email providers (security finding S6), a TURN server for calls, and an off-site backup target.

## Staging: first deploy

1. Check out the code with its modules:
   ```sh
   git clone https://github.com/saddam22/wan-fyp.git && cd wan-fyp
   git checkout <release tag or commit>
   git submodule update --init
   ```
2. Create the environment file, then validate it:
   ```sh
   cp deploy/.env.staging.example deploy/.env.staging
   # Generate secrets: openssl rand -base64 48   (EDK_CLIENT_SECRET = the hub's value; CHAT_SECRET different)
   node scripts/check-env.mjs staging deploy/.env.staging
   ```
   The check refuses missing values, non-https URLs, development or reused secrets, a short database password, and a site URL different from `WEB_URL`. The API applies the same rules again at start (`apps/api/src/config.ts`).
3. Build and start the stack:
   ```sh
   export EDK_TAG=$(git rev-parse --short HEAD)
   docker compose -f deploy/docker-compose.staging.yml --env-file deploy/.env.staging up -d --build
   ```
   The API applies database migrations at start. They are forward-only and recorded in `schema_migrations`.
4. Create the first super admin. The person signs in once with their WAN ID, then:
   ```sh
   docker compose -f deploy/docker-compose.staging.yml --env-file deploy/.env.staging \
     exec api node --import tsx src/cli/grant-role.ts person@example.com super_admin
   ```
5. Set up the money side: in `/accountant/accounts`, add the receiving bKash, Nagad, Rocket and bank accounts. Grant `accountant` to at least **two** people, because refunds and payouts need two of them.
6. Smoke test (see the checklist below).

The web image bakes in `API_INTERNAL_URL=http://api:4200`, so the API service must be reachable as `api` (the compose service name). Rebuild the web image if you change it.

Behind a proxy that intercepts TLS (a corporate network), pass its CA to the build: `docker build --secret id=ca,src=ca.crt …`. It is used only while downloading and is never stored in an image layer.

## Smoke test after every deploy

- [ ] `https://<site>/` loads. The response headers include `X-Frame-Options: DENY` and `Strict-Transport-Security`.
- [ ] "Continue with WAN ID" signs in and returns to onboarding or the dashboard.
- [ ] A test student places an order. The pay page shows the receiving account. The TrxID submits. An accountant approves it and the order enters matching.
- [ ] A test mentor gets the offer and accepts it. Chat between the student and the mentor works, and a call connects (needs TURN on mobile networks).
- [ ] `/accountant` shows the trial balance as **balanced**.
- [ ] The API's `/health` answers inside the network: `docker compose … exec api node -e "fetch('http://127.0.0.1:4200/health').then(r=>console.log(r.status))"`.

The repository's automated equivalent is `pnpm e2e:wan`: the real hub, API and web, seven journeys, including the full money journey.

## Backups

```sh
# Daily, e.g. from cron on the host (the dump runs inside the db container's network):
docker compose -f deploy/docker-compose.staging.yml --env-file deploy/.env.staging exec -T db \
  pg_dump -U edukhata -Fc edukhata > backups/edukhata-$(date -u +%Y%m%dT%H%M%SZ).dump
docker run --rm -v edukhata-staging_files:/data -v "$PWD/backups":/b busybox \
  tar -czf /b/files-$(date -u +%Y%m%dT%H%M%SZ).tar.gz -C /data .
```

Where the database is reachable directly, `scripts/backup.sh` does both steps. It writes a dump, a files archive and a SHA-256 list, and deletes sets older than `RETAIN_DAYS`. Copy every set **off the host** (encrypted). Recommended: daily dumps kept 14 days, weekly kept 3 months.

**Restore** with `scripts/restore.sh <set>`. It verifies the checksums first, and refuses a database that has tables or a non-empty files directory, so it can't overwrite live data by accident.

**Drill.** `scripts/backup-drill.sh` backs up a database, restores it into a scratch database, compares users, orders, payments, ledger lines, the ledger sum and the migrations, checks that the restored ledger still refuses deletes, then drops the scratch database. It was run on 2026-10-29 against the e2e database (202 users, 67 ledger lines) and the test database (1,301 users, 10,000 orders). Both passed, and each restore took about 1 s. Repeat the drill monthly and after every migration that touches money tables.

## Rollback

Images are tagged with the commit (`EDK_TAG`). To roll back:

1. **Code only** (no new migration in the release): set `EDK_TAG` to the previous tag, then `docker compose … up -d` without `--build`.
2. **The release ran a migration.** Migrations are forward-only. Check whether the previous code tolerates the new schema: our migrations so far only add tables and columns, so it normally does. If it doesn't, restore the database from the backup taken **just before the deploy** into a new database, point `DATABASE_URL` at it, and start the previous tag. Money changes made after that backup must be replayed from the audit log and the provider statements, so take the pre-deploy backup and keep the deploy window short.
3. After a rollback, run the smoke test and check the trial balance.

Always take a backup immediately before deploying a release that contains a migration.

## wanfyp.online (one server, preview)

`deploy/wanfyp.online/` runs everything on one Ubuntu server: Postgres, WAN ID (`id.wanfyp.online`), the API, the web (`wanfyp.online`) and Caddy (automatic HTTPS). The owner approved putting it on the server; it stays a **preview** (`NEXT_PUBLIC_DEMO_MODE=true`, banner on) until the production list above is done.

Needs: a VPS (Ubuntu 22.04/24.04, 2+ CPU, 4+ GB RAM); DNS A records for `wanfyp.online`, `www.wanfyp.online` and `id.wanfyp.online` pointing at it; a Resend account with `wanfyp.online` verified (sign-up codes go by email); a fine-grained GitHub token with read-only Contents on wan-fyp, wan-identity-hub and the five module repos.

```bash
apt-get update && apt-get install -y git
git clone --branch ccr-5992ee5d-65mqhc https://github.com/saddam22/wan-fyp.git /opt/wanfyp/wan-fyp
bash /opt/wanfyp/wan-fyp/deploy/wanfyp.online/install.sh
```

The script installs Docker, asks for the token and the Resend key, generates every secret into `deploy/wanfyp.online/.env` (mode 600, never committed), builds, backs up both databases if a site is already running, and starts. Re-run it to update. Then sign up at the site and grant the first super admin with the command it prints.

Verified here: the stack builds and starts (db, hub, API, web healthy; hub issuer `https://id.wanfyp.online/oidc`). Not verified here: Caddy certificates and the sign-in round-trip, which need the real DNS. Known limits: email-only sign-up (no SMS provider), calls between mobile networks need a TURN server.

## Production (only after the owner approves)

Production uses the same steps with `deploy/.env.production` (validate it with `node scripts/check-env.mjs production …`). It also needs:

- `NEXT_PUBLIC_DEMO_MODE=false`.
- `CALL_TURN_URLS` and its credentials (the check warns when they are missing).
- VAPID keys for push notifications.
- The hub's SMS/email providers.
- Off-site encrypted backups and a tested restore.
- Monitoring of `/` and the API `/health`, disk space on the `files` and `pgdata` volumes, and the API logs. The logs contain no query strings or tokens.
- `TRUST_PROXY` limited to the web container's network.

Recommended before launch: a third-party penetration test, malware scanning of uploads, legal sign-off on holding funds (Q5) and on the academic-integrity terms.

Open owner decisions: see `PROJECT_OVERVIEW.md` → Decisions.

## Configuration reference

- **API** (`apps/api/.env.example`): `DATABASE_URL`, `PORT`, `WEB_URL`, `WAN_HUB_URL`, `EDK_CLIENT_ID`, `EDK_CLIENT_SECRET`, `HUB_CHECK_INTERVAL_SEC`, `TRUST_PROXY`, `CHAT_SECRET`, `CHAT_UPLOAD_DIR`, `ORDER_FILES_DIR`, `VAPID_*`, `CALL_STUN_URLS`, `CALL_TURN_*`.
- **Web** (`.env.example`):
  - Read at build time: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_WAN_HUB_URL`, `NEXT_PUBLIC_ICTSPARK_URL`, `NEXT_PUBLIC_DEMO_MODE`, `NEXT_PUBLIC_ADS_*`, and `API_INTERNAL_URL` (the latter also at runtime).
  - Read at runtime: `AUTH_MODE`.
- **Business rules** (commission, revisions, matching timings, minimum payout, promotion prices, "verified only") are changed in the app by a super admin (`/admin/settings`, audited), not in the environment.
