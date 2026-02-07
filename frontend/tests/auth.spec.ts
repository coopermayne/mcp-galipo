import { test, expect } from '@playwright/test';

const DEV_SKIP_AUTH = process.env.VITE_DEV_SKIP_AUTH === 'true';

test.describe('Authentication', () => {
  test('shows login page when not authenticated', async ({ page }) => {
    test.skip(DEV_SKIP_AUTH, 'Skipped: DEV_SKIP_AUTH is enabled, no login page shown');
    await page.goto('/');

    // Should redirect to login and show the login form
    await expect(page.locator('h1')).toContainText('Legal CMS');
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('shows error with invalid credentials', async ({ page }) => {
    test.skip(DEV_SKIP_AUTH, 'Skipped: DEV_SKIP_AUTH is enabled, no login page shown');
    await page.goto('/');

    await page.locator('#username').fill('wronguser');
    await page.locator('#password').fill('wrongpass');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should show error message
    await expect(page.getByText('Invalid username or password')).toBeVisible();
  });

  test('logs in successfully with valid credentials', async ({ page }) => {
    test.skip(DEV_SKIP_AUTH, 'Skipped: DEV_SKIP_AUTH is enabled, no login page shown');
    const USERNAME = process.env.APP_EMAIL || 'cmayne@galipolaw.com';
    const PASSWORD = process.env.APP_PASSWORD || 'galipo2026';

    await page.goto('/');

    await page.locator('#username').fill(USERNAME);
    await page.locator('#password').fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should navigate away from login page to dashboard
    await expect(page).not.toHaveURL(/login/);

    // Should show logout button in header (indicates successful auth)
    await expect(page.getByTitle('Sign out')).toBeVisible();
  });

  test('auto-authenticates in dev skip-auth mode', async ({ page }) => {
    test.skip(!DEV_SKIP_AUTH, 'Skipped: DEV_SKIP_AUTH is not enabled');
    await page.goto('/');

    // Should go straight to dashboard without login
    await expect(page).not.toHaveURL(/login/, { timeout: 10000 });
    await expect(page.getByRole('link', { name: /^cases$/i })).toBeVisible({ timeout: 5000 });
  });
});
