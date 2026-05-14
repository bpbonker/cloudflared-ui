// CRUD on ingress rules. Each successful write triggers a tunnel restart so
// the new rules are live before the response returns — that's the whole
// promise of the app: edit in UI, see it work, no terminal.

const express = require('express');
const cfg = require('../lib/config');
const cf = require('../lib/cloudflare-api');
const shell = require('../lib/shell');
const store = require('../lib/store');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const MOCK = process.env.MOCK_MODE === 'true';

async function restartTunnel() {
  return shell.run('sudo -n systemctl restart cloudflared');
}

function validateHostname(h) {
  if (!h || typeof h !== 'string') return 'Hostname is required.';
  if (h.length > 253) return 'Hostname is too long.';
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(h)) {
    return 'That doesn\'t look like a valid hostname. Use something like app1.example.com.';
  }
  return null;
}

function validateService(s) {
  if (!s) return 'Target URL is required.';
  if (!/^https?:\/\//.test(s) && !/^tcp:\/\//.test(s) && !s.startsWith('http_status:')) {
    return 'Target should start with http:// or https://.';
  }
  return null;
}

router.get('/', async (_req, res) => {
  const rules = await cfg.listIngress();
  res.json({ rules });
});

router.post('/', async (req, res) => {
  const { hostname, service, originRequest, createDns = true, override = false } = req.body || {};
  const e1 = validateHostname(hostname);
  const e2 = validateService(service);
  if (e1 || e2) return res.status(400).json({ message: e1 || e2 });

  try {
    await cfg.addIngress({ hostname, service, originRequest });
  } catch (err) {
    if (err.code === 'EEXIST') return res.status(409).json({ message: err.message });
    throw err;
  }

  let dns = null;
  if (createDns) {
    const state = await store.get();
    if (MOCK) {
      dns = { ok: true, recordId: 'mock-' + hostname };
    } else if (state.cloudflare.apiToken && state.tunnel.id) {
      try {
        const rec = await cf.upsertTunnelDns(state.cloudflare.apiToken, hostname, state.tunnel.id, { override });
        dns = { ok: true, recordId: rec.id };
      } catch (err) {
        dns = { ok: false, message: err.message, code: err.code };
        if (err.code === 'EEXIST' && !override) {
          return res.status(409).json({
            message: `A DNS record for ${hostname} already exists in Cloudflare. Toggle "override" if you want to replace it.`,
            ingressSaved: true,
          });
        }
      }
    }
  }

  await restartTunnel();
  res.json({ ok: true, rule: { hostname, service }, dns });
});

router.put('/:hostname', async (req, res) => {
  const { hostname } = req.params;
  const { service, originRequest } = req.body || {};
  const e = validateService(service);
  if (e) return res.status(400).json({ message: e });

  const patch = { service };
  // Edit form sends originRequest=null to clear it.
  if (originRequest !== undefined) patch.originRequest = originRequest;

  try {
    const updated = await cfg.updateIngress(hostname, patch);
    await restartTunnel();
    res.json({ ok: true, rule: updated });
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ message: err.message });
    throw err;
  }
});

router.delete('/:hostname', async (req, res) => {
  const removed = await cfg.deleteIngress(req.params.hostname);
  if (!removed) return res.status(404).json({ message: 'No such hostname.' });
  await restartTunnel();
  res.json({ ok: true });
});

module.exports = router;
