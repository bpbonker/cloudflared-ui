// First-run wizard endpoints. Each step is a discrete POST so the React
// wizard can drive the user through them one screen at a time and surface
// errors with context (e.g. "your token is missing the DNS:Edit permission")
// instead of one giant `setup()` call that fails opaquely.
//
// Design note: we deliberately use the Cloudflare REST API to create the
// tunnel (rather than `cloudflared tunnel create`) so the user never has to
// run an interactive `cloudflared login` from a terminal. The API token
// they paste in step 2 is the only credential we need.

const express = require('express');
const path = require('node:path');
const fs = require('node:fs/promises');
const net = require('node:net');
const cf = require('../lib/cloudflare-api');
const cfg = require('../lib/config');
const shell = require('../lib/shell');
const store = require('../lib/store');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const CONFIG_DIR = process.env.CLOUDFLARED_CONFIG_DIR || '/etc/cloudflared';
const MOCK = process.env.MOCK_MODE === 'true';

// Test-only: wipe local state so the wizard can be re-run. Guarded by
// MOCK_MODE *and* by a deliberate header so accidentally flipping
// MOCK_MODE on a real host can't destroy a real configuration. The
// Playwright suite sends both.
router.post('/_reset', async (req, res) => {
  if (!MOCK) return res.status(403).json({ message: 'Only available in mock mode.' });
  if (req.get('X-Cfui-Mock-Reset') !== 'yes') {
    return res.status(403).json({
      message: 'Refusing to reset. Send X-Cfui-Mock-Reset: yes to confirm. This endpoint exists only for the test harness.',
    });
  }
  const fsModule = require('node:fs/promises');
  const cfgPath = cfg.effectivePath();
  await store.set('cloudflare', { apiToken: '', accountId: '' });
  await store.set('tunnel', { id: '', name: '' });
  await store.set('target', { host: 'localhost', port: 80 });
  await store.set('auth', { passwordHash: '' }); // so tests can log in with .env default
  try { await fsModule.unlink(cfgPath); } catch {}
  res.json({ ok: true });
});

router.get('/status', async (_req, res) => {
  const configured = await cfg.isConfigured();
  const state = await store.get();
  res.json({
    configured,
    hasCredentials: !!(state.cloudflare.apiToken && state.cloudflare.accountId),
    tunnel: state.tunnel,
    target: state.target,
  });
});

router.post('/verify-token', requireAuth, async (req, res) => {
  const { apiToken, accountId } = req.body || {};
  if (!apiToken) return res.status(400).json({ message: 'API token is required.' });
  // In mock mode (used by the e2e tests) we accept any token so the wizard
  // can be driven without talking to the real Cloudflare API.
  if (MOCK) {
    await store.set('cloudflare', { apiToken, accountId: accountId || '' });
    return res.json({ ok: true, tokenStatus: 'active', mock: true });
  }
  try {
    const result = await cf.verifyToken(apiToken);
    await store.set('cloudflare', { apiToken, accountId: accountId || '' });
    res.json({ ok: true, tokenStatus: result.status });
  } catch (err) {
    res.status(400).json({
      message: 'That token didn\'t work. Double-check it and make sure it has Zone:DNS:Edit and Account:Cloudflare Tunnel:Edit permissions.',
      detail: err.response?.data || err.message,
    });
  }
});

// Tunnel creation via the API. We also write the credentials JSON file that
// cloudflared expects so the service can come up purely from /etc/cloudflared.
router.post('/create-tunnel', requireAuth, async (req, res) => {
  const { name } = req.body || {};
  const tunnelName = (name || 'cloudpanel-tunnel').replace(/[^a-zA-Z0-9_-]/g, '-');
  const state = await store.get();
  if (!state.cloudflare.apiToken) return res.status(400).json({ message: 'Cloudflare API token is missing.' });
  if (!state.cloudflare.accountId && !MOCK) return res.status(400).json({ message: 'Cloudflare Account ID is missing.' });

  let tunnel;
  if (MOCK) {
    const crypto = require('node:crypto');
    tunnel = { id: crypto.randomUUID(), name: tunnelName, accountTag: state.cloudflare.accountId || 'mock-account', secret: 'mock-secret-base64' };
  } else try {
    tunnel = await cf.createTunnel(state.cloudflare.apiToken, state.cloudflare.accountId, tunnelName);
  } catch (err) {
    const detail = err.response?.data;
    const taken = detail?.errors?.some((e) => /already exists|duplicate/i.test(e.message || ''));
    return res.status(400).json({
      message: taken
        ? `A tunnel named "${tunnelName}" already exists in your Cloudflare account. Try a different name.`
        : 'Cloudflare API rejected the tunnel-create request.',
      detail: detail || err.message,
    });
  }

  // Write the credentials file. cloudflared accepts either { AccountTag, TunnelID,
  // TunnelName, TunnelSecret } (legacy) or just the secret. The legacy form is
  // what `cloudflared tunnel create` produces, so we mimic that for max compat.
  const creds = {
    AccountTag: tunnel.accountTag,
    TunnelID: tunnel.id,
    TunnelName: tunnel.name,
    TunnelSecret: tunnel.secret,
  };
  const credsPath = path.join(CONFIG_DIR, `${tunnel.id}.json`);
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    await fs.writeFile(credsPath, JSON.stringify(creds), { mode: 0o600 });
  } catch (err) {
    return res.status(500).json({
      message: `Tunnel created in Cloudflare, but we couldn't write ${credsPath}. Check that the app user owns /etc/cloudflared.`,
      detail: err.message,
    });
  }

  await store.set('tunnel', { id: tunnel.id, name: tunnel.name });
  res.json({ id: tunnel.id, name: tunnel.name, credentialsFile: credsPath });
});

