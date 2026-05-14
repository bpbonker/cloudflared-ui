// Thin wrapper around the Cloudflare REST API. The wizard uses this for:
//   * verifying that the user's API token actually works
//   * resolving the zone ID for a hostname (so we can write DNS records)
//   * creating the proxied CNAME that points <subdomain> -> <tunnel>.cfargotunnel.com
//
// We deliberately keep the surface tiny — anything fancier (e.g. tunnel
// creation via API) is delegated to the cloudflared CLI so the user's
// credentials file ends up in /etc/cloudflared with the expected name.

const axios = require('axios');

const BASE = 'https://api.cloudflare.com/client/v4';

function client(token) {
  return axios.create({
    baseURL: BASE,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    timeout: 15000,
  });
}

async function verifyToken(token) {
  const cf = client(token);
  const { data } = await cf.get('/user/tokens/verify');
  if (!data.success) throw new Error('Token verification failed');
  return data.result; // { id, status, ... }
}

async function listZones(token) {
  const cf = client(token);
  const { data } = await cf.get('/zones', { params: { per_page: 50 } });
  return data.result || [];
}

// Finds the zone that owns a given hostname by matching the longest zone
// name that is a suffix of the hostname. e.g. "app1.example.com" -> the
// zone "example.com".
async function findZoneForHostname(token, hostname) {
  const zones = await listZones(token);
  const match = zones
    .filter((z) => hostname === z.name || hostname.endsWith(`.${z.name}`))
    .sort((a, b) => b.name.length - a.name.length)[0];
  if (!match) {
    const err = new Error(`No Cloudflare zone in this account matches ${hostname}`);
    err.code = 'NO_ZONE';
    throw err;
  }
  return match;
}

async function findDnsRecord(token, zoneId, hostname) {
  const cf = client(token);
  const { data } = await cf.get(`/zones/${zoneId}/dns_records`, {
    params: { name: hostname, per_page: 5 },
  });
  return (data.result || [])[0] || null;
}

// Creates (or updates if present) a proxied CNAME for `hostname` pointing
// at `<tunnelId>.cfargotunnel.com`. Returns the record.
async function upsertTunnelDns(token, hostname, tunnelId, { override = true } = {}) {
  const zone = await findZoneForHostname(token, hostname);
  const cf = client(token);
  const target = `${tunnelId}.cfargotunnel.com`;
  const existing = await findDnsRecord(token, zone.id, hostname);
  const payload = { type: 'CNAME', name: hostname, content: target, proxied: true, ttl: 1 };
  if (existing) {
    if (!override) {
      const err = new Error(`DNS record for ${hostname} already exists`);
      err.code = 'EEXIST';
      err.existing = existing;
      throw err;
    }
    const { data } = await cf.put(`/zones/${zone.id}/dns_records/${existing.id}`, payload);
    return data.result;
  }
  const { data } = await cf.post(`/zones/${zone.id}/dns_records`, payload);
  return data.result;
}

async function verifyHostnameDns(token, hostname) {
  try {
    const zone = await findZoneForHostname(token, hostname);
    const record = await findDnsRecord(token, zone.id, hostname);
    return { exists: !!record, record };
  } catch (err) {
    if (err.code === 'NO_ZONE') return { exists: false, error: err.message };
    throw err;
  }
}

// Create a tunnel via the Cloudflare REST API. We generate the secret
// ourselves and POST it so we never need an interactive `cloudflared login`
// step — the whole wizard works with just an API token.
//
// Returns { id, name, secret } where secret is the same base64 string we
// sent. The caller writes a credentials JSON file in /etc/cloudflared
// derived from these so the cloudflared service can pick it up via
// config.yml's `credentials-file`.
async function createTunnel(token, accountId, name) {
  const crypto = require('node:crypto');
  const secret = crypto.randomBytes(32).toString('base64');
  const cf = client(token);
  const { data } = await cf.post(`/accounts/${accountId}/cfd_tunnel`, {
    name,
    tunnel_secret: secret,
    config_src: 'local',
  });
  return { id: data.result.id, name: data.result.name, accountTag: accountId, secret };
}

async function deleteTunnel(token, accountId, tunnelId) {
  const cf = client(token);
  // First clean up any connections so the delete doesn't 400.
  try { await cf.delete(`/accounts/${accountId}/cfd_tunnel/${tunnelId}/connections`); } catch {}
  const { data } = await cf.delete(`/accounts/${accountId}/cfd_tunnel/${tunnelId}`);
  return data.result;
}

module.exports = {
  verifyToken,
  listZones,
  findZoneForHostname,
  findDnsRecord,
  upsertTunnelDns,
  verifyHostnameDns,
  createTunnel,
  deleteTunnel,
};
