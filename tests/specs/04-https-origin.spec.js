import { test, expect } from '@playwright/test';

// Verifies the "Origin uses HTTPS" toggle round-trips through the API:
//   * preview shows originRequest fields when enabled
//   * submitted rule is stored with noTLSVerify + originServerName set to the hostname
//   * edit form pre-fills the toggle ON for an existing https-origin rule

async function login(page) {
  await page.goto('/login');
  await page.fill('input[autocomplete="username"]', 'admin');
  await page.fill('input[autocomplete="current-password"]', 'changeme');
  await page.getByRole('button', { name: /Sign in/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

test.beforeEach(async ({ request }) => {
  await request.post('/api/setup/_reset');
});

test('HTTPS-origin toggle round-trips through the API', async ({ page, request }) => {
  // Reuse the wizard to get the app configured.
  await login(page);
  await page.getByRole('button', { name: /I'm ready, let's go/i }).click();
  await page.fill('input[placeholder="cf_pat_..."]', 'token');
  await page.fill('input[placeholder="a1b2c3..."]', 'account');
  await page.getByRole('button', { name: /Verify token/i }).click();
  await expect(page.locator('.badge-success', { hasText: 'Verified' })).toBeVisible();
  await page.getByRole('button', { name: /^Continue$/ }).click();
  await page.getByRole('button', { name: /Create tunnel/i }).click();
  await expect(page.getByRole('main').getByText('Tunnel created.')).toBeVisible();
  await page.getByRole('button', { name: /^Continue$/ }).click();
  await page.getByRole('button', { name: /This machine/i }).click();
  await page.getByRole('button', { name: /^Continue$/ }).click();
  await page.fill('input[placeholder="app1.example.com"]', 'tour.securesi.com.au');
  // Toggle HTTPS origin on in the wizard
  await page.getByText(/Origin uses HTTPS/).click();
  await expect(page.getByText('noTLSVerify:')).toBeVisible();
  await page.getByRole('button', { name: /Add another/i }).click();
  await page.getByRole('button', { name: /^Continue$/ }).click();
  await page.getByRole('button', { name: /Install & start tunnel/i }).click();
  await expect(page.getByRole('heading', { name: /Your tunnel is live/i })).toBeVisible({ timeout: 20_000 });

  // Verify via the API that the rule was saved with the right shape.
  const token = await request.post('/api/auth/login', {
    data: { username: 'admin', password: 'changeme' },
  }).then((r) => r.json()).then((j) => j.token);
  const ing = await request.get('/api/ingress', { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.json());
  const rule = ing.rules.find((r) => r.hostname === 'tour.securesi.com.au');
  expect(rule).toBeTruthy();
  expect(rule.service).toMatch(/^https:\/\//);
  expect(rule.originRequest?.noTLSVerify).toBe(true);
  expect(rule.originRequest?.originServerName).toBe('tour.securesi.com.au');
});

test('edit modal pre-fills HTTPS-origin toggle from existing rule', async ({ page, request }) => {
  // Seed via the API directly so we don't have to re-drive the wizard.
  const token = await request.post('/api/auth/login', {
    data: { username: 'admin', password: 'changeme' },
  }).then((r) => r.json()).then((j) => j.token);

  // Need a tunnel id so status renders. Quick wizard pass — minimal.
  await request.post('/api/setup/verify-token', {
    headers: { Authorization: `Bearer ${token}` },
    data: { apiToken: 'token', accountId: 'account' },
  });
  await request.post('/api/setup/create-tunnel', {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: 'test-tunnel' },
  });
  await request.post('/api/setup/complete', {
    headers: { Authorization: `Bearer ${token}` },
    data: { target: { host: 'localhost', port: 80 }, hostnames: [], createDns: false },
  });
  await request.post('/api/ingress', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      hostname: 'edit.example.com',
      service: 'https://localhost:443',
      originRequest: { noTLSVerify: true, originServerName: 'edit.example.com' },
      createDns: false,
    },
  });

  await login(page);
  await page.goto('/subdomains');
  await page.getByRole('button', { name: /Edit/i }).first().click();
  const toggle = page.getByRole('checkbox', { name: /Origin uses HTTPS/i });
  await expect(toggle).toBeChecked();
});
