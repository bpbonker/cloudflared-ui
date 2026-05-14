// Append-only login audit log. One JSON object per line under data/auth-log.jsonl.
// We log every login attempt (success and failure) so a panicked operator
// can grep for suspicious activity. Rotation is up to the operator.

const fs = require('node:fs/promises');
const path = require('node:path');

const LOG_FILE = path.join(__dirname, '..', '..', 'data', 'auth-log.jsonl');

async function record(event) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...event }) + '\n';
  try {
    await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
    await fs.appendFile(LOG_FILE, line, 'utf8');
  } catch (err) {
    // Don't let logging failures break the auth flow.
    console.error('[audit] failed to write entry:', err.message);
  }
}

async function tail(n = 50) {
  try {
    const raw = await fs.readFile(LOG_FILE, 'utf8');
    return raw.trim().split('\n').slice(-n).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

module.exports = { record, tail };
