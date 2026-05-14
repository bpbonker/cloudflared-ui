// System-level health check: is cloudflared installed at all? Used on the
// Dashboard so we can show an install banner before the user starts
// scratching their head about a tunnel that can't possibly start.

const express = require('express');
const shell = require('../lib/shell');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/health', async (_req, res) => {
  const bin = process.env.CLOUDFLARED_BIN || 'cloudflared';
  const v = await shell.run(`${bin} --version`);
  const installed = v.ok;
  const versionLine = (v.stdout || '').split('\n')[0] || '';

  const s = await shell.run('systemctl status cloudflared --no-pager');
  const serviceKnown = s.stdout?.includes('cloudflared.service') || s.stderr?.includes('cloudflared.service');

  res.json({
    cloudflared: { installed, version: versionLine },
    service: { installed: !!serviceKnown },
    installHint: 'curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb && sudo dpkg -i cloudflared.deb',
  });
});

module.exports = router;
