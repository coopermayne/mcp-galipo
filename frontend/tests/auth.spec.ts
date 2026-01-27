import { test, expect } from '@playwright/test';

const USERNAME = process.env.APP_USER || 'asdf';
const PASSWORD = process.env.APP_PASS || 'asdf';

test.describe('Authentication', () => {
  test('shows login page when not authenticated', async ({ page }) => {
    await page.goto('/');

    // Should redirect to login and show the login form
    await expect(page.locator('h1')).toContainText('Legal CMS');
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('shows error with invalid credentials', async ({ page }) => {
    await page.goto('/');

    await page.locator('#username').fill('wronguser');
    await page.locator('#password').fill('wrongpass');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should show error message
    await expect(page.getByText('Invalid username or password')).toBeVisible();
  });

  test('logs in successfully with valid credentials', async ({ page }) => {
    await page.goto('/');

    await page.locator('#username').fill(USERNAME);
    await page.locator('#password').fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should navigate away from login page to dashboard
    await expect(page).not.toHaveURL(/login/);

    // Should show logout button in header (indicates successful auth)
    await expect(page.getByTitle('Sign out')).toBeVisible();
  });
});
