const express = require('express');
const shell = require('../lib/shell');
const store = require('../lib/store');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// Parses `systemctl show cloudflared` key=value output. Easier than wrangling
// `is-active` for the extra fields we want (uptime, sub-state).
function parseShow(text) {
  const map = {};
  text.split('\n').forEach((line) => {
    const i = line.indexOf('=');
    if (i > 0) map[line.slice(0, i)] = line.slice(i + 1);
  });
  return map;
}

router.get('/status', async (_req, res) => {
  const tunnel = await store.get('tunnel');
  const { stdout } = await shell.run('systemctl show cloudflared --no-page');
  const info = parseShow(stdout);
  const active = info.ActiveState || 'unknown';
  const sub = info.SubState || 'unknown';
  const since = info.ActiveEnterTimestamp || '';

  let badge = 'stopped';
  if (active === 'active' && sub === 'running') badge = 'running';
  else if (active === 'activating' || sub === 'auto-restart') badge = 'warning';

  res.json({
    badge,
    activeState: active,
    subState: sub,
    activeSince: since,
    tunnel,
  });
});

async function runAndRespond(res, cmd, action) {
  const r = await shell.run(cmd);
  if (!r.ok) {
    return res.status(500).json({
      message: `Couldn't ${action} the tunnel. ${r.stderr?.includes('sudo') ? 'Sudo permission may be missing — check the README.' : ''}`.trim(),
      detail: r.stderr || r.stdout,
    });
  }
  res.json({ ok: true });
}

router.post('/start',   (_req, res) => runAndRespond(res, 'sudo -n systemctl start cloudflared',   'start'));
router.post('/stop',    (_req, res) => runAndRespond(res, 'sudo -n systemctl stop cloudflared',    'stop'));
router.post('/restart', (_req, res) => runAndRespond(res, 'sudo -n systemctl restart cloudflared', 'restart'));

module.exports = router;
