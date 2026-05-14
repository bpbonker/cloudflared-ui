// Portable backup & restore.
//
// The backup is a single JSON file containing everything needed to reproduce
// a working install on a different machine (or recover this one after a
// disaster): the local state (Cloudflare token, account id, tunnel id, target,
// admin password hash), the cloudflared config.yml, and the tunnel
// credentials file.
//
// We deliberately keep this as plain JSON instead of a tarball so users can
// open it in any text editor to inspect/diff, version-control it, or commit
// it to a secret manager. The contents include secrets — the UI tells the
// user clearly to treat the file as such.
//
// Restore is atomic per-file: we write each file in place and call
// `store.reload()` so the in-process cache picks up the new state without
// requiring a service restart for the UI. We do trigger a cloudflared
// restart so the new ingress takes effect.

const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');
const store = require('../lib/store');
const cfg = require('../lib/config');
const shell = require('../lib/shell');
const pkg = require('../../package.json');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

async function readMaybe(p) {
  try { return await fs.readFile(p, 'utf8'); }
  catch (err) { if (err.code === 'ENOENT') return null; throw err; }
}

// Resolve config/credentials locations through the config layer so we read
// from the same place whichever mode we're in (real /etc/cloudflared in
// production, the fallback data/cloudflared in mock mode for testing).
function configPath() { return cfg.effectivePath(); }
function configDir()  { return path.dirname(configPath()); }

router.get('/', async (_req, res) => {
  const state = await store.get();
  const stateRaw = await readMaybe(STATE_FILE);
  const configRaw = await readMaybe(configPath());
  const credentialsRaw = state.tunnel.id
    ? await readMaybe(path.join(configDir(), `${state.tunnel.id}.json`))
    : null;

  const filename = `cloudflared-ui-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  res.set({
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Type': 'application/json; charset=utf-8',
    // Tell shared caches / proxies never to keep this — it has secrets.
    'Cache-Control': 'no-store',
  });
  res.json({
    meta: {
      kind: 'cloudflared-ui-backup',
      schemaVersion: 1,
      appVersion: pkg.version,
      createdAt: new Date().toISOString(),
      hostname: require('node:os').hostname(),
      tunnelId: state.tunnel.id || null,
    },
    state: stateRaw,
    config: configRaw,
    credentials: credentialsRaw,
  });
});

function isValidBackup(b) {
  return !!(b && b.meta && b.meta.kind === 'cloudflared-ui-backup' && typeof b.meta.schemaVersion === 'number');
}

router.post('/', async (req, res) => {
  const b = req.body;
  if (!isValidBackup(b)) {
    return res.status(400).json({
      message: 'That doesn\'t look like a cloudflared-ui backup file. Expected JSON with meta.kind = "cloudflared-ui-backup".',
    });
  }
  if (b.meta.schemaVersion > 1) {
    return res.status(400).json({
      message: `This backup was produced by a newer version of the app (schema v${b.meta.schemaVersion}). Upgrade the app before restoring.`,
    });
  }

  // 1. Write the state file. We bypass store.set so we can drop the whole
  //    blob in one shot instead of merging by section.
  if (b.state) {
    let parsed;
    try { parsed = JSON.parse(b.state); }
    catch { return res.status(400).json({ message: 'state.json in the backup is not valid JSON.' }); }
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(STATE_FILE, JSON.stringify(parsed, null, 2), 'utf8');
  }

  // 2. Write the cloudflared config.yml. We round-trip it through our config
  //    parser so a malformed file in the backup is caught before we touch the
  //    real one.
  if (b.config) {
    const yaml = require('js-yaml');
    let parsed;
    try { parsed = yaml.load(b.config); }
    catch { return res.status(400).json({ message: 'config.yml in the backup is not valid YAML.' }); }
    if (parsed && parsed.tunnel) {
      await cfg.writeConfig(parsed);
    }
  }

  // 3. Write the tunnel credentials file. Restore is only meaningful when the
  //    tunnel id in state matches the credentials filename — otherwise
  //    cloudflared won't be able to find them.
  if (b.credentials && b.meta.tunnelId) {
    const credsPath = path.join(configDir(), `${b.meta.tunnelId}.json`);
    try {
      await fs.mkdir(configDir(), { recursive: true });
      await fs.writeFile(credsPath, b.credentials, { mode: 0o600 });
    } catch (err) {
      return res.status(500).json({
        message: `Couldn't write credentials file at ${credsPath}: ${err.message}`,
      });
    }
  }

  // 4. Reload the in-memory store cache so /api/settings reflects the new state.
  store.invalidate();

  // 5. Restart cloudflared so it picks up the restored config.
  const r = await shell.run('sudo -n systemctl restart cloudflared');
  res.json({
    ok: true,
    restartedTunnel: r.ok,
    restartMessage: r.ok ? null : (r.stderr || 'cloudflared restart failed').trim(),
    meta: b.meta,
  });
});

module.exports = router;
