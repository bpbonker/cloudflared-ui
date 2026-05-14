import { defineConfig, devices } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://10.89.173.101:8088';

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: './report' }]],
  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile',           use: { ...devices['Pixel 7'] } }, // Chromium-based, no WebKit needed
  ],
});
