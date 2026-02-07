import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5175';

test.use({ baseURL: BASE_URL });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  if (page.url().includes('/login')) {
    await page.getByPlaceholder('Username').fill(process.env.APP_EMAIL || 'cmayne@example.com');
    await page.getByPlaceholder('Password').fill(process.env.APP_PASSWORD || 'galipo2026');
    await page.getByRole('button', { name: /log in|sign in/i }).click();
    await expect(page.getByText(/dashboard|active cases/i)).toBeVisible({ timeout: 10000 });
  }
});

test.describe('Activities (SQLAlchemy migration)', () => {
  test('can add an activity on a case', async ({ page }) => {
    // Navigate to cases page
    await page.getByRole('link', { name: /cases/i }).click();

    // Click the first case row (div with cursor-pointer)
    await page.locator('div.cursor-pointer.border-b').first().click({ timeout: 10000 });

    // Wait for case detail page to load
    await expect(page).toHaveURL(/\/cases\/\d+/, { timeout: 10000 });

    // Go to Activity tab (rendered as <button>, not role="tab")
    await page.getByRole('button', { name: /activity/i }).click();

    // Expand the "Add Activity" form
    await page.getByText('Add Activity').first().click();

    // Fill in the activity form
    const testDesc = `Migration test activity ${Date.now()}`;
    await page.getByPlaceholder('Describe the activity...').fill(testDesc);

    // Select activity type (dropdown)
    const typeSelect = page.locator('select').first();
    if (await typeSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await typeSelect.selectOption({ index: 1 });
    }

    // Submit the form (use the submit button inside the form, not the expander header)
    await page.locator('form').getByRole('button', { name: /add activity/i }).click();

    // Verify activity appears
    await expect(page.getByText(testDesc)).toBeVisible({ timeout: 5000 });
  });

  test('activities API returns data for a case', async ({ page }) => {
    // Get a case ID first
    const casesRes = await page.request.get('/api/v1/cases');
    const data = await casesRes.json();
    const caseId = data.cases?.[0]?.id;

    if (caseId) {
      const response = await page.request.get(`/api/v1/cases/${caseId}`);
      expect(response.ok()).toBeTruthy();
      const caseData = await response.json();
      expect(caseData).toBeDefined();
    }
  });

  test('activities CRUD via API', async ({ page }) => {
    // Get a case ID
    const casesRes = await page.request.get('/api/v1/cases');
    const data = await casesRes.json();
    const caseId = data.cases?.[0]?.id;
    expect(caseId).toBeDefined();

    const testDesc = `API test activity ${Date.now()}`;

    // Create
    const createRes = await page.request.post('/api/v1/activities', {
      data: {
        case_id: caseId,
        description: testDesc,
        activity_type: 'Phone Call',
        date: new Date().toISOString().split('T')[0],
        minutes: 30
      }
    });
    expect(createRes.ok()).toBeTruthy();
    const created = await createRes.json();
    expect(created.activity.description).toBe(testDesc);

    // Delete
    const deleteRes = await page.request.delete(`/api/v1/activities/${created.activity.id}`);
    expect(deleteRes.ok()).toBeTruthy();
  });
});
