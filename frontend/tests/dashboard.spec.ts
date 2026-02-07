import { test, expect } from '@playwright/test';

// Auth helper — works with both skip-auth and login modes
async function ensureAuthenticated(page) {
  await page.goto('/');
  const isLoginPage = await page.locator('#username').isVisible({ timeout: 2000 }).catch(() => false);
  if (isLoginPage) {
    const USERNAME = process.env.APP_EMAIL || 'cmayne@example.com';
    const PASSWORD = process.env.APP_PASSWORD || 'galipo2026';
    await page.locator('#username').fill(USERNAME);
    await page.locator('#password').fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
  }
  await expect(page).not.toHaveURL(/login/, { timeout: 10000 });
  await expect(page.getByRole('link', { name: /^cases$/i })).toBeVisible({ timeout: 5000 });
}

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('displays dashboard with events and tasks columns', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    // Dashboard has Events and Tasks columns
    await expect(page.getByText('Events').first()).toBeVisible();
    await expect(page.getByText('Tasks').first()).toBeVisible();
  });

  test('navigation sidebar works', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Cases', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Tasks', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Calendar', exact: true })).toBeVisible();
  });
});

test.describe('Cases Page', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('displays list of cases', async ({ page }) => {
    await page.getByRole('link', { name: 'Cases', exact: true }).click();

    // Should show the Case Files heading
    await expect(page.getByText('Case Files')).toBeVisible({ timeout: 5000 });

    // Should have at least one case listed — use API to get a name
    const res = await page.request.get('/api/v1/cases?limit=1');
    const data = await res.json();
    const caseName = data.cases?.[0]?.short_name;
    expect(caseName).toBeTruthy();
    await expect(page.getByText(caseName).first()).toBeVisible({ timeout: 5000 });
  });

  test('can search cases', async ({ page }) => {
    await page.getByRole('link', { name: 'Cases', exact: true }).click();
    await expect(page.getByText('Case Files')).toBeVisible({ timeout: 5000 });

    // Use first() to handle two-column layout with two search inputs
    const searchInput = page.getByPlaceholder(/search/i).first();
    if (await searchInput.isVisible()) {
      // Get a case name from the API to search for
      const res = await page.request.get('/api/v1/cases?limit=1');
      const data = await res.json();
      const caseName = data.cases?.[0]?.short_name;
      if (caseName) {
        await searchInput.fill(caseName);
        await page.waitForTimeout(500);
        await expect(page.getByText(caseName).first()).toBeVisible();
      }
    }
  });

  test('can open case detail', async ({ page }) => {
    // Get a case from the API first
    const res = await page.request.get('/api/v1/cases?limit=1');
    const data = await res.json();
    const caseName = data.cases?.[0]?.short_name;
    expect(caseName).toBeTruthy();

    await page.getByRole('link', { name: 'Cases', exact: true }).click();
    await expect(page.getByText('Case Files')).toBeVisible({ timeout: 5000 });

    // Click on the case
    await page.getByText(caseName).first().click();
    await page.waitForTimeout(500);

    // Should navigate to case detail page
    await expect(page).toHaveURL(/\/cases\/\d+/);

    // Should show case details — look for tabs or sections
    await expect(page.getByText(/Overview|Tasks|Events|Notes/i).first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Tasks Page', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('displays list of tasks', async ({ page }) => {
    await page.getByRole('link', { name: 'Tasks', exact: true }).click();
    await page.waitForTimeout(500);

    // Should show task content — check for urgency labels
    await expect(page.getByText(/Urgent|High|Medium|Low/i).first()).toBeVisible({ timeout: 5000 });
  });
});
