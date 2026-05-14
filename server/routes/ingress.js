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

  // Preflight Cloudflare prerequisites *before* writing anything to disk.
  // The previous order wrote the ingress rule first and then silently
  // skipped DNS if the token was missing — leaving the user with a rule
  // that pointed at a hostname Cloudflare wouldn't route to.
  if (createDns && !MOCK) {
    const state = await store.get();
    if (!state.cloudflare.apiToken) {
      return res.status(412).json({
        message: 'Cloudflare API token isn\'t set. Go to Settings → Cloudflare credentials and paste it, then add the subdomain again. No ingress rule was saved.',
        code: 'NO_CF_TOKEN',
      });
    }
    if (!state.tunnel.id) {
      return res.status(412).json({
        message: 'No tunnel id stored in app state. Re-run the wizard or restore from a backup. No ingress rule was saved.',
        code: 'NO_TUNNEL',
      });
    }
  }

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
    } else if (!state.cloudflare.apiToken) {
      // The previous behaviour was to silently skip DNS creation if the
      // token was missing — that left the user with a half-configured
      // subdomain (ingress rule but no CNAME). Fail loudly instead so
      // the UI surfaces it.
      return res.status(412).json({
        message: 'Cloudflare API token isn\'t set. Go to Settings → Cloudflare credentials and paste it, then add the subdomain again. The ingress rule has NOT been saved yet.',
        code: 'NO_CF_TOKEN',
      });
    } else if (!state.tunnel.id) {
      return res.status(412).json({
        message: 'No tunnel id stored in app state. The wizard needs to be re-run, or restore from a backup.',
        code: 'NO_TUNNEL',
      });
    } else {
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
  const { service, originRequest, ensureDns = true, override = true } = req.body || {};
  const e = validateService(service);
  if (e) return res.status(400).json({ message: e });

  const patch = { service };
  // Edit form sends originRequest=null to clear it.
  if (originRequest !== undefined) patch.originRequest = originRequest;

  let updated;
  try {
    updated = await cfg.updateIngress(hostname, patch);
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ message: err.message });
    throw err;
  }

  // After updating the ingress rule, make sure the matching Cloudflare DNS
  // record exists. The original behaviour was to only touch DNS on POST,
  // which meant a subdomain added before the token was set stayed broken
  // forever — editing didn't help. We now upsert on every edit when the
  // token is present.
  let dns = null;
  if (ensureDns && !MOCK) {
    const state = await store.get();
    if (state.cloudflare.apiToken && state.tunnel.id) {
      try {
        const rec = await cf.upsertTunnelDns(state.cloudflare.apiToken, hostname, state.tunnel.id, { override });
        dns = { ok: true, recordId: rec.id };
      } catch (err) {
        dns = { ok: false, message: err.message, code: err.code };
      }
    } else {
      dns = { ok: false, message: 'No Cloudflare token saved — DNS not synced.', code: 'NO_CF_TOKEN' };
    }
  }

  await restartTunnel();
  res.json({ ok: true, rule: updated, dns });
});

router.delete('/:hostname', async (req, res) => {
  const removed = await cfg.deleteIngress(req.params.hostname);
  if (!removed) return res.status(404).json({ message: 'No such hostname.' });
  await restartTunnel();
  res.json({ ok: true });
});

module.exports = router;
