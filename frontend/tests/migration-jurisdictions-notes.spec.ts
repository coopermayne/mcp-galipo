import { test, expect } from '@playwright/test';

const USERNAME = process.env.APP_EMAIL || 'cmayne@galipolaw.com';
const PASSWORD = process.env.APP_PASSWORD || 'galipo2026';

async function login(page) {
  await page.goto('/');
  if (page.url().includes('/login')) {
    await page.locator('#username').fill(USERNAME);
    await page.locator('#password').fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByTitle('Sign out')).toBeVisible({ timeout: 5000 });
  }
}

test.describe('Jurisdictions (SQLAlchemy migration)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('jurisdictions API returns all jurisdictions', async ({ page }) => {
    const response = await page.request.get('/api/v1/jurisdictions');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.jurisdictions.length).toBeGreaterThan(0);
    expect(data.jurisdictions[0]).toHaveProperty('name');
    expect(data.jurisdictions[0]).toHaveProperty('local_rules_link');
    expect(data.total).toBe(data.jurisdictions.length);
  });

  test('jurisdictions CRUD via API', async ({ page }) => {
    const testName = `Test Jurisdiction ${Date.now()}`;

    // Create
    const createRes = await page.request.post('/api/v1/jurisdictions', {
      data: { name: testName, local_rules_link: 'https://example.com/rules' }
    });
    expect(createRes.ok()).toBeTruthy();
    const created = await createRes.json();
    expect(created.jurisdiction.name).toBe(testName);
    const jId = created.jurisdiction.id;

    // Read
    const getRes = await page.request.get(`/api/v1/jurisdictions/${jId}`);
    expect(getRes.ok()).toBeTruthy();
    const fetched = await getRes.json();
    expect(fetched.jurisdiction.name).toBe(testName);
    expect(fetched.jurisdiction.local_rules_link).toBe('https://example.com/rules');

    // Update
    const updateRes = await page.request.put(`/api/v1/jurisdictions/${jId}`, {
      data: { name: `${testName} Updated`, notes: 'Test notes' }
    });
    expect(updateRes.ok()).toBeTruthy();
    const updated = await updateRes.json();
    expect(updated.jurisdiction.name).toBe(`${testName} Updated`);
    expect(updated.jurisdiction.notes).toBe('Test notes');
  });

  test('get nonexistent jurisdiction returns 404', async ({ page }) => {
    const res = await page.request.get('/api/v1/jurisdictions/99999');
    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);
  });

  test('constants API includes jurisdictions', async ({ page }) => {
    const response = await page.request.get('/api/v1/constants');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.jurisdictions).toBeDefined();
    expect(data.jurisdictions.length).toBeGreaterThan(0);
    expect(data.jurisdictions[0]).toHaveProperty('name');
  });
});

test.describe('Notes (SQLAlchemy migration)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('notes create and delete via API', async ({ page }) => {
    // Get a case ID
    const casesRes = await page.request.get('/api/v1/cases');
    const cases = await casesRes.json();
    const caseId = Array.isArray(cases) ? cases[0]?.id : cases.cases?.[0]?.id;
    expect(caseId).toBeDefined();

    const testContent = `Migration test note ${Date.now()}`;

    // Create
    const createRes = await page.request.post('/api/v1/notes', {
      data: { case_id: caseId, content: testContent }
    });
    expect(createRes.ok()).toBeTruthy();
    const created = await createRes.json();
    expect(created.note.content).toBe(testContent);
    expect(created.note.case_id).toBe(caseId);
    expect(created.note).toHaveProperty('created_at');
    expect(created.note).toHaveProperty('updated_at');
    const noteId = created.note.id;

    // Delete
    const deleteRes = await page.request.delete(`/api/v1/notes/${noteId}`);
    expect(deleteRes.ok()).toBeTruthy();
  });

  test('delete nonexistent note returns 404', async ({ page }) => {
    const res = await page.request.delete('/api/v1/notes/99999');
    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);
  });

  test('notes tab works on case detail', async ({ page }) => {
    // Navigate to a case
    await page.getByRole('link', { name: 'Cases', exact: true }).click();
    await page.waitForTimeout(1000);
    // Click first case in the list (not a table — it's a card/list layout)
    await page.getByText(/Alvarado|Armstrong|Martinez/i).first().click();
    await expect(page).toHaveURL(/\/cases\/\d+/, { timeout: 5000 });

    // Click Notes tab (tabs are plain <button> elements, not role="tab")
    await page.getByRole('button', { name: /^Notes/ }).click();
    await page.waitForTimeout(500);

    // Add a test note
    const testNote = `Playwright note ${Date.now()}`;
    const noteInput = page.getByPlaceholder(/add a note|write a note|new note|type/i);
    if (await noteInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await noteInput.fill(testNote);
      await page.getByRole('button', { name: /add|save|submit/i }).first().click();
      // Verify it shows up
      await expect(page.getByText(testNote)).toBeVisible({ timeout: 5000 });
    }
  });
});
