import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5175';

test.use({ baseURL: BASE_URL });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page).not.toHaveURL(/login/, { timeout: 15000 });
  await expect(page.getByRole('link', { name: /^cases$/i })).toBeVisible({ timeout: 5000 });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getFirstCaseId(page): Promise<number> {
  const res = await page.request.get('/api/v1/cases');
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  const id = data.cases?.[0]?.id;
  expect(id).toBeDefined();
  return id;
}

// ---------------------------------------------------------------------------
// 1. Cases — full CRUD lifecycle
// ---------------------------------------------------------------------------

test.describe('Cases — full CRUD lifecycle', () => {
  test('create, verify fields, update, get by ID, delete, and 404', async ({ page }) => {
    const ts = Date.now();
    const caseName = `E2E Test Case ${ts}`;

    // CREATE
    const createRes = await page.request.post('/api/v1/cases', {
      data: {
        case_name: caseName,
        status: 'Pre-Filing',
        short_name: `E2E${ts}`,
        case_summary: 'Test case for E2E',
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const createBody = await createRes.json();
    expect(createBody.success).toBe(true);

    const caseData = createBody.case;
    expect(caseData.case_name).toBe(caseName);
    expect(caseData.status).toBe('Pre-Filing');
    expect(caseData.short_name).toBe(`E2E${ts}`);
    expect(caseData.case_summary).toBe('Test case for E2E');
    expect(caseData.id).toBeDefined();
    expect(caseData.color).toBeTruthy();
    expect(caseData.created_at).toBeTruthy();
    // Should include empty related data arrays
    expect(Array.isArray(caseData.attorneys)).toBe(true);
    expect(Array.isArray(caseData.events)).toBe(true);
    expect(Array.isArray(caseData.tasks)).toBe(true);
    expect(Array.isArray(caseData.notes)).toBe(true);
    expect(Array.isArray(caseData.proceedings)).toBe(true);

    const caseId = caseData.id;

    // GET by ID — verify full response structure
    const getRes = await page.request.get(`/api/v1/cases/${caseId}`);
    expect(getRes.ok()).toBeTruthy();
    const getBody = await getRes.json();
    expect(getBody.case_name).toBe(caseName);
    expect(getBody.status).toBe('Pre-Filing');

    // UPDATE
    const updateRes = await page.request.put(`/api/v1/cases/${caseId}`, {
      data: {
        status: 'Discovery',
        case_summary: 'Updated summary',
      },
    });
    expect(updateRes.ok()).toBeTruthy();
    const updateBody = await updateRes.json();
    expect(updateBody.case.status).toBe('Discovery');
    expect(updateBody.case.case_summary).toBe('Updated summary');
    // Unchanged fields persist
    expect(updateBody.case.case_name).toBe(caseName);
    expect(updateBody.case.short_name).toBe(`E2E${ts}`);

    // DELETE
    const deleteRes = await page.request.delete(`/api/v1/cases/${caseId}`);
    expect(deleteRes.ok()).toBeTruthy();

    // Verify deleted — 404
    const getAfterDelete = await page.request.get(`/api/v1/cases/${caseId}`);
    expect(getAfterDelete.status()).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// 2. Cases — list endpoint with pagination
// ---------------------------------------------------------------------------

test.describe('Cases — list endpoint', () => {
  test('GET /api/v1/cases returns list with counts', async ({ page }) => {
    const res = await page.request.get('/api/v1/cases');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.cases).toBeDefined();
    expect(data.total).toBeDefined();
    expect(Array.isArray(data.cases)).toBe(true);
    expect(data.cases.length).toBeGreaterThan(0);

    // Each case should have expected fields from correlated subqueries
    const c = data.cases[0];
    expect(c.id).toBeDefined();
    expect(c.case_name).toBeDefined();
    expect(c.status).toBeDefined();
    expect(typeof c.pending_task_count).toBe('number');
    expect(typeof c.upcoming_event_count).toBe('number');
    expect(typeof c.client_count).toBe('number');
    expect(typeof c.defendant_count).toBe('number');
  });

  test('GET /api/v1/cases with limit and offset', async ({ page }) => {
    const res = await page.request.get('/api/v1/cases?limit=2&offset=0');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.cases.length).toBeLessThanOrEqual(2);
  });

  test('GET /api/v1/cases with status filter', async ({ page }) => {
    // Get all cases first to find a valid status
    const allRes = await page.request.get('/api/v1/cases');
    const allData = await allRes.json();
    if (allData.cases.length === 0) return;

    const status = allData.cases[0].status;
    const filteredRes = await page.request.get(`/api/v1/cases?status=${encodeURIComponent(status)}`);
    expect(filteredRes.ok()).toBeTruthy();
    const filteredData = await filteredRes.json();
    for (const c of filteredData.cases) {
      expect(c.status).toBe(status);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Cases — get case by ID includes related data
// ---------------------------------------------------------------------------

test.describe('Cases — case detail', () => {
  test('GET /api/v1/cases/:id returns full case with related data arrays', async ({ page }) => {
    const caseId = await getFirstCaseId(page);
    const res = await page.request.get(`/api/v1/cases/${caseId}`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();

    expect(data.id).toBe(caseId);
    expect(data.case_name).toBeDefined();
    expect(data.status).toBeDefined();
    expect(Array.isArray(data.attorneys)).toBe(true);
    expect(Array.isArray(data.paralegals)).toBe(true);
    expect(Array.isArray(data.persons)).toBe(true);
    expect(Array.isArray(data.activities)).toBe(true);
    expect(Array.isArray(data.events)).toBe(true);
    expect(Array.isArray(data.tasks)).toBe(true);
    expect(Array.isArray(data.notes)).toBe(true);
    expect(Array.isArray(data.proceedings)).toBe(true);
  });

  test('GET /api/v1/cases/99999 returns 404', async ({ page }) => {
    const res = await page.request.get('/api/v1/cases/99999');
    expect(res.status()).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// 4. Dashboard stats
// ---------------------------------------------------------------------------

test.describe('Dashboard stats', () => {
  test('GET /api/v1/stats returns expected structure', async ({ page }) => {
    const res = await page.request.get('/api/v1/stats');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();

    expect(typeof data.total_cases).toBe('number');
    expect(typeof data.active_cases).toBe('number');
    expect(typeof data.pending_tasks).toBe('number');
    expect(typeof data.upcoming_events).toBe('number');
    expect(data.cases_by_status).toBeDefined();
    expect(typeof data.cases_by_status).toBe('object');
  });

  test('GET /api/v1/stats with attorney_ids filter', async ({ page }) => {
    const res = await page.request.get('/api/v1/stats?attorney_ids=1');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(typeof data.total_cases).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// 5. Case staff assignments
// ---------------------------------------------------------------------------

test.describe('Case staff assignments', () => {
  test('GET /api/v1/cases/:id/users returns attorneys and paralegals', async ({ page }) => {
    const caseId = await getFirstCaseId(page);
    const res = await page.request.get(`/api/v1/cases/${caseId}/users`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data.attorneys)).toBe(true);
    expect(Array.isArray(data.data.paralegals)).toBe(true);
  });
});
