#!/usr/bin/env bash
# Puts EduKhata + WAN ID on one Ubuntu server for wanfyp.online.
# Run as root on the server (Ubuntu 22.04/24.04, 2+ CPU, 4+ GB RAM, 40+ GB disk):
#
#   apt-get update && apt-get install -y git
#   git clone --branch ccr-5992ee5d-65mqhc https://github.com/saddam22/wan-fyp.git /opt/wanfyp/wan-fyp
#   bash /opt/wanfyp/wan-fyp/deploy/wanfyp.online/install.sh
#
# Before running: DNS A records for wanfyp.online, www.wanfyp.online and id.wanfyp.online
# point at this server; a Resend account (resend.com) with wanfyp.online verified.
# Re-running is safe: it pulls the latest code, keeps .env and the data, and rebuilds.
set -euo pipefail

SITE_DOMAIN="${SITE_DOMAIN:-wanfyp.online}"
ID_DOMAIN="${ID_DOMAIN:-id.${SITE_DOMAIN}}"
BRANCH="${BRANCH:-ccr-5992ee5d-65mqhc}"
ROOT="${ROOT:-/opt/wanfyp}"

say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

[[ $EUID -eq 0 ]] || { echo "Run as root (sudo -i)."; exit 1; }

say "Docker"
if ! command -v docker >/dev/null; then
  apt-get update -qq && apt-get install -y -qq ca-certificates curl git openssl
  curl -fsSL https://get.docker.com | sh
fi
command -v git >/dev/null || apt-get install -y -qq git
docker compose version >/dev/null

say "Ports 80 and 443"
# Caddy needs both ports for HTTPS. Another web server (LiteSpeed, nginx, Apache) holding
# them is not stopped by this script: it may be serving other sites.
BUSY=$(ss -Hltnp '( sport = :80 or sport = :443 )' | grep -v docker-proxy || true)
if [[ -n $BUSY ]]; then
  echo "Ports 80/443 are used by another program:"; echo "$BUSY"
  echo "Free them (or ask for the reverse-proxy setup), then run this script again."
  exit 1
fi

say "Code (GitHub)"
# The repositories are private: a fine-grained GitHub token with read-only "Contents" on
# wan-fyp, wan-identity-hub, chat-messaging, audio-video-calling, social-module,
# central-ad-platform and marketplace-jobs. It is kept only in $ROOT/.git-credentials (mode 600).
# The script uses its own git settings, so a credential helper, SSH key or "insteadOf"
# rule already on this server can't get in the way.
mkdir -p "$ROOT" && cd "$ROOT"
export GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL="$ROOT/.gitconfig" GIT_TERMINAL_PROMPT=0
CRED="$ROOT/.git-credentials"
if [[ ! -s $CRED ]]; then
  read -rsp "GitHub token (read-only): " GH_TOKEN; echo
  [[ -n $GH_TOKEN ]] || { echo "A token is needed for the private repositories."; exit 1; }
  ( umask 077; printf 'https://x-access-token:%s@github.com\n' "$GH_TOKEN" > "$CRED" )
fi
git config --global credential.helper "store --file=$CRED"
for repo in wan-fyp wan-identity-hub; do
  if [[ -d $repo/.git ]]; then
    git -C "$repo" fetch -q origin "$BRANCH" && git -C "$repo" checkout -q "$BRANCH" && git -C "$repo" reset -q --hard "origin/$BRANCH"
  elif ! git clone -q --branch "$BRANCH" "https://github.com/saddam22/$repo.git"; then
    rm -f "$CRED"
    echo "Could not read saddam22/$repo with that token: give it read-only Contents on all 7 repositories, then run again."
    exit 1
  fi
done
git -C wan-fyp submodule update --init --recursive -q

DIR="$ROOT/wan-fyp/deploy/wanfyp.online"
cd "$DIR"
COMPOSE=(docker compose --env-file .env -f docker-compose.yml)

say "Settings (.env)"
if [[ ! -f .env ]]; then
  read -rp "Resend API key (re_...): " RESEND_API_KEY
  read -rp "Email sender [WAN ID <no-reply@${SITE_DOMAIN}>]: " EMAIL_FROM
  EMAIL_FROM="${EMAIL_FROM:-WAN ID <no-reply@${SITE_DOMAIN}>}"
  rnd() { openssl rand -hex 32; }
  umask 077
  cat > .env <<ENV
SITE_DOMAIN=${SITE_DOMAIN}
ID_DOMAIN=${ID_DOMAIN}
POSTGRES_PASSWORD=$(rnd)
EDK_CLIENT_SECRET=$(rnd)
CHAT_SECRET=$(rnd)
HUB_COOKIE_KEY=$(rnd)
RESEND_API_KEY=${RESEND_API_KEY}
EMAIL_FROM='${EMAIL_FROM}'
NEXT_PUBLIC_DEMO_MODE=true
EDK_TAG=$(git -C "$ROOT/wan-fyp" rev-parse --short HEAD)
ENV
  # The hub signs ID tokens with an RSA key, made once and kept in .env.
  JWKS=$(docker run --rm node:22-bookworm-slim node -e '
    const { generateKeyPairSync, randomUUID } = require("node:crypto");
    const k = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ format: "jwk" });
    process.stdout.write(JSON.stringify({ keys: [{ ...k, kid: randomUUID(), alg: "RS256", use: "sig" }] }));')
  printf "HUB_OIDC_JWKS='%s'\n" "$JWKS" >> .env
else
  sed -i "s/^EDK_TAG=.*/EDK_TAG=$(git -C "$ROOT/wan-fyp" rev-parse --short HEAD)/" .env
fi

say "Building (first time: 10-20 minutes)"
"${COMPOSE[@]}" build --pull

say "Backup before changing a running site"
if "${COMPOSE[@]}" ps --status running db 2>/dev/null | grep -q db; then
  mkdir -p "$ROOT/backups"
  for d in edukhata wan_identity; do
    "${COMPOSE[@]}" exec -T db pg_dump -U edukhata -Fc "$d" > "$ROOT/backups/$d-$(date -u +%Y%m%dT%H%M%SZ).dump"
  done
  echo "Saved in $ROOT/backups"
fi

say "Starting"
"${COMPOSE[@]}" up -d
for i in $(seq 1 60); do
  if "${COMPOSE[@]}" exec -T api node -e "fetch('http://127.0.0.1:4200/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))" 2>/dev/null; then
    break
  fi
  sleep 5
done
"${COMPOSE[@]}" ps

cat <<DONE

Done.
  EduKhata:  https://${SITE_DOMAIN}
  WAN ID:    https://${ID_DOMAIN}
(HTTPS certificates are issued on the first visit; DNS must already point here.)

First super admin — register at https://${SITE_DOMAIN} with "Continue with WAN ID", then:
  cd ${DIR} && docker compose --env-file .env exec api node --import tsx src/cli/grant-role.ts YOUR@EMAIL super_admin

Update later: run this script again. Logs: docker compose --env-file .env logs -f api web hub
DONE
