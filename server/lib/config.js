// Read/write/validate /etc/cloudflared/config.yml.
//
// Invariants:
//   * `tunnel` and `credentials-file` always present once a tunnel is created
//   * `ingress` is always an array
//   * The last ingress entry is always the catch-all `{ service: 'http_status:404' }`
//   * Ingress entries are stored in user order, except the catch-all is
//     re-pinned to the end on every write so a UI bug can't strand it in the
//     middle (where it would shadow later rules).

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const yaml = require('js-yaml');

const CONFIG_DIR = process.env.CLOUDFLARED_CONFIG_DIR || '/etc/cloudflared';
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.yml');

// Fallback location used when MOCK_MODE is on or when /etc/cloudflared isn't
// writable (e.g. running on Windows for UI development).
const FALLBACK_DIR = path.join(__dirname, '..', '..', 'data', 'cloudflared');
const FALLBACK_PATH = path.join(FALLBACK_DIR, 'config.yml');

function effectivePath() {
  if (process.env.MOCK_MODE === 'true') return FALLBACK_PATH;
  try {
    fs.accessSync(CONFIG_DIR, fs.constants.W_OK);
    return CONFIG_PATH;
  } catch {
    return FALLBACK_PATH;
  }
}

const CATCH_ALL = { service: 'http_status:404' };

// Keep only the keys cloudflared understands per ingress entry so we don't
// accidentally serialize internal UI state. Other valid keys exist
// (path, originRequest sub-fields), but for v1 we surface `service`,
// `hostname`, `path` and a curated subset of `originRequest`.
const ALLOWED_ORIGIN_REQUEST_KEYS = new Set([
  'noTLSVerify',
  'originServerName',
  'httpHostHeader',
  'connectTimeout',
  'tlsTimeout',
  'tcpKeepAlive',
  'noHappyEyeballs',
  'keepAliveTimeout',
  'keepAliveConnections',
  'disableChunkedEncoding',
  'proxyType',
  'proxyAddress',
  'proxyPort',
]);

function sanitizeOriginRequest(or) {
  if (!or || typeof or !== 'object') return undefined;
  const out = {};
  for (const k of Object.keys(or)) {
    if (ALLOWED_ORIGIN_REQUEST_KEYS.has(k) && or[k] !== undefined && or[k] !== '') {
      out[k] = or[k];
    }
  }
  return Object.keys(out).length ? out : undefined;
}

function sanitizeRule(rule) {
  if (!rule || typeof rule !== 'object') return null;
  const out = {};
  if (rule.hostname) out.hostname = rule.hostname;
  if (rule.path) out.path = rule.path;
  if (rule.service) out.service = rule.service;
  const or = sanitizeOriginRequest(rule.originRequest);
  if (or) out.originRequest = or;
  return out;
}

function normalizeIngress(rules) {
  const list = Array.isArray(rules) ? rules.map(sanitizeRule).filter(Boolean) : [];
  const named = list.filter((r) => r.hostname);
  return [...named, CATCH_ALL];
}

async function readConfig() {
  const p = effectivePath();
  try {
    const raw = await fsp.readFile(p, 'utf8');
    const parsed = yaml.load(raw) || {};
    parsed.ingress = normalizeIngress(parsed.ingress);
    return parsed;
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { ingress: [CATCH_ALL] };
    }
    throw err;
  }
}

async function writeConfig(cfg) {
  const out = { ...cfg, ingress: normalizeIngress(cfg.ingress) };
  const yamlText = yaml.dump(out, { lineWidth: 120, noRefs: true });
  const p = effectivePath();
  await fsp.mkdir(path.dirname(p), { recursive: true });
  await fsp.writeFile(p, yamlText, 'utf8');
  return out;
}

async function isConfigured() {
  const cfg = await readConfig().catch(() => null);
  return !!(cfg && cfg.tunnel);
}

// Ingress helpers — operate on the named (non-catch-all) entries.
async function listIngress() {
  const cfg = await readConfig();
  return (cfg.ingress || []).filter((r) => r.hostname);
}

async function addIngress(rule) {
  const cfg = await readConfig();
  const named = (cfg.ingress || []).filter((r) => r.hostname);
  if (named.some((r) => r.hostname === rule.hostname)) {
    const err = new Error(`Hostname ${rule.hostname} already exists`);
    err.code = 'EEXIST';
    throw err;
  }
  named.push(rule);
  cfg.ingress = named;
  await writeConfig(cfg);
  return rule;
}

async function updateIngress(hostname, patch) {
  const cfg = await readConfig();
  const named = (cfg.ingress || []).filter((r) => r.hostname);
  const idx = named.findIndex((r) => r.hostname === hostname);
  if (idx === -1) {
    const err = new Error(`Hostname ${hostname} not found`);
    err.code = 'ENOENT';
    throw err;
  }
  // Treat `null` on a top-level key as "remove this key" so the UI can clear
  // originRequest by sending { originRequest: null } on edit.
  const merged = { ...named[idx], ...patch };
  Object.keys(patch || {}).forEach((k) => { if (patch[k] === null) delete merged[k]; });
  named[idx] = merged;
  cfg.ingress = named;
  await writeConfig(cfg);
  return named[idx];
}

async function deleteIngress(hostname) {
  const cfg = await readConfig();
  const named = (cfg.ingress || []).filter((r) => r.hostname);
  const next = named.filter((r) => r.hostname !== hostname);
  if (next.length === named.length) return false;
  cfg.ingress = next;
  await writeConfig(cfg);
  return true;
}

module.exports = {
  effectivePath,
  readConfig,
  writeConfig,
  isConfigured,
  listIngress,
  addIngress,
  updateIngress,
  deleteIngress,
  CATCH_ALL,
};
