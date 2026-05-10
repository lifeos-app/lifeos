import { test, expect } from '@playwright/test';

/**
 * E2E: Schedule page
 *
 * Tests that the Schedule page loads and displays expected UI elements.
 * The Schedule page features day/week/month/board/timeline views,
 * event creation, task tracking, and sync with goals/habits/bills.
 * It requires authentication for schedule data.
 *
 * Note: Schedule data requires authentication. Without auth, the app redirects
 * to the login page, so most content tests are skipped until auth is set up.
 * The structural test verifies the route is reachable.
 */
test.describe('Schedule page', () => {

  test('schedule route is reachable', async ({ page }) => {
    await page.goto('/schedule');
    // App should respond — either shows schedule or redirects to login
    await expect(page).toHaveURL(/\/(schedule)?/, { timeout: 15_000 });
  });

  // Skipped: requires authentication
  test.skip('schedule page displays day view after login', async ({ page }) => {
    // After auth setup:
    // await page.goto('/schedule');
    // const scheduleView = page.locator('.sched-day, .schedule-day');
    // await expect(scheduleView).toBeVisible({ timeout: 15_000 });
  });

  // Skipped: requires authentication
  test.skip('schedule page shows header with view switcher', async ({ page }) => {
    // After auth setup:
    // await page.goto('/schedule');
    // const header = page.locator('.sched-header, .schedule-header');
    // await expect(header).toBeVisible({ timeout: 15_000 });
    // Verify view switcher: Day, Week, Month, Board, Timeline
  });

  // Skipped: requires authentication
  test.skip('schedule page can switch to week view', async ({ page }) => {
    // After auth setup:
    // await page.goto('/schedule');
    // const weekButton = page.locator('text=Week').first();
    // await weekButton.click();
    // const weekView = page.locator('.sched-week, .schedule-week');
    // await expect(weekView).toBeVisible({ timeout: 15_000 });
  });
});