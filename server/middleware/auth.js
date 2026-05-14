// JWT-based session check. The token is sent as `Authorization: Bearer <t>`
// from the React client; we hand back a 401 with a stable `code` so the UI
// can show the "Your session expired" message without parsing strings.
//
// The token TTL is 24 hours by default — long enough that a normal user
// isn't constantly re-signing in, short enough that a stolen token has a
// shelf life. Set JWT_TTL in .env to tune.

const jwt = require('jsonwebtoken');

// Validated once at module load — fail loudly rather than silently fall
// back to a known dev secret in production (a server with a default
// signing key is forgeable by anyone who knows the default).
const JWT_SECRET = (() => {
  const s = process.env.JWT_SECRET;
  if (!s || s === 'replace-me-with-a-long-random-string') {
    if (process.env.MOCK_MODE === 'true') return 'mock-mode-only-secret';
    console.error('FATAL: JWT_SECRET is not set in .env. Generate one with `openssl rand -hex 32` and restart.');
    process.exit(1);
  }
  return s;
})();
function secret() { return JWT_SECRET; }

const TTL = process.env.JWT_TTL || '24h';

function sign(payload, opts = {}) {
  return jwt.sign(payload, secret(), { expiresIn: TTL, ...opts });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [, token] = header.split(' ');
  if (!token) return res.status(401).json({ message: 'Not signed in', code: 'NO_TOKEN' });
  try {
    req.user = jwt.verify(token, secret());
    next();
  } catch {
    res.status(401).json({ message: 'Your session expired. Please sign in again.', code: 'BAD_TOKEN' });
  }
}

// Most write endpoints are blocked while the user is still on the .env
// default password — exposing a public admin UI with a guessable password
// is exactly the trap we want to avoid. Reads stay allowed so the user
// can navigate to Settings to change it.
const store = require('../lib/store');
async function refuseWritesIfDefaultPassword(req, res, next) {
  if (req.method === 'GET') return next();
  // Mock mode is the test harness; the block is a production guard, not a
  // correctness check, so we don't apply it there.
  if (process.env.MOCK_MODE === 'true') return next();
  // Use originalUrl because this middleware is mounted at /api and req.path
  // would have that prefix stripped.
  const url = req.originalUrl.split('?')[0];
  if (url === '/api/settings/password') return next();
  if (url.startsWith('/api/auth/')) return next();
  const auth = await store.get('auth');
  if (!auth.passwordHash) {
    return res.status(423).json({
      message: 'This server is still using the default password from .env. Change it in Settings → Admin password before making other changes.',
      code: 'DEFAULT_PASSWORD',
    });
  }
  next();
}

module.exports = { sign, requireAuth, refuseWritesIfDefaultPassword };
