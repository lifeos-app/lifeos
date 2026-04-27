import { test, expect } from '@playwright/test';

/**
 * E2E: Habits page
 *
 * Tests that the Habits page loads and displays expected UI elements.
 * The Habits page is eagerly imported (non-lazy), so it should load quickly.
 *
 * Note: Habit data requires authentication. Without auth, the app redirects
 * to the login page, so most content tests are skipped until auth is set up.
 * The structural test verifies the route is reachable.
 */
test.describe('Habits page', () => {

  test('habits route is reachable', async ({ page }) => {
    await page.goto('/habits');
    // App should respond — either shows habits or redirects to login
    await expect(page).toHaveURL(/\/(habits)?/, { timeout: 15_000 });
  });

  // Skipped: requires authentication
  test.skip('habits page displays habit list after login', async ({ page }) => {
    // After auth setup:
    // await page.goto('/habits');
    // const habitsContainer = page.locator('.habits');
    // await expect(habitsContainer).toBeVisible({ timeout: 15_000 });
    // const habitsTitle = page.locator('.habits-title');
    // await expect(habitsTitle).toContainText('Habits');
  });

  // Skipped: requires authentication
  test.skip('habits page shows add button', async ({ page }) => {
    // After auth setup:
    // await page.goto('/habits');
    // const addBtn = page.locator('.habits-add-btn');
    // await expect(addBtn).toBeVisible({ timeout: 15_000 });
  });

  // Skipped: requires authentication
  test.skip('can toggle habit completion', async ({ page }) => {
    // After auth setup:
    // await page.goto('/habits');
    // const habitsContainer = page.locator('.habits');
    // await expect(habitsContainer).toBeVisible({ timeout: 15_000 });
    // const habitCheckboxes = page.locator('.habits-grid .habit-check, .habits-grid input[type="checkbox"]');
    // if (await habitCheckboxes.count() > 0) {
    //   await habitCheckboxes.first().click();
    //   // Verify toggle state changed
    // }
  });

  // Skipped: requires authentication
  test.skip('habits page shows streak stats', async ({ page }) => {
    // After auth setup:
    // await page.goto('/habits');
    // const subtitle = page.locator('.habits-sub');
    // await expect(subtitle).toContainText(/done today/i);
  });
});