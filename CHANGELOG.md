# Changelog

## 1.2.0 — auth hardening

Aimed at hosts that expose this app publicly through a tunnel.

### Added
- **CORS lockdown** — `cors()` is no longer wide-open. The default is
  same-origin only; an operator can opt in to additional origins via
  `CORS_ORIGINS=https://a.example.com,https://b.example.com` in `.env`.
- **Helmet** — sets `X-Content-Type-Options`, `X-Frame-Options: DENY`,
  `Referrer-Policy`, and friends.
- **Trust proxy** — Express trusts loopback so rate limiting and audit
  logging see the real visitor IP via `CF-Connecting-IP` instead of
  `127.0.0.1`.
- **Login rate limit + audit log** — 5 failed attempts per 5 minutes
  per IP, successful logins don't count against the budget. Every
  attempt is written to `data/auth-log.jsonl` with ts, IP, UA, outcome.
  Tail the last N entries via `GET /api/auth/audit`.
- **Default-password write block** — while the admin password is still
  the `.env` default, every non-GET API endpoint returns 423 except the
  password-change endpoint itself. Forces the operator to change it
  before they can do anything else.
- **JWT secret validated at startup** — server refuses to boot with no
  `JWT_SECRET` or the placeholder value from `.env.example`.
- **Shorter JWT TTL** — 24 hours instead of 7 days. Configurable via
  `JWT_TTL` in `.env`.
- **Stronger password policy** — minimum 12 characters, at least one
  letter and one digit, different from the previous password.
- **Cloudflare Access banner** — when an ingress rule points at the
  management port (`:8088`), the Dashboard shows a prominent prompt
  recommending Cloudflare Access in front of the hostname.
- **Favicon and theme-color meta** — proper tab icon, no more blank.
- **Edit-subdomain heals DNS** — `PUT /api/ingress/:hostname` now
  upserts the Cloudflare CNAME on every edit, so a subdomain saved
  before the token was set can be fixed without delete-and-readd.
- **Mock reset header-guarded** — the test-only `_reset` endpoint now
  requires `X-Cfui-Mock-Reset: yes` so a stray MOCK_MODE flip can't
  silently wipe state.

## 1.1.0

### Added
- **Backup & restore** — Settings → Backup & restore downloads a single JSON
  snapshot containing state, tunnel credentials, and ingress config. Upload
  the same file on any host running this app to clone the configuration. The
  file contains secrets; the UI calls that out clearly.
- **scripts/upgrade.sh** — safe in-place upgrade that pulls the latest tag,
  rebuilds, and restarts. **Never touches `.env`, `data/`, or
  `/etc/cloudflared/`.** Takes a local snapshot under `/var/backups/` before
  rolling forward so a rollback is one `cp -a` away.

### Guarantee
- Updates pushed via this app's tooling (`scripts/install.sh` re-run on an
  existing install, or `scripts/upgrade.sh`) **never modify user
  configuration files** — `.env`, `data/state.json`, `/etc/cloudflared/*`
  are gitignored and explicitly preserved.

## 1.0.0 — initial release

### Features
- First-run six-step wizard: credentials, tunnel creation, target selection, subdomain setup, install
- Dashboard with Start/Stop/Restart, status badge, uptime, subdomain count
- Subdomains CRUD with auto-restart of the cloudflared service
- "Origin uses HTTPS" toggle for CloudPanel-style sites that force HTTP→HTTPS internally (sets `noTLSVerify` + `originServerName`)
- Live `journalctl -u cloudflared` streaming via SSE with filter, level colouring, pause, clear
- Settings: edit Cloudflare credentials, CloudPanel target, admin password, tunnel rename, delete tunnel, uninstall service
- Inline cheat-sheet for which Cloudflare API token permissions are required
- Mobile-first responsive layout (bottom nav on phones, sidebar on desktop)
- JWT login with rate-limited auth and a "you're on the default password" nudge
- Mock mode for UI development without cloudflared/systemctl
- One-shot installer script
- 20 Playwright tests covering login, wizard, all authed pages, and the HTTPS-origin round-trip

### Backend self-healing
- Wizard recovers from a stale `cloudflared.service` left behind by a failed prior install
- Reset endpoint for the test suite (mock-mode only)

### Tested on
- Ubuntu 24.04 LTS + CloudPanel 2.5.3 + cloudflared 2025.10.1
- Desktop Chrome + Pixel 7 viewport
