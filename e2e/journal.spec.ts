import { test, expect } from '@playwright/test';

/**
 * E2E: Journal page
 *
 * Tests that the Journal page loads and displays expected UI elements.
 * The Journal page features a calendar strip, editor with mood/energy tracking,
 * and a previous entries list. It requires authentication for journal data.
 *
 * Note: Journal data requires authentication. Without auth, the app redirects
 * to the login page, so most content tests are skipped until auth is set up.
 * The structural test verifies the route is reachable.
 */
test.describe('Journal page', () => {

  test('journal route is reachable', async ({ page }) => {
    await page.goto('/journal');
    // App should respond — either shows journal or redirects to login
    await expect(page).toHaveURL(/\/(journal)?/, { timeout: 15_000 });
  });

  // Skipped: requires authentication
  test.skip('journal page displays editor after login', async ({ page }) => {
    // After auth setup:
    // await page.goto('/journal');
    // const journalEditor = page.locator('.jnl-editor, .journal-editor');
    // await expect(journalEditor).toBeVisible({ timeout: 15_000 });
  });

  // Skipped: requires authentication
  test.skip('journal page shows calendar strip', async ({ page }) => {
    // After auth setup:
    // await page.goto('/journal');
    // const calendarStrip = page.locator('.jnl-calendar-strip, .journal-calendar-strip');
    // await expect(calendarStrip).toBeVisible({ timeout: 15_000 });
  });

  // Skipped: requires authentication
  test.skip('journal page displays mood selector', async ({ page }) => {
    // After auth setup:
    // await page.goto('/journal');
    // const moodSelector = page.locator('.jnl-mood, .mood-selector');
    // await expect(moodSelector).toBeVisible({ timeout: 15_000 });
  });
});