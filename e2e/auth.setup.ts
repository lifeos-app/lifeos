/**
 * Auth setup for Playwright E2E tests
 *
 * LifeOS uses Supabase Auth with PKCE flow. Real authentication
 * requires valid Supabase test credentials (email/password or OAuth).
 *
 * HOW TO ADD REAL AUTH:
 * 1. Create a test user in your Supabase project (or use an existing one).
 * 2. Set SUPABASE_TEST_EMAIL and SUPABASE_TEST_PASSWORD env vars.
 * 3. Uncomment the storageState logic below to perform login via the UI
 *    and save the auth session to a file.
 * 4. In playwright.config.ts, add `dependencies: ['setup']` to each
 *    project and reference the saved storageState file.
 * 5. Remove test.skip() calls from authenticated test specs.
 *
 * For now, all tests that require auth are skipped. The structural
 * tests (page renders, navigation works, UI elements appear) still
 * run against the unauthenticated login page.
 */
import { test as base } from '@playwright/test';

// Extend base test with empty auth fixture — placeholder for future auth state
export const test = base.extend({
  // authenticated: async ({ page }, use) => {
  //   // Will log in via UI and save storageState once test creds exist
  //   await use(page);
  // },
});

export { expect } from '@playwright/test';

/**
 * Check whether we have real auth credentials. Returns false for now.
 * When Supabase test credentials are added, update this to check env vars.
 */
export function hasAuthCredentials(): boolean {
  return !!(process.env.SUPABASE_TEST_EMAIL && process.env.SUPABASE_TEST_PASSWORD);
}