// /api/service/uninstall — separate from settings so the URL matches the spec
// without nesting routers under awkward mounts.

const express = require('express');
const shell = require('../lib/shell');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.post('/uninstall', async (_req, res) => {
  const bin = process.env.CLOUDFLARED_BIN || 'cloudflared';
  const steps = [
    'sudo -n systemctl stop cloudflared',
    'sudo -n systemctl disable cloudflared',
    `sudo -n ${bin} service uninstall`,
  ];
  const results = [];
  for (const cmd of steps) {
    results.push({ cmd, ...(await shell.run(cmd)) });
  }
  res.json({ ok: results.every((r) => r.ok), steps: results });
});

module.exports = router;
