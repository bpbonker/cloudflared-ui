// Tiny JSON file store for app-managed state:
//   * the hashed admin password (after the user changes it from the .env default)
//   * Cloudflare credentials (token + account id) entered via the wizard
//   * the user's chosen target host/port for "where is your CloudPanel server"
//   * the tunnel id and name we created on their behalf
//
// We don't pretend this is a database. It's a single file under ./data so
// the app stays self-contained and easy to back up.

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const FILE = path.join(DATA_DIR, 'state.json');

const defaults = {
  cloudflare: { apiToken: '', accountId: '' },
  target: { host: 'localhost', port: 80 },
  tunnel: { id: '', name: '' },
  auth: { passwordHash: '' },
};

let cache = null;

async function load() {
  if (cache) return cache;
  try {
    const raw = await fsp.readFile(FILE, 'utf8');
    cache = { ...defaults, ...JSON.parse(raw) };
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    cache = structuredClone(defaults);
  }
  return cache;
}

async function save() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.writeFile(FILE, JSON.stringify(cache, null, 2), 'utf8');
}

async function get(section) {
  const s = await load();
  return section ? s[section] : s;
}

async function set(section, patch) {
  const s = await load();
  s[section] = { ...s[section], ...patch };
  await save();
  return s[section];
}

function loadSync() {
  if (cache) return cache;
  try {
    cache = { ...defaults, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) };
  } catch {
    cache = structuredClone(defaults);
  }
  return cache;
}

// Drop the in-memory cache. Used by the restore route after writing a new
// state.json directly to disk so the next read picks up the fresh blob.
function invalidate() {
  cache = null;
}

module.exports = { load, save, get, set, loadSync, invalidate };
