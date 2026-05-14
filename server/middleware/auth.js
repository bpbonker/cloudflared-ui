// JWT-based session check. The token is sent as `Authorization: Bearer <t>`
// from the React client; we hand back a 401 with a stable `code` so the UI
// can show the "Your session expired" message without parsing strings.

const jwt = require('jsonwebtoken');

function secret() {
  return process.env.JWT_SECRET || 'dev-only-secret-change-me';
}

function sign(payload, opts = {}) {
  return jwt.sign(payload, secret(), { expiresIn: '7d', ...opts });
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

module.exports = { sign, requireAuth };
