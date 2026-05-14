#!/usr/bin/env bash
#
# Cloudflare Tunnel Manager — one-shot installer for Ubuntu 22.04 / 24.04 and
# Debian 12. Run as a normal user with sudo access:
#
#   curl -sSL https://raw.githubusercontent.com/<org>/<repo>/main/scripts/install.sh | bash
#
# What it does:
#   1. Apt-installs git, curl, jq, ca-certificates
#   2. Installs Node 20 LTS via NodeSource if not present
#   3. Installs cloudflared via the official Cloudflare apt repo if not present
#   4. Creates a `cfui` system user and clones this repo into /opt/cloudflared-ui
#   5. Builds the React client and installs server deps
#   6. Writes a sensible .env with a random JWT_SECRET
#   7. Drops a sudoers rule so the UI can drive systemctl + cloudflared
#   8. Installs and starts the cloudflared-ui systemd unit on port 8088
#
# Re-running is safe: existing files aren't clobbered and the systemd unit is
# only restarted, not reinstalled.

set -euo pipefail

REPO="${REPO:-https://github.com/bpbonker/cloudflared-ui.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/opt/cloudflared-ui}"
APP_USER="${APP_USER:-cfui}"
APP_PORT="${APP_PORT:-8088}"

step()  { printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }
info()  { printf "    %s\n" "$*"; }
abort() { printf "\033[1;31mERROR:\033[0m %s\n" "$*" >&2; exit 1; }

[ "$EUID" -ne 0 ] && SUDO="sudo" || SUDO=""

step "Checking base requirements"
$SUDO apt-get update -qq
$SUDO apt-get install -y -qq git curl jq ca-certificates

if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  step "Installing Node.js 20 LTS"
  curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO bash -
  $SUDO apt-get install -y -qq nodejs
fi
info "node $(node -v) / npm $(npm -v)"

if ! command -v cloudflared >/dev/null; then
  step "Installing cloudflared"
  $SUDO mkdir -p --mode=0755 /usr/share/keyrings
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | $SUDO tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
  . /etc/os-release
  echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared ${VERSION_CODENAME} main" | \
    $SUDO tee /etc/apt/sources.list.d/cloudflared.list >/dev/null
  $SUDO apt-get update -qq
  $SUDO apt-get install -y -qq cloudflared
fi
info "cloudflared $(cloudflared --version | head -1)"

if ! id "$APP_USER" >/dev/null 2>&1; then
  step "Creating $APP_USER system user"
  $SUDO useradd -r -m -s /bin/bash -d "$APP_DIR" "$APP_USER"
fi

step "Cloning $REPO into $APP_DIR"
$SUDO mkdir -p "$APP_DIR" /etc/cloudflared
if [ ! -d "$APP_DIR/.git" ]; then
  $SUDO -u "$APP_USER" git clone --branch "$BRANCH" "$REPO" "$APP_DIR"
else
  info "Repo already present — pulling latest"
  $SUDO -u "$APP_USER" git -C "$APP_DIR" fetch --quiet
  $SUDO -u "$APP_USER" git -C "$APP_DIR" reset --hard "origin/$BRANCH"
fi
$SUDO chown -R "$APP_USER":"$APP_USER" "$APP_DIR" /etc/cloudflared

step "Installing app dependencies and building the client"
$SUDO -u "$APP_USER" bash -lc "cd '$APP_DIR' && npm install --omit=optional --no-audit --no-fund"
$SUDO -u "$APP_USER" bash -lc "cd '$APP_DIR/client' && npm install --no-audit --no-fund && npm run build"

if [ ! -f "$APP_DIR/.env" ]; then
  step "Writing initial .env"
  $SUDO -u "$APP_USER" tee "$APP_DIR/.env" >/dev/null <<EOF
PORT=$APP_PORT
JWT_SECRET=$(openssl rand -hex 32)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme
CLOUDFLARED_CONFIG_DIR=/etc/cloudflared
CLOUDFLARED_BIN=cloudflared
MOCK_MODE=false
EOF
  $SUDO chmod 600 "$APP_DIR/.env"
  info "Default login: admin / changeme — change it on first sign-in."
else
  info ".env already exists, leaving it alone"
fi

CFD_PATH="$(command -v cloudflared)"
step "Installing sudoers rules"
$SUDO tee /etc/sudoers.d/cloudflared-ui >/dev/null <<EOF
$APP_USER ALL=(root) NOPASSWD: /usr/bin/systemctl start cloudflared, /usr/bin/systemctl stop cloudflared, /usr/bin/systemctl restart cloudflared, /usr/bin/systemctl enable cloudflared, /usr/bin/systemctl disable cloudflared, /usr/bin/systemctl status cloudflared, /usr/bin/systemctl show cloudflared, /usr/bin/journalctl -u cloudflared *, $CFD_PATH service install, $CFD_PATH service uninstall, $CFD_PATH tunnel *
EOF
$SUDO chmod 440 /etc/sudoers.d/cloudflared-ui
$SUDO visudo -c -f /etc/sudoers.d/cloudflared-ui >/dev/null || abort "sudoers file failed validation"

step "Installing systemd unit"
$SUDO tee /etc/systemd/system/cloudflared-ui.service >/dev/null <<EOF
[Unit]
Description=Cloudflare Tunnel Manager UI
After=network-online.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
$SUDO systemctl daemon-reload
$SUDO systemctl enable --now cloudflared-ui

IP=$(hostname -I 2>/dev/null | awk '{print $1}')
step "All done."
info "Open http://${IP:-<server-ip>}:${APP_PORT} and sign in with admin / changeme."
info "If your firewall blocks ${APP_PORT}, allow it from your LAN: sudo ufw allow from <lan>/16 to any port ${APP_PORT} proto tcp"
