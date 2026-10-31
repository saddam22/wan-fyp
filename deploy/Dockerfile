# EduKhata — one image for both processes (API and web). Built by deploy/compose.yml.
# Needs the submodules under modules/ (git submodule update --init) in the build context.
FROM node:22-bookworm-slim

ENV CI=true NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app

COPY . .
RUN pnpm install --frozen-lockfile

# Read by Next.js at build time (public values and the /api rewrite target).
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_WAN_HUB_URL
ARG NEXT_PUBLIC_ICTSPARK_URL=https://ictspark.online
ARG NEXT_PUBLIC_DEMO_MODE=false
ARG NEXT_PUBLIC_ADS_URL=
ARG NEXT_PUBLIC_ADS_APP_KEY=
ARG API_INTERNAL_URL=http://api:4200
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_WAN_HUB_URL=$NEXT_PUBLIC_WAN_HUB_URL \
    NEXT_PUBLIC_ICTSPARK_URL=$NEXT_PUBLIC_ICTSPARK_URL \
    NEXT_PUBLIC_DEMO_MODE=$NEXT_PUBLIC_DEMO_MODE \
    NEXT_PUBLIC_ADS_URL=$NEXT_PUBLIC_ADS_URL \
    NEXT_PUBLIC_ADS_APP_KEY=$NEXT_PUBLIC_ADS_APP_KEY \
    API_INTERNAL_URL=$API_INTERNAL_URL \
    AUTH_MODE=wan
RUN pnpm build

ENV NODE_ENV=production
