# Changelog

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