router.post('/test-target', requireAuth, async (req, res) => {
  const { host, port } = req.body || {};
  if (!host || !port) return res.status(400).json({ message: 'Host and port are required.' });
  const reachable = await new Promise((resolve) => {
    const socket = net.createConnection({ host, port: Number(port), timeout: 3000 }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
  });
  res.json({ reachable });
});

router.post('/complete', requireAuth, async (req, res) => {
  const { target, hostnames = [], createDns = true } = req.body || {};
  const state = await store.get();
  if (!state.tunnel.id) return res.status(400).json({ message: 'Create the tunnel first.' });
  if (!state.cloudflare.apiToken) return res.status(400).json({ message: 'Cloudflare credentials missing.' });

  if (target?.host && target?.port) {
    await store.set('target', { host: target.host, port: Number(target.port) });
  }
  const finalTarget = await store.get('target');

  const credentialsFile = path.join(CONFIG_DIR, `${state.tunnel.id}.json`);
  const ingress = hostnames.map((h) => {
    const rule = {
      hostname: h.hostname,
      service: h.service || `http://${finalTarget.host}:${h.port || finalTarget.port}`,
    };
    if (h.originRequest) rule.originRequest = h.originRequest;
    return rule;
  });
  await cfg.writeConfig({
    tunnel: state.tunnel.id,
    'credentials-file': credentialsFile,
    ingress,
  });

  // If a prior wizard run left a stale cloudflared service unit behind, the
  // next `cloudflared service install` refuses with "service is already
  // installed". Detect via the unit file (world-readable, no sudo needed)
  // and pre-clean so the wizard is self-healing across retries.
  const bin = process.env.CLOUDFLARED_BIN || 'cloudflared';
  const fsSync = require('node:fs');
  const hasStaleService = fsSync.existsSync('/etc/systemd/system/cloudflared.service');
  const stepResults = [];
  if (hasStaleService) {
    const cleanup = [
      { label: 'Stopping previous cloudflared service', cmd: 'sudo -n systemctl stop cloudflared || true' },
      { label: 'Uninstalling previous cloudflared service', cmd: `sudo -n ${bin} service uninstall || true` },
    ];
    for (const step of cleanup) stepResults.push({ ...step, ...(await shell.run(step.cmd)) });
  }

  const steps = [
    { label: 'Installing cloudflared service', cmd: `sudo -n ${bin} service install` },
    { label: 'Enabling cloudflared on boot',   cmd: 'sudo -n systemctl enable cloudflared' },
    { label: 'Starting tunnel',                cmd: 'sudo -n systemctl restart cloudflared' },
  ];
  for (const step of steps) {
    const r = await shell.run(step.cmd);
    stepResults.push({ ...step, ...r });
    if (!r.ok) {
      return res.status(500).json({
        message: `Failed: ${step.label}. ${r.stderr || r.stdout || ''}`.trim(),
        detail: r.stderr || r.stdout,
        steps: stepResults,
      });
    }
  }

  const dnsResults = [];
  if (createDns) {
    for (const h of hostnames) {
      if (MOCK) {
        dnsResults.push({ hostname: h.hostname, ok: true, recordId: 'mock-' + h.hostname });
        continue;
      }
      try {
        const rec = await cf.upsertTunnelDns(state.cloudflare.apiToken, h.hostname, state.tunnel.id, { override: true });
        dnsResults.push({ hostname: h.hostname, ok: true, recordId: rec.id });
      } catch (err) {
        dnsResults.push({ hostname: h.hostname, ok: false, message: err.message });
      }
    }
  }

  res.json({ ok: true, steps: stepResults, dns: dnsResults, hostnames });
});

module.exports = router;
