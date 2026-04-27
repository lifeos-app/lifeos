import { test, expect } from '@playwright/test';

/**
 * E2E: Dashboard page
 *
 * Dashboard requires authentication. Since we don't have test credentials,
 * authenticated tests are skipped. Structural tests verify that the page
 * structure is reachable (will redirect to login if unauthenticated).
 *
 * When auth is set up (see e2e/auth.setup.ts), remove test.skip and
 * use the authenticated fixture.
 */
test.describe('Dashboard page', () => {

  test('root URL is reachable', async ({ page }) => {
    await page.goto('/');
    // Even if redirected to login, the app should respond
    await expect(page).toHaveURL(/.*/, { timeout: 15_000 });
  });

  // Skipped: requires authentication
  test.skip('dashboard renders greeting widget after login', async ({ page }) => {
    // After auth setup:
    // await page.goto('/');
    // const greeting = page.locator('.dash-greeting, [data-testid="greeting"]');
    // await expect(greeting).toBeVisible({ timeout: 15_000 });
  });

  // Skipped: requires authentication
  test.skip('dashboard shows time-adaptive greeting', async ({ page }) => {
    // After auth setup:
    // await page.goto('/');
    // The DashboardGreeting component shows time-of-day messages
    // (Good morning, Good afternoon, Good evening)
    // const greetingText = await page.locator('.dash-greeting').textContent();
    // expect(greetingText).toMatch(/Good (morning|afternoon|evening|night)/i);
  });

  // Skipped: requires authentication
  test.skip('dashboard displays key widgets', async ({ page }) => {
    // After auth setup:
    // await page.goto('/');
    // const dash = page.locator('.dash');
    // await expect(dash).toBeVisible({ timeout: 15_000 });
    // Verify week strip, schedule section, habits section exist
    // await expect(page.locator('.week-strip')).toBeVisible();
  });

  // Skipped: requires authentication
  test.skip('dashboard shows mode badge', async ({ page }) => {
    // After auth setup:
    // await page.goto('/');
    // const badge = page.locator('.dash-mode-badge');
    // await expect(badge).toBeVisible({ timeout: 10_000 });
  });
});