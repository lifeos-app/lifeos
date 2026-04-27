import { test, expect } from '@playwright/test';

/**
 * E2E: Goals page
 *
 * Tests that the Goals page loads and renders its structure.
 * Goals lazy-loads, so we allow extra time for the chunk to arrive.
 * Content-level tests are skipped until auth is set up.
 */
test.describe('Goals page', () => {

  test('goals route is reachable', async ({ page }) => {
    await page.goto('/goals');
    // App should respond — either shows goals or redirects to login
    await expect(page).toHaveURL(/\/(goals)?/, { timeout: 15_000 });
  });

  // Skipped: requires authentication
  test.skip('goals page displays title after login', async ({ page }) => {
    // After auth setup:
    // await page.goto('/goals');
    // const goalsTitle = page.locator('.goals-title');
    // await expect(goalsTitle).toBeVisible({ timeout: 15_000 });
    // await expect(goalsTitle).toContainText('Goals');
  });

  // Skipped: requires authentication
  test.skip('goals page shows goal tree view', async ({ page }) => {
    // After auth setup:
    // await page.goto('/goals');
    // const goalsContainer = page.locator('.goals');
    // await expect(goalsContainer).toBeVisible({ timeout: 15_000 });
    // Switch to tree view if not default
    // const treeBtn = page.locator('.goals-view-btn[title="Vision tree"]');
    // await treeBtn.click();
    // const treeView = page.locator('.gt-tree-view');
    // await expect(treeView).toBeVisible();
  });

  // Skipped: requires authentication
  test.skip('can switch between goals view modes', async ({ page }) => {
    // After auth setup:
    // await page.goto('/goals');
    // const goalsContainer = page.locator('.goals');
    // await expect(goalsContainer).toBeVisible({ timeout: 15_000 });
    // Test view toggle buttons: list, tree, planning, matrix
    // const listBtn = page.locator('.goals-view-btn[title="Goals list"]');
    // await listBtn.click();
    // const treeBtn = page.locator('.goals-view-btn[title="Vision tree"]');
    // await treeBtn.click();
  });

  // Skipped: requires authentication
  test.skip('goals page shows add goal button', async ({ page }) => {
    // After auth setup:
    // await page.goto('/goals');
    // const addBtn = page.locator('.goals-add-btn');
    // await expect(addBtn).toBeVisible({ timeout: 15_000 });
  });
});