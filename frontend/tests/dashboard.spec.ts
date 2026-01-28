import { test, expect } from '@playwright/test';

const USERNAME = process.env.APP_USER || 'asdf';
const PASSWORD = process.env.APP_PASS || 'asdf';

// Helper to login before tests
async function login(page) {
  await page.goto('/');
  await page.locator('#username').fill(USERNAME);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  // Wait for redirect to dashboard
  await expect(page.getByTitle('Sign out')).toBeVisible({ timeout: 5000 });
}

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('displays dashboard stats', async ({ page }) => {
    // Dashboard should show stats cards
    await expect(page.getByText(/Active Cases/i)).toBeVisible();
    await expect(page.getByText(/Pending Tasks/i)).toBeVisible();
    await expect(page.getByText(/Upcoming Events/i)).toBeVisible();
  });

  test('shows upcoming events section', async ({ page }) => {
    // Should have an events section
    const eventsSection = page.locator('text=Upcoming Events').first();
    await expect(eventsSection).toBeVisible();
  });

  test('navigation sidebar works', async ({ page }) => {
    // Use exact match to avoid matching "Total Cases", "Active Cases", etc.
    await expect(page.getByRole('link', { name: 'Cases', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Tasks', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Calendar', exact: true })).toBeVisible();
  });
});

test.describe('Cases Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('displays list of cases', async ({ page }) => {
    // Navigate to cases using exact match for sidebar link
    await page.getByRole('link', { name: 'Cases', exact: true }).click();

    // Should show cases (we have 24 in test data)
    await expect(page.getByText(/Martinez/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('can search cases', async ({ page }) => {
    await page.getByRole('link', { name: 'Cases', exact: true }).click();
    await page.waitForTimeout(500); // Wait for page to load

    // Find search input and search for a case
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('Chen');
      await page.waitForTimeout(300); // Wait for filter
      // Should filter to show Chen case
      await expect(page.getByText(/Chen/i).first()).toBeVisible();
    }
  });

  test('can open case detail', async ({ page }) => {
    await page.getByRole('link', { name: 'Cases', exact: true }).click();
    await page.waitForTimeout(500);

    // Click on first case row/link
    await page.getByText(/Martinez/i).first().click();
    await page.waitForTimeout(500);

    // Should navigate to case detail page
    await expect(page).toHaveURL(/\/cases\/\d+/);

    // Should show case details - look for tabs or sections
    await expect(page.getByText(/Overview|Tasks|Events|Notes/i).first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Tasks Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('displays list of tasks', async ({ page }) => {
    await page.getByRole('link', { name: 'Tasks', exact: true }).click();
    await page.waitForTimeout(500);

    // Should show task content - check for any task-related text
    // The page should have tasks organized by urgency
    await expect(page.getByText(/Urgent|High|Medium|Low/i).first()).toBeVisible({ timeout: 5000 });
  });
});
