// Single entry point. In dev, Vite proxies /api here. In production we
// also serve the built React bundle from this same process so the user has
// one port to think about.

require('dotenv').config();

const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

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

const port = process.env.PORT || 8088;
app.listen(port, () => {
  console.log(`cloudflared-ui listening on http://0.0.0.0:${port}`);
  if (process.env.MOCK_MODE === 'true') console.log('[mock mode] shell calls are faked');
});
