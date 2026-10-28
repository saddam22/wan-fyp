# EduKhata — Assignment & Practical Khata Marketplace

WANBAHJAHKAS ecosystem marketplace for assignments, handwritten practical khata, drawings and diagrams.

**Status:** Phase 1 (frontend) complete and **waiting for owner review**. Everything runs on demo data — there is no backend yet. Start with [`docs/PROJECT_OVERVIEW.md`](docs/PROJECT_OVERVIEW.md).

## Run it

Requirements: Node.js 22.12+, pnpm 10 (`corepack enable`).

```bash
pnpm install
pnpm build                       # builds apps/web
pnpm --filter @edukhata/web start   # http://localhost:3200
```

Open `/login` → **Demo sign-in** and choose a role to see its dashboard. Development server: `pnpm dev`.

| Variable                   | Default                   | Meaning                                               |
| -------------------------- | ------------------------- | ----------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`     | `http://localhost:3200`   | Canonical URL for SEO, sitemap and the mentor QR card |
| `NEXT_PUBLIC_ICTSPARK_URL` | `https://ictspark.online` | Where Live Classes / Exams link                       |
| `NEXT_PUBLIC_DEMO_MODE`    | `true`                    | Shows the demo banner and demo sign-in                |

## Checks

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm e2e        # Playwright; set CHROMIUM_PATH if Chromium is not installed for Playwright
```

## Layout

```
apps/web            Next.js app — src/app (routes), src/components, src/lib (i18n, nav, demo session)
packages/contracts  Shared types, money/date helpers, access rules, demo fixtures, mock adapter
docs/               Project tracking (overview, inventory, architecture, audits, roadmap, traceability)
scripts/            gen_traceability.py → docs/FEATURE_TRACEABILITY_MATRIX.md
```
