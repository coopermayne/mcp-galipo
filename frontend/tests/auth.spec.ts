import { test, expect } from '@playwright/test';

const DEV_SKIP_AUTH = process.env.VITE_DEV_SKIP_AUTH === 'true';

test.describe('Authentication', () => {
  test('auto-authenticates in dev skip-auth mode', async ({ page }) => {
    test.skip(!DEV_SKIP_AUTH, 'Skipped: DEV_SKIP_AUTH is not enabled');
    await page.goto('/');

    // Should go straight to dashboard without login
    await expect(page).not.toHaveURL(/login/, { timeout: 10000 });
    await expect(page.getByRole('link', { name: /^cases$/i })).toBeVisible({ timeout: 5000 });
  });
});
