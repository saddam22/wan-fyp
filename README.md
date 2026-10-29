# EduKhata — Assignment & Practical Khata Marketplace

WANBAHJAHKAS ecosystem marketplace for assignments, handwritten practical khata, drawings and diagrams.

**Status:** Phase 4 (marketplace core) complete in `AUTH_MODE=wan`: orders, automatic matching, delivery, revisions, disputes, order chats and reviews, on top of sign-in, notifications, guardian links, referrals, chat, calls and ad slots. Payments, ledger and payouts are next (Phase 5); until then an order waits at "awaiting payment".

## Run it

Requirements: Node.js 22.12+, pnpm 10 (`corepack enable`).

```bash
git submodule update --init      # WAN modules under modules/ (chat, calling, social, ads)
pnpm install
pnpm build                       # builds modules/, then the apps
pnpm --filter @edukhata/web start   # http://localhost:3200
```

Open `/login` → **Demo sign-in** and choose a role to see its dashboard. Development server: `pnpm dev`.

| Variable                   | Default                   | Meaning                                               |
| -------------------------- | ------------------------- | ----------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`     | `http://localhost:3200`   | Canonical URL for SEO, sitemap and the mentor QR card |
| `NEXT_PUBLIC_ICTSPARK_URL` | `https://ictspark.online` | Where Live Classes / Exams link                       |
| `NEXT_PUBLIC_DEMO_MODE`    | `true`                    | Shows the demo banner and demo sign-in                |

## Run with real WAN sign-in (`AUTH_MODE=wan`)

Needs PostgreSQL 14+ and a checkout of [`wan-identity-hub`](https://github.com/saddam22/wan-identity-hub) (branch with the EduKhata client) next to this repo.

```bash
createdb wan_identity && createdb edukhata
# 1. WAN Identity Hub on :4100 (in wan-identity-hub/server)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wan_identity npm run migrate && npm start
# 2. EduKhata API on :4200 (migrates on start)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/edukhata pnpm dev:api
# 3. Web on :3200
pnpm build && AUTH_MODE=wan pnpm --filter @edukhata/web start
```

Open `/login` → **Continue with WAN ID** (register on the hub; one-time codes show in the hub's dev outbox). After the first sign-in, make yourself super admin on the server:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/edukhata pnpm --filter @edukhata/api grant-role you@example.com super_admin
```

Development secrets default to matching values in the hub and the API; production requires `EDK_CLIENT_SECRET` on both. See `apps/api/.env.example` and `.env.example`.

## Checks

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm e2e        # Playwright UI suite (demo mode); set CHROMIUM_PATH if needed
pnpm e2e:wan    # real sign-in, chat, calls: starts the hub (../wan-identity-hub), API and web (run `pnpm build` first); needs DBs wan_identity_e2e, edukhata_e2e
```

## Layout

```
apps/web            Next.js app — src/app (routes), src/components, src/lib (i18n, nav, session)
apps/api            Fastify 5 + PostgreSQL — WAN sign-in, roles, notifications, guardians, referrals, chat + calls host
modules/            git submodules: chat-messaging, audio-video-calling, social-module, central-ad-platform
packages/contracts  Shared types, money/date helpers, access rules, demo fixtures, mock adapter
docs/               Project tracking (overview, inventory, architecture, audits, roadmap, traceability)
scripts/            gen_traceability.py → docs/FEATURE_TRACEABILITY_MATRIX.md
```
