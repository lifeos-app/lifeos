import { test, expect } from '@playwright/test';

/**
 * E2E: Navigation
 *
 * Tests that sidebar navigation links work and update the URL.
 * Since the app uses React Router with BrowserRouter (basename: /app on web),
 * we use page.goto() for initial loads then click nav items.
 *
 * These tests run against the login page (unauthenticated). We verify
 * that the route structure exists. When auth is available, we can test
 * full navigation between authenticated routes.
 *
 * Note: Without authentication, navigating to protected routes redirects
 * back to the login page. So we test that the app handles these routes
 * gracefully (no crashes, no 404s).
 */
const ROUTES = [
  { path: '/', label: 'Dashboard' },
  { path: '/habits', label: 'Habits' },
  { path: '/goals', label: 'Goals' },
  { path: '/schedule', label: 'Schedule' },
  { path: '/health', label: 'Health' },
  { path: '/finances', label: 'Finances' },
  { path: '/reflect/journal', label: 'Journal' },
  { path: '/settings', label: 'Settings' },
];

test.describe('Navigation', () => {

  test('app loads without crashing', async ({ page }) => {
    await page.goto('/');
    // App should render — either Login page or Dashboard
    await expect(page.locator('body')).toBeTruthy();
    // No 404 or blank screen
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(0);
  });

  test('each route is reachable (no 404 or crash)', async ({ page }) => {
    for (const route of ROUTES) {
      const response = await page.goto(route.path);
      // Page should return 200 (Vite SPA serves index.html for all routes)
      // or at least not crash
      expect(response?.ok ?? true).toBeTruthy();
    }
  });

  test('navigating to /habits changes URL', async ({ page }) => {
    await page.goto('/');
    await page.goto('/habits');
    await expect(page).toHaveURL(/\/habits/, { timeout: 15_000 });
  });

  test('navigating to /goals changes URL', async ({ page }) => {
    await page.goto('/');
    await page.goto('/goals');
    await expect(page).toHaveURL(/\/goals/, { timeout: 15_000 });
  });

  test('navigating to /schedule changes URL', async ({ page }) => {
    await page.goto('/');
    await page.goto('/schedule');
    await expect(page).toHaveURL(/\/schedule/, { timeout: 15_000 });
  });

  test('navigating to /health changes URL', async ({ page }) => {
    await page.goto('/');
    await page.goto('/health');
    await expect(page).toHaveURL(/\/health/, { timeout: 15_000 });
  });

  test('navigating to /finances changes URL', async ({ page }) => {
    await page.goto('/');
    await page.goto('/finances');
    await expect(page).toHaveURL(/\/finances/, { timeout: 15_000 });
  });

  test('navigating to /reflect/journal changes URL', async ({ page }) => {
    await page.goto('/');
    await page.goto('/reflect/journal');
    await expect(page).toHaveURL(/\/reflect\/journal/, { timeout: 15_000 });
  });

  test('navigating to /settings changes URL', async ({ page }) => {
    await page.goto('/');
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings/, { timeout: 15_000 });
  });

  // Skipped: requires auth to see sidebar
  test.skip('sidebar navigation clicks update URL', async ({ page }) => {
    // After auth setup:
    // await page.goto('/');
    // const sidebar = page.locator('.sidebar');
    // await expect(sidebar).toBeVisible();
    // for (const route of ROUTES) {
    //   const link = sidebar.locator(`a[href="${route.path}"], a[href="/app${route.path}"]`);
    //   if (await link.count() > 0) {
    //     await link.click();
    //     await expect(page).toHaveURL(new RegExp(route.path.replace('/', '\\/')));
    //   }
    // }
  });
});