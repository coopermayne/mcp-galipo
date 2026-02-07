import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5175';

test.use({ baseURL: BASE_URL });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page).not.toHaveURL(/login/, { timeout: 15000 });
  await expect(page.getByRole('link', { name: /^cases$/i })).toBeVisible({ timeout: 5000 });
});

// ---------------------------------------------------------------------------
// 1. Users — full CRUD lifecycle
// ---------------------------------------------------------------------------

test.describe('Users — full CRUD lifecycle', () => {
  test('create, verify fields, get by ID, update, delete, and 404', async ({ page }) => {
    const ts = Date.now();
    const email = `e2e-test-${ts}@test.com`;

    // CREATE
    const createRes = await page.request.post('/api/v1/users', {
      data: {
        email,
        firstName: 'E2E',
        lastName: `Test${ts}`,
        initials: 'ET',
        position: 'paralegal',
      },
    });
    expect(createRes.status()).toBe(201);
    const createBody = await createRes.json();
    expect(createBody.success).toBe(true);

    const user = createBody.data;
    expect(user.email).toBe(email);
    expect(user.firstName).toBe('E2E');
    expect(user.lastName).toBe(`Test${ts}`);
    expect(user.initials).toBe('ET');
    expect(user.position).toBe('paralegal');
    expect(user.isActive).toBe(true);
    expect(user.mustChangePassword).toBe(true);
    expect(user.isAdmin).toBe(false);
    expect(user.id).toBeDefined();
    expect(user.createdAt).toBeTruthy();

    const userId = user.id;

    // GET by ID — verify matches creation
    const getRes = await page.request.get(`/api/v1/users/${userId}`);
    expect(getRes.ok()).toBeTruthy();
    const getBody = await getRes.json();
    expect(getBody.data.email).toBe(email);
    expect(getBody.data.firstName).toBe('E2E');
    expect(getBody.data.lastName).toBe(`Test${ts}`);

    // UPDATE — change some fields
    const updateRes = await page.request.put(`/api/v1/users/${userId}`, {
      data: {
        firstName: 'Updated',
        barNumber: 'BAR123',
      },
    });
    expect(updateRes.ok()).toBeTruthy();
    const updateBody = await updateRes.json();
    expect(updateBody.data.firstName).toBe('Updated');
    expect(updateBody.data.barNumber).toBe('BAR123');
    // Unchanged fields persist
    expect(updateBody.data.lastName).toBe(`Test${ts}`);
    expect(updateBody.data.position).toBe('paralegal');
    expect(updateBody.data.email).toBe(email);

    // Verify update via fresh GET
    const getAfterUpdate = await page.request.get(`/api/v1/users/${userId}`);
    const afterUpdateBody = await getAfterUpdate.json();
    expect(afterUpdateBody.data.firstName).toBe('Updated');
    expect(afterUpdateBody.data.barNumber).toBe('BAR123');

    // DELETE (hard delete to clean up test data)
    const deleteRes = await page.request.delete(`/api/v1/users/${userId}?hard=true`);
    expect(deleteRes.ok()).toBeTruthy();

    // Verify deleted — 404
    const getAfterDelete = await page.request.get(`/api/v1/users/${userId}`);
    expect(getAfterDelete.status()).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// 2. Users — list endpoint
// ---------------------------------------------------------------------------

test.describe('Users — list endpoint', () => {
  test('GET /api/v1/users returns list with expected fields', async ({ page }) => {
    const res = await page.request.get('/api/v1/users');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);

    const u = data.data[0];
    expect(u.id).toBeDefined();
    expect(u.email).toBeDefined();
    expect(u.firstName).toBeDefined();
    expect(u.lastName).toBeDefined();
    expect(u.initials).toBeDefined();
    expect(u.position).toBeDefined();
    expect(typeof u.isActive).toBe('boolean');
    expect(typeof u.isAdmin).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// 3. Users — duplicate email rejection
// ---------------------------------------------------------------------------

test.describe('Users — duplicate email', () => {
  test('POST /api/v1/users rejects duplicate email with 409', async ({ page }) => {
    const ts = Date.now();
    const email = `e2e-dup-${ts}@test.com`;

    // Create first user
    const res1 = await page.request.post('/api/v1/users', {
      data: { email, firstName: 'Dup', lastName: 'Test', initials: 'DT', position: 'paralegal' },
    });
    expect(res1.status()).toBe(201);
    const id1 = (await res1.json()).data.id;

    // Attempt duplicate
    const res2 = await page.request.post('/api/v1/users', {
      data: { email, firstName: 'Dup2', lastName: 'Test2', initials: 'D2', position: 'paralegal' },
    });
    expect(res2.status()).toBe(409);

    // Cleanup
    await page.request.delete(`/api/v1/users/${id1}?hard=true`);
  });
});

// ---------------------------------------------------------------------------
// 4. Users — validation errors
// ---------------------------------------------------------------------------

test.describe('Users — validation', () => {
  test('POST /api/v1/users rejects missing required fields with 400', async ({ page }) => {
    const res = await page.request.post('/api/v1/users', {
      data: { email: 'incomplete@test.com' },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/v1/users rejects invalid position with 400', async ({ page }) => {
    const res = await page.request.post('/api/v1/users', {
      data: {
        email: 'bad-pos@test.com',
        firstName: 'Bad',
        lastName: 'Position',
        initials: 'BP',
        position: 'janitor',
      },
    });
    expect(res.status()).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// 5. Attorneys — endpoint
// ---------------------------------------------------------------------------

test.describe('Attorneys — endpoint', () => {
  test('GET /api/v1/attorneys returns list with expected fields', async ({ page }) => {
    const res = await page.request.get('/api/v1/attorneys');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);

    for (const attorney of data.data) {
      expect(attorney.id).toBeDefined();
      expect(attorney.firstName).toBeDefined();
      expect(attorney.lastName).toBeDefined();
      expect(attorney.initials).toBeDefined();
      expect(attorney.email).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Webhooks — list and 404
// ---------------------------------------------------------------------------

test.describe('Webhooks — list and 404', () => {
  test('GET /api/v1/webhooks returns list (may be empty)', async ({ page }) => {
    const res = await page.request.get('/api/v1/webhooks');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.webhooks).toBeDefined();
    expect(Array.isArray(data.webhooks)).toBe(true);
  });

  test('GET /api/v1/webhooks/99999 returns 404', async ({ page }) => {
    const res = await page.request.get('/api/v1/webhooks/99999');
    expect(res.status()).toBe(404);
  });
});
