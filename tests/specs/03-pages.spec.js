import { test, expect } from '@playwright/test';

// After setup, the user lives in 4 pages: Dashboard, Subdomains, Logs, Settings.
// We hit each one and verify the key element appears so a regression in any
// route or nav fails noisily.

async function login(page) {
  await page.goto('/login');
  await page.fill('input[autocomplete="username"]', 'admin');
  await page.fill('input[autocomplete="current-password"]', 'changeme');
  await page.getByRole('button', { name: /Sign in/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

test.describe('Authenticated pages', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('dashboard renders status card and counters', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('button', { name: /Restart/i })).toBeVisible({ timeout: 10_000 });
    // Scope to <main> to avoid matching the sidebar nav link which has the
    // same text on desktop.
    await expect(page.getByRole('main').getByText('Subdomains').first()).toBeVisible();
    await expect(page.getByRole('main').getByText('Uptime')).toBeVisible();
  });

  test('subdomains page renders nav and add button', async ({ page }) => {
    await page.goto('/subdomains');
    await expect(page.getByRole('heading', { name: 'Subdomains' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /Add subdomain/i }).first()).toBeVisible();
  });

  test('logs page mounts log viewer', async ({ page }) => {
    await page.goto('/logs');
    await expect(page.getByRole('heading', { name: 'Logs' })).toBeVisible();
    await expect(page.getByPlaceholder(/Filter log lines/i)).toBeVisible();
  });

  test('settings page shows all sections', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /CloudPanel target/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Cloudflare credentials/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Admin password/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Danger zone/i })).toBeVisible();
  });

  test('add-subdomain modal opens and closes', async ({ page }) => {
    await page.goto('/subdomains');
    await page.getByRole('button', { name: /Add subdomain/i }).first().click();
    await expect(page.getByRole('heading', { name: /Add subdomain/i })).toBeVisible();
    await page.getByRole('button', { name: /Cancel/i }).click();
    await expect(page.getByRole('heading', { name: /Add subdomain/i })).not.toBeVisible();
  });
});
