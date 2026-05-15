// Single entry point. In dev, Vite proxies /api here. In production we
// also serve the built React bundle from this same process so the user has
// one port to think about.

require('dotenv').config();

const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

// When the app is fronted by Cloudflare Tunnel, every request arrives from
// 127.0.0.1 over the tunnel. To get the real visitor IP (for rate limiting
// and the audit log) we trust the proxy and Express will read it from
// X-Forwarded-For. Trusting "loopback" specifically avoids accepting forged
// headers from a non-localhost connection.
app.set('trust proxy', 'loopback');

// CORS. Wide-open `cors()` is fine on a LAN-only deployment but dangerous
// once the app is exposed via a public tunnel — other origins could call
// the API from any user's browser. We default to same-origin only (no
// Access-Control-Allow-Origin header) and let the operator add origins via
// CORS_ORIGINS=https://a.example.com,https://b.example.com if they truly
// need it.
const corsOrigins = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
if (corsOrigins.length) {
  app.use(cors({ origin: corsOrigins, credentials: false }));
} else if (process.env.MOCK_MODE === 'true') {
  // Mock mode is for the test harness; allow all so Playwright can hit it.
  app.use(cors());
}

// Helmet adds a bunch of defensive headers (X-Content-Type-Options, X-Frame-
// Options=DENY, Referrer-Policy, etc.). We disable CSP because the React
// bundle uses inline event handlers from React itself and rolling a strict
// CSP would break it without nonces — out of scope for v1.
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

app.use(express.json({ limit: '1mb' }));

// While the admin password is still the .env default, block any write
// endpoint except the one used to change the password. Reads still work so
// the UI can render Settings and the banner.
const { refuseWritesIfDefaultPassword } = require('./middleware/auth');
app.use('/api', refuseWritesIfDefaultPassword);

app.use('/api/auth',     require('./routes/auth'));
app.use('/api/setup',    require('./routes/setup'));
app.use('/api/tunnel',   require('./routes/tunnel'));
app.use('/api/ingress',  require('./routes/ingress'));
app.use('/api/dns',      require('./routes/dns'));
app.use('/api/target',   require('./routes/target'));
app.use('/api/logs',     require('./routes/logs'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/service',  require('./routes/service'));
app.use('/api/system',   require('./routes/system'));
app.use('/api/backup',   require('./routes/backup'));

app.use((err, req, res, _next) => {
  console.error('[api error]', req.method, req.url, err);
  if (res.headersSent) return;
  res.status(500).json({ message: err.userMessage || 'Something went wrong on the server.', code: err.code });
});

// Serve built client in production.
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// We build the HTTP server explicitly (rather than letting express.listen()
// create one) so we can attach the WebSocket upgrade handler used by the
// Logs page live stream.
const http = require('node:http');
const server = http.createServer(app);

const { attachLogStream } = require('./routes/logs');
attachLogStream(server);

const port = process.env.PORT || 8088;
server.listen(port, () => {
  console.log(`cloudflared-ui listening on http://0.0.0.0:${port}`);
  if (process.env.MOCK_MODE === 'true') console.log('[mock mode] shell calls are faked');
});
