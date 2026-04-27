import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for LifeOS
 *
 * Starts the Vite dev server automatically and runs tests in Chromium only
 * to keep browser download size manageable (important on ARM64/Jetson).
 *
 * To run:  npm run test:e2e
 * UI mode: npm run test:e2e:ui
 * Headed:  npm run test:e2e:headed
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});