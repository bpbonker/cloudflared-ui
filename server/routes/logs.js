// Log endpoints.
//
// `GET /api/logs` — one-shot read of the last N journalctl lines. Used by
// the Logs page to backfill history before the live stream attaches.
//
// `WS /api/logs/stream` — long-lived WebSocket that streams every new line
// from `journalctl -u cloudflared -f`. WebSocket (instead of SSE) is
// deliberate: it has an RFC-6455 close handshake which cloudflared treats
// as a graceful close. SSE here used to produce one "unexpected EOF" entry
// in the cloudflared log for every Logs-page open/close cycle because the
// TCP socket dropped mid-stream. WebSockets close cleanly.

const express = require('express');
const jwt = require('jsonwebtoken');
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

module.exports = router;

// --- WebSocket handler ---
// The HTTP server in index.js attaches the WebSocket upgrade handler via
// `attachLogStream(server)`. We keep that wiring next to the route module
// so all log-related code lives in one place.
const { WebSocketServer } = require('ws');

function attachLogStream(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, 'http://x');
    if (url.pathname !== '/api/logs/stream') return; // not for us; let other handlers try

    // Authenticate via ?token=... before completing the upgrade. WebSocket
    // browser API can't set custom headers, so we accept the JWT in the
    // query string and verify it here.
    const token = url.searchParams.get('token');
    try {
      jwt.verify(token, process.env.JWT_SECRET || (process.env.MOCK_MODE === 'true' ? 'mock-mode-only-secret' : ''));
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      const child = shell.streamCommand('journalctl', ['-u', 'cloudflared', '-f', '-n', '50', '--no-pager']);
      let buffer = '';

      function onChunk(chunk) {
        if (ws.readyState !== ws.OPEN) return;
        buffer += chunk.toString();
        let i;
        while ((i = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, i);
          buffer = buffer.slice(i + 1);
          if (line.trim()) ws.send(line);
        }
      }
      child.stdout.on('data', onChunk);
      child.stderr.on('data', onChunk);

      // Application-level ping to keep idle proxies from killing the
      // connection (Cloudflare's tunnel times out at ~100s of inactivity).
      const ping = setInterval(() => {
        if (ws.readyState === ws.OPEN) ws.ping();
      }, 30_000);

      const cleanup = () => {
        clearInterval(ping);
        child.kill();
      };
      ws.on('close', cleanup);
      ws.on('error', cleanup);
    });
  });
}

module.exports.attachLogStream = attachLogStream;
