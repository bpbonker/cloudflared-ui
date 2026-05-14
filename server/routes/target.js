// Standalone route so the spec'd /api/target/test endpoint isn't a sub-path
// of /api/dns. Quick TCP connect — cheap and protocol-agnostic.

const express = require('express');
const net = require('node:net');
const store = require('../lib/store');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/test', async (req, res) => {
  const target = await store.get('target');
  const host = req.query.host || target.host;
  const port = Number(req.query.port || target.port);
  const reachable = await new Promise((resolve) => {
    const socket = net.createConnection({ host, port, timeout: 3000 }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
  });
  res.json({ reachable, host, port });
});

module.exports = router;
