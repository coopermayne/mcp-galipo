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

    // Should have at least one case card visible (page filters by "Mine" + "Unassigned")
    // Look for a case status badge as proof cases loaded
    await expect(page.getByText(/Discovery|Pre-trial|Filing|Signing Up|Pre-Filing|Trial|Expert Discovery|Settl\. Pend\./i).first()).toBeVisible({ timeout: 5000 });
  });

  test('can search cases', async ({ page }) => {
    await page.getByRole('link', { name: 'Cases', exact: true }).click();
    await expect(page.getByText('Case Files')).toBeVisible({ timeout: 5000 });

    // Wait for cases to load, then grab a visible case name to search for
    await expect(page.getByText(/Discovery|Pre-trial|Filing|Signing Up|Pre-Filing/i).first()).toBeVisible({ timeout: 5000 });

    // Use first() to handle two-column layout with two search inputs
    const searchInput = page.getByPlaceholder(/search/i).first();
    if (await searchInput.isVisible()) {
      // Get the short_name from the first visible case card on the page
      // Case cards show short_name as a bold line followed by the full case_name
      const firstCard = page.locator('[class*="cursor-pointer"]').first();
      await expect(firstCard).toBeVisible({ timeout: 5000 });
      // The short_name text node is the first child text in the card's info section
      const allText = await firstCard.allInnerTexts();
      // Extract a searchable term — use the "v." pattern from the full case name
      const fullText = allText.join(' ');
      const shortName = fullText.match(/(\w+)\s+v\./)?.[1];
      if (shortName) {
        await searchInput.fill(shortName);
        await page.waitForTimeout(500);
        await expect(page.getByText(shortName).first()).toBeVisible();
      }
    }
  });

  test('can open case detail', async ({ page }) => {
    await page.getByRole('link', { name: 'Cases', exact: true }).click();
    await expect(page.getByText('Case Files')).toBeVisible({ timeout: 5000 });

    // Wait for cases to load then click the first case card
    await expect(page.getByText(/Discovery|Pre-trial|Filing|Signing Up|Pre-Filing/i).first()).toBeVisible({ timeout: 5000 });
    await page.locator('[class*="cursor-pointer"]').first().click();
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
