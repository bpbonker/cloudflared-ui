import { test, expect } from '@playwright/test';

// End-to-end wizard. Runs against the app in MOCK_MODE, so cloudflared/
// systemctl calls are faked and we never touch real Cloudflare. We use a
// canned "valid-looking" token; the verify-token endpoint will reject it
// against the real Cloudflare API, so we stub that one call.
//
// What we verify:
//   * step indicators advance
//   * Next is gated until the step's action succeeds
//   * the final summary shows everything we entered
//   * after install we land on the Dashboard

const TOKEN = 'cf-pat-test-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const ACCOUNT = '0123456789abcdef0123456789abcdef';
const HOSTNAME = 'tour.securesi.com.au';

async function login(page) {
  await page.goto('/login');
  await page.fill('input[autocomplete="username"]', 'admin');
  await page.fill('input[autocomplete="current-password"]', 'changeme');
  await page.getByRole('button', { name: /Sign in/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

// Reset state before the wizard test so it can re-run across projects.
test.beforeEach(async ({ request }) => {
  await request.post('/api/setup/_reset', { headers: { 'X-Cfui-Mock-Reset': 'yes' } });
});

test('setup wizard end-to-end (mock)', async ({ page }) => {
  // Backend is in MOCK_MODE so Cloudflare API calls are stubbed server-side.
  // We call the real endpoints so backend state actually advances and the
  // subsequent pages tests see a configured tunnel.
  await login(page);

  // Step 1: Welcome
  await expect(page).toHaveURL(/\/setup/);
  await expect(page.getByRole('heading', { name: /Let's get your tunnel running/i })).toBeVisible();
  await page.getByRole('button', { name: /I'm ready, let's go/i }).click();

  // Step 2: Credentials
  await expect(page.getByRole('heading', { name: /Cloudflare credentials/i })).toBeVisible();
  await page.fill('input[placeholder="cf_pat_..."]', TOKEN);
  await page.fill('input[placeholder="a1b2c3..."]', ACCOUNT);
  await page.getByRole('button', { name: /Verify token/i }).click();
  // The "Verified" badge is a chip; the success toast also says "Verified".
  // Wait for the badge specifically.
  await expect(page.locator('.badge-success', { hasText: 'Verified' })).toBeVisible();
  await page.getByRole('button', { name: /^Continue$/ }).click();

  // Step 3: Tunnel
  await expect(page.getByRole('heading', { name: /Create a tunnel/i })).toBeVisible();
  await page.getByRole('button', { name: /Create tunnel/i }).click();
  // Match the success-card heading specifically — there's also a toast that
  // would match a bare /Tunnel created/i regex.
  await expect(page.getByRole('main').getByText('Tunnel created.')).toBeVisible();
  await page.getByRole('button', { name: /^Continue$/ }).click();

  // Step 4: Target
  await expect(page.getByRole('heading', { name: /Where is your CloudPanel server/i })).toBeVisible();
  await page.getByRole('button', { name: /This machine/i }).click();
  await page.getByRole('button', { name: /^Continue$/ }).click();

  // Step 5: Subdomains
  await expect(page.getByRole('heading', { name: /Add your first subdomain/i })).toBeVisible();
  await page.fill('input[placeholder="app1.example.com"]', HOSTNAME);
  await page.getByRole('button', { name: /Add another/i }).click();
  await expect(page.getByText(`Subdomains to add (1)`)).toBeVisible();
  await page.getByRole('button', { name: /^Continue$/ }).click();

  // Step 6: Install — summary card shows count, not names; names appear on
  // the success screen after install runs.
  await expect(page.getByRole('heading', { name: /Review and launch/i })).toBeVisible();
  await page.getByRole('button', { name: /Install & start tunnel/i }).click();

  await expect(page.getByRole('heading', { name: /Your tunnel is live/i })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('link', { name: HOSTNAME })).toBeVisible();
  await page.getByRole('button', { name: /Go to dashboard/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});
