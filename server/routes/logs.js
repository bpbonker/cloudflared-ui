// /api/logs returns the last N lines via `journalctl -u cloudflared -n N --no-pager`.
// /api/logs/stream opens an SSE channel and pipes journalctl -f line-by-line.
//
// We classify each line client-side based on common cloudflared/journald
// markers (INF/WRN/ERR, level=info/warn/error). The server just streams the
// raw text — keeping the parser in the browser makes the colour scheme
// trivial to tweak without redeploying.

const express = require('express');
const shell = require('../lib/shell');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const n = Math.max(50, Math.min(2000, Number(req.query.n) || 200));
  const { stdout, ok, stderr } = await shell.run(`journalctl -u cloudflared -n ${n} --no-pager`);
  if (!ok) {
    return res.status(500).json({ message: 'Couldn\'t read logs. Does the app user have permission to run journalctl?', detail: stderr });
  }
  res.json({ lines: stdout.split('\n') });
});

// SSE accepts the JWT via `?token=` because EventSource can't set headers.
// We re-verify it here instead of going through requireAuth.
const jwt = require('jsonwebtoken');
router.get('/stream', (req, res) => {
  const token = req.query.token;
  try {
    jwt.verify(token, process.env.JWT_SECRET || 'dev-only-secret-change-me');
  } catch {
    return res.status(401).end();
  }

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  const child = shell.streamCommand('journalctl', ['-u', 'cloudflared', '-f', '-n', '50', '--no-pager']);
  let buffer = '';

  const onData = (chunk) => {
    buffer += chunk.toString();
    let idx;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.trim()) res.write(`data: ${line}\n\n`);
    }
  };
  child.stdout.on('data', onData);
  child.stderr.on('data', onData);

  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    child.kill();
  });
});

module.exports = router;
