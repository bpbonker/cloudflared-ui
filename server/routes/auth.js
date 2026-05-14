const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const store = require('../lib/store');
const audit = require('../lib/audit');
const { sign, requireAuth } = require('../middleware/auth');

const router = express.Router();

// Per-IP login rate limit. Tighter than v1 because the app is now meant to
// be exposed publicly. 5 failed attempts per 5 minutes; on hit, the limiter
// stays in effect for a further 5 minutes. Successful logins don't count
// against the budget so legitimate users typing the wrong password once
// don't get locked out for hours.
const FAIL_LIMIT = Number(process.env.LOGIN_FAIL_LIMIT || 5);
const WINDOW_MS = Number(process.env.LOGIN_WINDOW_MS || 5 * 60 * 1000);

const loginLimiter = process.env.MOCK_MODE === 'true'
  ? (_req, _res, next) => next()
  : rateLimit({
      windowMs: WINDOW_MS,
      max: FAIL_LIMIT,
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: true,
      message: { message: `Too many failed login attempts. Try again in ${Math.round(WINDOW_MS / 60000)} minutes.`, code: 'RATE_LIMITED' },
    });

function clientIp(req) {
  // Behind Cloudflare Tunnel the actual visitor IP is in CF-Connecting-IP
  // (set by Cloudflare). Fall back to req.ip (which respects the trust-proxy
  // setting we configured in server/index.js) for LAN-direct access.
  return req.get('CF-Connecting-IP') || req.ip;
}

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  const ip = clientIp(req);
  const ua = req.get('User-Agent') || '';

  if (!username || !password) {
    audit.record({ event: 'login_attempt', ok: false, reason: 'missing_fields', ip, ua });
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  const envUser = process.env.ADMIN_USERNAME || 'admin';
  if (username !== envUser) {
    audit.record({ event: 'login_attempt', ok: false, reason: 'bad_username', ip, ua, username });
    // Constant-ish response regardless of which field was wrong so an
    // attacker can't enumerate the username.
    return res.status(401).json({ message: 'Invalid username or password.' });
  }

  const auth = await store.get('auth');
  let valid = false;
  let viaDefault = false;
  if (auth.passwordHash) {
    valid = await bcrypt.compare(password, auth.passwordHash);
  } else {
    const envPw = process.env.ADMIN_PASSWORD || 'changeme';
    valid = password === envPw;
    viaDefault = valid;
  }
  if (!valid) {
    audit.record({ event: 'login_attempt', ok: false, reason: 'bad_password', ip, ua, username });
    return res.status(401).json({ message: 'Invalid username or password.' });
  }

  audit.record({ event: 'login_attempt', ok: true, ip, ua, username, viaDefault });
  const token = sign({ sub: username });
  res.json({ token, user: { username }, viaDefault });
});

router.get('/me', requireAuth, async (req, res) => {
  const auth = await store.get('auth');
  res.json({
    user: { username: req.user.sub },
    usingDefaultPassword: !auth.passwordHash,
  });
});

// Return the last N audit log entries. We expose these inside the
// authenticated UI so an operator can spot suspicious traffic without
// needing shell access. The endpoint is rate-limited implicitly via the
// requireAuth middleware (no token = no read).
router.get('/audit', requireAuth, async (req, res) => {
  const n = Math.max(10, Math.min(500, Number(req.query.n) || 100));
  const entries = await audit.tail(n);
  res.json({ entries });
});

module.exports = router;
