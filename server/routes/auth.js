const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const store = require('../lib/store');
const { sign, requireAuth } = require('../middleware/auth');

const router = express.Router();

// Mock mode disables the limiter so the e2e suite isn't throttled by its
// own login loop.
const loginLimiter = process.env.MOCK_MODE === 'true'
  ? (_req, _res, next) => next()
  : rateLimit({
      windowMs: 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: 'Too many login attempts. Try again in a minute.' },
    });

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  const envUser = process.env.ADMIN_USERNAME || 'admin';
  if (username !== envUser) {
    return res.status(401).json({ message: 'Invalid username or password.' });
  }

  // Prefer the stored hash if the user has changed their password; fall back
  // to the .env plaintext on first run. This lets the user log in immediately
  // after installation without us shipping a hash in .env.example.
  const auth = await store.get('auth');
  let valid = false;
  if (auth.passwordHash) {
    valid = await bcrypt.compare(password, auth.passwordHash);
  } else {
    const envPw = process.env.ADMIN_PASSWORD || 'changeme';
    valid = password === envPw;
  }
  if (!valid) return res.status(401).json({ message: 'Invalid username or password.' });

  const token = sign({ sub: username });
  res.json({ token, user: { username } });
});

router.get('/me', requireAuth, async (req, res) => {
  const auth = await store.get('auth');
  // Tell the client whether the user is still on the .env default password so
  // we can nag them to change it. We check by comparing the env value rather
  // than storing a flag — that way "default" is self-correcting if the user
  // edits .env later.
  const usingDefaultPassword = !auth.passwordHash;
  res.json({ user: { username: req.user.sub }, usingDefaultPassword });
});

module.exports = router;
