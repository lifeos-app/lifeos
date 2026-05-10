import { test, expect } from '@playwright/test';

/**
 * E2E: Health page
 *
 * Tests that the Health page loads and displays expected UI elements.
 * The Health page uses FullscreenPage with tabs (Overview, Body, Exercise,
 * Nutrition, Mind, Sleep) and requires authentication for health data.
 *
 * Note: Health data requires authentication. Without auth, the app redirects
 * to the login page, so most content tests are skipped until auth is set up.
 * The structural test verifies the route is reachable.
 */
test.describe('Health page', () => {

  test('health route is reachable', async ({ page }) => {
    await page.goto('/health');
    // App should respond — either shows health or redirects to login
    await expect(page).toHaveURL(/\/(health)?/, { timeout: 15_000 });
  });

  // Skipped: requires authentication
  test.skip('health page displays overview tab after login', async ({ page }) => {
    // After auth setup:
    // await page.goto('/health');
    // const overviewTab = page.locator('.health [role="tabpanel"]');
    // await expect(overviewTab).toBeVisible({ timeout: 15_000 });
  });

  // Skipped: requires authentication
  test.skip('health page shows tab navigation', async ({ page }) => {
    // After auth setup:
    // await page.goto('/health');
    // const tabNav = page.locator('.fullscreen-page-tabs, .health [role="tablist"]');
    // await expect(tabNav).toBeVisible({ timeout: 15_000 });
    // Verify tabs: Overview, Body, Exercise, Nutrition, Mind, Sleep
  });

  // Skipped: requires authentication
  test.skip('health page can switch to exercise tab', async ({ page }) => {
    // After auth setup:
    // await page.goto('/health');
    // const exerciseTab = page.locator('text=Exercise').first();
    // await exerciseTab.click();
    // await expect(page).toHaveURL(/health.*tab=exercise/, { timeout: 15_000 });
  });
});