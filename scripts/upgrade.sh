#!/usr/bin/env bash
#
# Safe in-place upgrade.
#
#   curl -sSL https://raw.githubusercontent.com/bpbonker/cloudflared-ui/main/scripts/upgrade.sh | sudo bash
#
# Guarantees:
#   * Never touches .env
#   * Never touches data/ (state.json — tokens, tunnel id, password hash)
#   * Never touches /etc/cloudflared/ (config.yml + tunnel credentials)
#   * Refuses to run if it can't find an existing install
#
# What it does:
#   1. `git fetch && git reset --hard origin/<branch>` — only resets tracked
#      files. .env and data/ are gitignored, so they survive.
#   2. Reinstalls server + client npm deps and rebuilds the bundle.
#   3. Restarts the systemd unit.
#
# If you want to roll forward to a specific tag, set REF=v1.x.y before running.

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/cloudflared-ui}"
APP_USER="${APP_USER:-cfui}"
BRANCH="${BRANCH:-main}"
REF="${REF:-}"  # optional: a specific tag or sha to roll to

[ "$EUID" -ne 0 ] && SUDO="sudo" || SUDO=""

step() { printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }
info() { printf "    %s\n" "$*"; }
abort() { printf "\033[1;31mERROR:\033[0m %s\n" "$*" >&2; exit 1; }

[ -d "$APP_DIR/.git" ] || abort "No existing install at $APP_DIR. Use scripts/install.sh for a first install."
[ -f "$APP_DIR/.env" ] || abort "Missing $APP_DIR/.env — refusing to upgrade something that doesn't look configured."

step "Snapshotting current state for safety"
ts=$(date +%Y%m%d-%H%M%S)
snap="/var/backups/cloudflared-ui-${ts}"
$SUDO mkdir -p "$snap"
$SUDO cp -a "$APP_DIR/.env" "$snap/" 2>/dev/null || true
$SUDO cp -a "$APP_DIR/data" "$snap/data" 2>/dev/null || true
$SUDO cp -a /etc/cloudflared "$snap/cloudflared" 2>/dev/null || true
info "Local snapshot written to $snap"

step "Fetching latest from $BRANCH"
$SUDO -u "$APP_USER" git -C "$APP_DIR" fetch --tags --quiet origin
target="origin/$BRANCH"
[ -n "$REF" ] && target="$REF"
$SUDO -u "$APP_USER" git -C "$APP_DIR" reset --hard "$target"
info "Now at $($SUDO -u "$APP_USER" git -C "$APP_DIR" log -1 --oneline)"

step "Updating dependencies"
$SUDO -u "$APP_USER" bash -lc "cd '$APP_DIR' && npm install --omit=optional --no-audit --no-fund" >/dev/null
$SUDO -u "$APP_USER" bash -lc "cd '$APP_DIR/client' && npm install --no-audit --no-fund" >/dev/null

step "Rebuilding client"
$SUDO -u "$APP_USER" bash -lc "cd '$APP_DIR/client' && npm run build"

step "Restarting service"
$SUDO systemctl restart cloudflared-ui

step "Done. Your config, credentials and .env were untouched."
info "Snapshot: $snap"
info "Rollback if needed: sudo cp -a $snap/.env $APP_DIR/ && sudo cp -a $snap/data $APP_DIR/ && sudo cp -a $snap/cloudflared/. /etc/cloudflared/ && sudo systemctl restart cloudflared-ui cloudflared"
