const express = require('express');
const cf = require('../lib/cloudflare-api');
const store = require('../lib/store');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const MOCK = process.env.MOCK_MODE === 'true';

router.post('/route', async (req, res) => {
  const { hostname, override = true } = req.body || {};
  const state = await store.get();
  if (!state.cloudflare.apiToken) return res.status(400).json({ message: 'Cloudflare token not set.' });
  if (!state.tunnel.id) return res.status(400).json({ message: 'No tunnel configured.' });
  try {
    const rec = await cf.upsertTunnelDns(state.cloudflare.apiToken, hostname, state.tunnel.id, { override });
    res.json({ ok: true, record: rec });
  } catch (err) {
    if (err.code === 'EEXIST') {
      return res.status(409).json({ message: err.message, existing: err.existing });
    }
    res.status(500).json({ message: err.message });
  }
});

router.get('/verify/:hostname', async (req, res) => {
  if (MOCK) return res.json({ exists: true, record: { id: 'mock', name: req.params.hostname } });
  const state = await store.get('cloudflare');
  if (!state.apiToken) return res.status(400).json({ message: 'Cloudflare token not set.' });
  try {
    const result = await cf.verifyHostnameDns(state.apiToken, req.params.hostname);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
