import { test, expect } from '@playwright/test';

/**
 * E2E: Login page
 *
 * These tests verify that the login page renders correctly.
 * Actual authentication is skipped — we don't have Supabase test credentials.
 * The login page is the default view when no user session exists (web mode).
 */
test.describe('Login page', () => {

  test('loads the login page and shows form', async ({ page }) => {
    // The root URL redirects to Login when no auth session exists
    await page.goto('/');

    // Wait for the login form to appear (app lazy-loads and may show spinner first)
    const form = page.locator('form.login-form');
    await expect(form).toBeVisible({ timeout: 15_000 });
  });

  test('shows email input field', async ({ page }) => {
    await page.goto('/');

    const emailInput = page.locator('#login-email');
    await expect(emailInput).toBeVisible({ timeout: 15_000 });
    await expect(emailInput).toHaveAttribute('type', 'email');
  });

  test('shows password input field', async ({ page }) => {
    await page.goto('/');

    const passwordInput = page.locator('#login-password');
    await expect(passwordInput).toBeVisible({ timeout: 15_000 });
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('shows error message on invalid credentials', async ({ page }) => {
    await page.goto('/');

    // Fill in bad credentials
    await page.locator('#login-email').fill('test-nonexistent@example.com');
    await page.locator('#login-password').fill('wrongpassword123');

    // Submit the login form
    await page.locator('form.login-form').getByRole('button', { name: /sign in/i }).click();

    // Error message should appear
    const errorEl = page.locator('#login-error');
    await expect(errorEl).toBeVisible({ timeout: 10_000 });
  });

  test('login form has correct aria-label', async ({ page }) => {
    await page.goto('/');

    const form = page.locator('form.login-form');
    await expect(form).toBeVisible({ timeout: 15_000 });
    await expect(form).toHaveAttribute('aria-label', /sign in/i);
  });

  // Skipped: requires real Supabase credentials
  test.skip('can log in with valid credentials (requires test auth)', async ({ page }) => {
    // This test will be enabled when SUPABASE_TEST_EMAIL/PASSWORD are available
    // Steps:
    // 1. Navigate to /
    // 2. Fill #login-email and #login-password with test creds
    // 3. Click sign in
    // 4. Verify redirect to dashboard (url contains / or no /login)
    // 5. Save storageState for other tests
  });
});