#!/usr/bin/env bash
# EduKhata on a CyberPanel (OpenLiteSpeed) VPS, with sign-in through the central WAN ID hub.
#
#   First time:  ./setup.sh wanfyp.online
#   Update:      ./setup.sh            (pulls the latest code, rebuilds, restarts)
#
# Before the first run: CyberPanel → Websites → Create Website for the domain (and its SSL),
# and the WAN ID hub at /root/wan-identity-hub (deploy/add-site.sh). Safe to re-run.
# Runs as a script, so a failing step stops only this script, never your terminal.
cd "$(dirname "$0")" || exit 1
ok() { echo -e "\e[32m✓ $*\e[0m"; }
die() { echo -e "\e[31m✗ $*\e[0m"; exit 1; }
HUB_DIR="${HUB_DIR:-/root/wan-identity-hub/deploy}"

command -v docker >/dev/null || die "docker নেই"
set_key() { sed -i -E "/^#?[[:space:]]*$1=/d" .env; printf '%s=%s\n' "$1" "$2" >> .env; }
get_key() { grep -E "^$1=" .env 2>/dev/null | tail -1 | cut -d= -f2-; }

# ── ১. কোড ও সাবমডিউল ──
echo "== ১. কোড"
if [ -f .env ]; then git -C .. pull --ff-only -q || die "git pull হয়নি"; fi
git -C .. submodule update --init --recursive -q || die "সাবমডিউল আনা যায়নি — সাবমডিউলের deploy key যোগ হয়েছে তো?"
ok "$(git -C .. log --oneline -1)"

# ── ২. .env (প্রথমবার) ──
echo "== ২. সেটিং"
if [ ! -f .env ]; then
  DOMAIN="${1:?প্রথমবার ডোমেইন দিন — যেমন: ./setup.sh wanfyp.online}"
  DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN%/}"
  umask 077
  cat > .env <<EOF
# EduKhata production settings — never commit this file.
DOMAIN=$DOMAIN
PUBLIC_URL=https://$DOMAIN
WAN_HUB_URL=https://id.wanbd.online
WEB_PORT=3210
DB_PASSWORD=$(openssl rand -hex 24)
CHAT_SECRET=$(openssl rand -hex 32)
EOF
  ok ".env তৈরি হয়েছে"
fi
DOMAIN=$(get_key DOMAIN); PUBLIC_URL=$(get_key PUBLIC_URL); WEB_PORT=$(get_key WEB_PORT); WEB_PORT=${WEB_PORT:-3210}

# ── ৩. WAN ID হাবে যুক্ত করা ──
echo "== ৩. WAN ID"
if [ -z "$(get_key EDK_CLIENT_SECRET)" ]; then
  [ -x "$HUB_DIR/add-site.sh" ] || die "$HUB_DIR/add-site.sh নেই — হাবে git pull করুন"
  "$HUB_DIR/add-site.sh" edukhata "$PUBLIC_URL" --env "$PWD/.env" | grep '✓' || die "হাবে যুক্ত হয়নি"
fi
ok "client edukhata, হাব $(get_key WAN_HUB_URL)"

# ── ৪. build ও চালু ──
echo "== ৪. build ও চালু (প্রথমবার ৫-১০ মিনিট)"
docker compose up -d --build 2>&1 | grep -vE '^\s*#|^\s*$' | tail -8
for i in $(seq 60); do curl -fs -o /dev/null "http://127.0.0.1:$WEB_PORT/" && break; sleep 3; done
curl -fs -o /dev/null "http://127.0.0.1:$WEB_PORT/" || { docker compose logs --tail 30 api web; die "সাইট চালু হয়নি — উপরের লগ পাঠান"; }
ok "EduKhata চলছে: 127.0.0.1:$WEB_PORT"

# ── ৫. LiteSpeed → EduKhata (একবারই যোগ হয়) ──
echo "== ৫. CyberPanel"
VH=/usr/local/lsws/conf/vhosts/$DOMAIN/vhost.conf
if [ ! -f "$VH" ]; then
  echo "⚠ $VH নেই — CyberPanel → Websites → Create Website ($DOMAIN) করে আবার ./setup.sh চালান"
elif ! grep -q "edukhata-web" "$VH"; then
  cp "$VH" "$VH.bak-$(date +%s)"
  cat >> "$VH" <<EOF

# ── EduKhata (Docker, 127.0.0.1:$WEB_PORT) — wan-fyp/deploy/setup.sh যোগ করেছে ──
extprocessor edukhata-web {
  type                    proxy
  address                 127.0.0.1:$WEB_PORT
  maxConns                500
  pcKeepAliveTimeout      60
  initTimeout             60
  retryTimeout            0
  respBuffer              0
}

websocket /api/chat/socket.io/ {
  address                 127.0.0.1:$WEB_PORT
}

websocket /api/calls/ws {
  address                 127.0.0.1:$WEB_PORT
}

context / {
  type                    proxy
  handler                 edukhata-web
  addDefaultCharset       off
}
EOF
  /usr/local/lsws/bin/lswsctrl restart >/dev/null && sleep 3
  ok "LiteSpeed প্রক্সি যোগ হয়েছে (ব্যাকআপ: $VH.bak-*)"
else
  ok "LiteSpeed প্রক্সি আগেই আছে"
fi

# ── ৬. যাচাই ──
echo "== ৬. যাচাই"
code=$(curl -s -o /dev/null -w '%{http_code}' "https://$DOMAIN/login")
[ "$code" = 200 ] && ok "https://$DOMAIN/login → 200" || echo "⚠ https://$DOMAIN/login → $code (SSL দেওয়া না থাকলে CyberPanel → SSL → Issue SSL)"
echo
echo "এখন খুলুন: https://$DOMAIN/login → \"WAN আইডি দিয়ে লগইন\""
echo "প্রথম লগইনের পর নিজেকে super admin করতে:"
echo "  cd $PWD && docker compose exec api pnpm --filter @edukhata/api grant-role <আপনার-ইমেইল> super_admin"
