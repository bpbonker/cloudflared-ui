import { test, expect } from '@playwright/test';

// Round-trips a backup: configure the app via the wizard, GET /api/backup,
// reset state with the mock-only /_reset endpoint, POST the backup back,
// and confirm the configuration came back intact.

async function login(request) {
  const r = await request.post('/api/auth/login', { data: { username: 'admin', password: 'changeme' } });
  return (await r.json()).token;
}

async function seedConfig(request, token) {
  await request.post('/api/setup/verify-token', {
    headers: { Authorization: `Bearer ${token}` },
    data: { apiToken: 'token', accountId: 'account' },
  });
  await request.post('/api/setup/create-tunnel', {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: 'backup-test-tunnel' },
  });
  await request.post('/api/setup/complete', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      target: { host: 'localhost', port: 80 },
      hostnames: [{
        hostname: 'preserved.example.com',
        service: 'https://localhost:443',
        originRequest: { noTLSVerify: true, originServerName: 'preserved.example.com' },
      }],
      createDns: false,
    },
  });
}

test.beforeEach(async ({ request }) => {
  await request.post('/api/setup/_reset', { headers: { 'X-Cfui-Mock-Reset': 'yes' } });
});

test('backup → reset → restore preserves tunnel id and ingress', async ({ request }) => {
  const token = await login(request);
  await seedConfig(request, token);

  // Pull the backup
  const backupRes = await request.get('/api/backup', { headers: { Authorization: `Bearer ${token}` } });
  expect(backupRes.ok()).toBeTruthy();
  const backup = await backupRes.json();
  expect(backup.meta.kind).toBe('cloudflared-ui-backup');
  expect(backup.meta.tunnelId).toBeTruthy();
  expect(backup.config).toContain('preserved.example.com');

  const originalTunnelId = backup.meta.tunnelId;

  // Wipe everything
  await request.post('/api/setup/_reset', { headers: { 'X-Cfui-Mock-Reset': 'yes' } });
  const statusAfterReset = await request.get('/api/setup/status').then((r) => r.json());
  expect(statusAfterReset.configured).toBe(false);

  // Restore — login again because reset wiped the password hash too if set
  const token2 = await login(request);
  const restoreRes = await request.post('/api/backup', {
    headers: { Authorization: `Bearer ${token2}` },
    data: backup,
  });
  expect(restoreRes.ok()).toBeTruthy();

  // Verify state came back
  const token3 = await login(request);
  const settings = await request.get('/api/settings', { headers: { Authorization: `Bearer ${token3}` } })
    .then((r) => r.json());
  expect(settings.tunnel.id).toBe(originalTunnelId);

  const ingress = await request.get('/api/ingress', { headers: { Authorization: `Bearer ${token3}` } })
    .then((r) => r.json());
  const rule = ingress.rules.find((r) => r.hostname === 'preserved.example.com');
  expect(rule).toBeTruthy();
  expect(rule.service).toBe('https://localhost:443');
  expect(rule.originRequest?.noTLSVerify).toBe(true);
});

test('restore rejects non-backup JSON', async ({ request }) => {
  const token = await login(request);
  const r = await request.post('/api/backup', {
    headers: { Authorization: `Bearer ${token}` },
    data: { hello: 'world' },
  });
  expect(r.status()).toBe(400);
  const j = await r.json();
  expect(j.message).toMatch(/cloudflared-ui-backup/);
});
