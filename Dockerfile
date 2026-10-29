# syntax=docker/dockerfile:1.7
# EduKhata images: `--target api` (Fastify API) and `--target web` (Next.js).
# Build from a checkout with submodules: git submodule update --init
ARG NODE_IMAGE=node:22.22.0-bookworm-slim

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true NEXT_TELEMETRY_DISABLED=1
# Optional extra CA (e.g. a corporate TLS proxy): docker build --secret id=ca,src=ca.crt …
# It is used only while downloading and never stored in a layer.
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi; \
    corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /repo

FROM base AS build
COPY . .
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi; \
    pnpm install --frozen-lockfile
# The web app bakes these in at build time (the /api rewrite and public URLs).
ARG API_INTERNAL_URL=http://api:4200
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_WAN_HUB_URL
ARG NEXT_PUBLIC_ICTSPARK_URL=https://ictspark.online
ARG NEXT_PUBLIC_DEMO_MODE=false
ARG NEXT_PUBLIC_ADS_URL=
ARG NEXT_PUBLIC_ADS_APP_KEY=
ENV API_INTERNAL_URL=$API_INTERNAL_URL NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_WAN_HUB_URL=$NEXT_PUBLIC_WAN_HUB_URL NEXT_PUBLIC_ICTSPARK_URL=$NEXT_PUBLIC_ICTSPARK_URL \
    NEXT_PUBLIC_DEMO_MODE=$NEXT_PUBLIC_DEMO_MODE NEXT_PUBLIC_ADS_URL=$NEXT_PUBLIC_ADS_URL \
    NEXT_PUBLIC_ADS_APP_KEY=$NEXT_PUBLIC_ADS_APP_KEY
RUN node scripts/check-env.mjs web-build \
 && pnpm build:modules \
 && pnpm --filter @edukhata/contracts build \
 && pnpm --filter @edukhata/web build \
 && pnpm --filter @edukhata/api typecheck

# ---- API: migrations run at start; files live on the /data volume ----
FROM base AS api
ENV NODE_ENV=production PORT=4200 ORDER_FILES_DIR=/data/order-files CHAT_UPLOAD_DIR=/data/chat-uploads
COPY --from=build --chown=node:node /repo /repo
RUN mkdir -p /data && chown node:node /data
USER node
WORKDIR /repo/apps/api
EXPOSE 4200
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4200/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "--import", "tsx", "src/server.ts"]

# ---- Web ----
FROM base AS web
ENV NODE_ENV=production PORT=3200 AUTH_MODE=wan
COPY --from=build --chown=node:node /repo /repo
USER node
WORKDIR /repo/apps/web
EXPOSE 3200
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3200/').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3200"]
