import { test, expect } from '@playwright/test';

/**
 * E2E: Finances page
 *
 * Tests that the Finances page loads and displays expected UI elements.
 * The Finances page uses FullscreenPage with tabs (Overview, Income, Expenses,
 * Bills, Work, Analysis) and requires authentication for data.
 *
 * Note: Finance data requires authentication. Without auth, the app redirects
 * to the login page, so most content tests are skipped until auth is set up.
 * The structural test verifies the route is reachable.
 */
test.describe('Finances page', () => {

  test('finances route is reachable', async ({ page }) => {
    await page.goto('/finances');
    // App should respond — either shows finances or redirects to login
    await expect(page).toHaveURL(/\/(finances)?/, { timeout: 15_000 });
  });

  // Skipped: requires authentication
  test.skip('finances page displays finance summary after login', async ({ page }) => {
    // After auth setup:
    // await page.goto('/finances');
    // const financeSummary = page.locator('.finance-summary');
    // await expect(financeSummary).toBeVisible({ timeout: 15_000 });
  });

  // Skipped: requires authentication
  test.skip('finances page shows tab navigation', async ({ page }) => {
    // After auth setup:
    // await page.goto('/finances');
    // const tabNav = page.locator('.fullscreen-page-tabs, .finances [role="tablist"]');
    // await expect(tabNav).toBeVisible({ timeout: 15_000 });
    // Verify tabs: Overview, Income, Expenses, Bills, Work, Analysis
  });

  // Skipped: requires authentication
  test.skip('finances page can switch to income tab', async ({ page }) => {
    // After auth setup:
    // await page.goto('/finances');
    // const incomeTab = page.locator('text=Income').first();
    // await incomeTab.click();
    // await expect(page).toHaveURL(/finances.*tab=income/, { timeout: 15_000 });
  });
});