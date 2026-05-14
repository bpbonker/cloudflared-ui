import { test, expect } from '@playwright/test';

// Login is the first user-facing surface — getting this wrong gates everything.
// We verify the standard branding renders, bad credentials produce a toast,
// and good credentials land on either the wizard (fresh setup) or the dashboard.

test.describe('Login', () => {
  test('renders branding and accepts valid credentials', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /Cloudflare Tunnel Manager/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign in/i })).toBeVisible();

    await page.fill('input[autocomplete="username"]', 'admin');
    await page.fill('input[autocomplete="current-password"]', 'changeme');
    await page.getByRole('button', { name: /Sign in/i }).click();

    // After login we should leave /login. Either /setup (first run) or /dashboard.
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 10_000 });
  });

  test('rejects bad credentials with a toast', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[autocomplete="username"]', 'admin');
    await page.fill('input[autocomplete="current-password"]', 'definitely-wrong');
    await page.getByRole('button', { name: /Sign in/i }).click();

    await expect(page.getByText(/Invalid username or password/i)).toBeVisible({ timeout: 10_000 });
  });
});
