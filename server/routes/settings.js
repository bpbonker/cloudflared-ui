const express = require('express');
const bcrypt = require('bcryptjs');
const cf = require('../lib/cloudflare-api');
const shell = require('../lib/shell');
const store = require('../lib/store');
const cfg = require('../lib/config');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (_req, res) => {
  const state = await store.get();
  // Never echo the token back to the UI. We expose a "set" boolean and the
  // last 4 characters as a hint so users can verify which token is in play.
  const t = state.cloudflare.apiToken;
  res.json({
    cloudflare: {
      hasToken: !!t,
      tokenHint: t ? `…${t.slice(-4)}` : '',
      accountId: state.cloudflare.accountId,
    },
    target: state.target,
    tunnel: state.tunnel,
    usingDefaultPassword: !state.auth.passwordHash,
    appVersion: require('../../package.json').version,
  });
});

router.put('/credentials', async (req, res) => {
  const { apiToken, accountId } = req.body || {};
  if (!apiToken) return res.status(400).json({ message: 'API token is required.' });
  try {
    await cf.verifyToken(apiToken);
    await store.set('cloudflare', { apiToken, accountId: accountId || '' });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ message: 'Token verification failed.', detail: err.message });
  }
});

router.put('/target', async (req, res) => {
  const { host, port } = req.body || {};
  if (!host || !port) return res.status(400).json({ message: 'Host and port are required.' });
  await store.set('target', { host, port: Number(port) });
  res.json({ ok: true });
});

router.put('/password', async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Both current and new passwords are required.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters.' });
  }
  const auth = await store.get('auth');
  let valid;
  if (auth.passwordHash) {
    valid = await bcrypt.compare(currentPassword, auth.passwordHash);
  } else {
    valid = currentPassword === (process.env.ADMIN_PASSWORD || 'changeme');
  }
  if (!valid) return res.status(401).json({ message: 'Current password is incorrect.' });

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await store.set('auth', { passwordHash });
  res.json({ ok: true });
});

router.put('/tunnel', async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ message: 'Name is required.' });
  await store.set('tunnel', { name });
  res.json({ ok: true });
});

router.post('/service/uninstall', async (_req, res) => {
  const bin = process.env.CLOUDFLARED_BIN || 'cloudflared';
  const steps = [
    `sudo -n systemctl stop cloudflared`,
    `sudo -n systemctl disable cloudflared`,
    `sudo -n ${bin} service uninstall`,
  ];
  const results = [];
  for (const cmd of steps) {
    results.push({ cmd, ...(await shell.run(cmd)) });
  }
  res.json({ ok: results.every((r) => r.ok), steps: results });
});

router.delete('/tunnel', async (_req, res) => {
  const t = await store.get('tunnel');
  if (!t.id) return res.status(400).json({ message: 'No tunnel to delete.' });
  // Try to stop the service first so we don't leave a running tunnel with
  // no config behind it.
  await shell.run('sudo -n systemctl stop cloudflared');
  const r = await shell.run(`${process.env.CLOUDFLARED_BIN || 'cloudflared'} tunnel delete -f ${t.id}`);
  if (!r.ok) {
    return res.status(500).json({ message: 'Couldn\'t delete tunnel.', detail: r.stderr });
  }
  await cfg.writeConfig({ ingress: [] });
  await store.set('tunnel', { id: '', name: '' });
  res.json({ ok: true });
});

module.exports = router;
