import { test, expect } from '@playwright/test';

const USERNAME = process.env.APP_EMAIL || 'cmayne@example.com';
const PASSWORD = process.env.APP_PASSWORD || 'galipo2026';

async function login(page) {
  await page.goto('/');
  // Skip if already logged in (DEV_SKIP_AUTH)
  if (page.url().includes('/login')) {
    await page.locator('#username').fill(USERNAME);
    await page.locator('#password').fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByTitle('Sign out')).toBeVisible({ timeout: 5000 });
  }
}

test.describe('Roles (SQLAlchemy migration)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('roles API returns all roles', async ({ page }) => {
    const response = await page.request.get('/api/v1/roles');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.roles.length).toBeGreaterThan(0);
    expect(data.roles[0]).toHaveProperty('name');
    expect(data.roles[0]).toHaveProperty('category');
  });

  test('roles API filters by category', async ({ page }) => {
    const response = await page.request.get('/api/v1/roles?category=counsel');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    for (const role of data.roles) {
      expect(role.category).toBe('counsel');
    }
  });

  test('roles with counts returns usage_count', async ({ page }) => {
    const response = await page.request.get('/api/v1/roles?with_counts=true');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.roles.length).toBeGreaterThan(0);
    expect(data.roles[0]).toHaveProperty('usage_count');
    expect(typeof data.roles[0].usage_count).toBe('number');
  });

  test('roles CRUD via API', async ({ page }) => {
    const testName = `test_role_${Date.now()}`;

    // Create
    const createRes = await page.request.post('/api/v1/roles', {
      data: { name: testName, category: 'other', sort_order: 99 }
    });
    expect(createRes.ok()).toBeTruthy();
    const created = await createRes.json();
    expect(created.role.name).toBe(testName);
    const roleId = created.role.id;

    // Read
    const getRes = await page.request.get(`/api/v1/roles/${roleId}`);
    expect(getRes.ok()).toBeTruthy();
    const fetched = await getRes.json();
    expect(fetched.role.name).toBe(testName);

    // Update
    const updateRes = await page.request.put(`/api/v1/roles/${roleId}`, {
      data: { description: 'Test description' }
    });
    expect(updateRes.ok()).toBeTruthy();
    const updated = await updateRes.json();
    expect(updated.role.description).toBe('Test description');

    // Delete (should succeed — no person_roles reference it)
    const deleteRes = await page.request.delete(`/api/v1/roles/${roleId}`);
    expect(deleteRes.ok()).toBeTruthy();

    // Verify gone
    const verifyRes = await page.request.get(`/api/v1/roles/${roleId}`);
    expect(verifyRes.ok()).toBeFalsy();
  });

  test('cannot delete role that is in use', async ({ page }) => {
    // Get a role with usage_count > 0
    const listRes = await page.request.get('/api/v1/roles?with_counts=true');
    const data = await listRes.json();
    const usedRole = data.roles.find((r: { usage_count: number }) => r.usage_count > 0);
    expect(usedRole).toBeDefined();

    // Try to delete — should fail with 400
    const deleteRes = await page.request.delete(`/api/v1/roles/${usedRole.id}`);
    expect(deleteRes.ok()).toBeFalsy();
    const body = await deleteRes.json();
    expect(body.error.message).toContain('Cannot delete role');
  });

  test('constants API includes roles', async ({ page }) => {
    const response = await page.request.get('/api/v1/constants');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.roles).toBeDefined();
    expect(data.roles.length).toBeGreaterThan(0);
    expect(data.role_categories).toBeDefined();
    expect(data.role_categories).toContain('counsel');
  });
});

test.describe('Expertise Types (SQLAlchemy migration)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('expertise types API returns data', async ({ page }) => {
    const response = await page.request.get('/api/v1/expertise-types');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.expertise_types.length).toBeGreaterThan(0);
    expect(data.expertise_types[0]).toHaveProperty('name');
  });

  test('expertise types create and verify', async ({ page }) => {
    const testName = `Test Expertise ${Date.now()}`;

    // Create
    const createRes = await page.request.post('/api/v1/expertise-types', {
      data: { name: testName }
    });
    expect(createRes.ok()).toBeTruthy();
    const created = await createRes.json();
    expect(created.expertise_type.name).toBe(testName);

    // Verify in list
    const listRes = await page.request.get('/api/v1/expertise-types');
    const data = await listRes.json();
    expect(data.expertise_types.some((t: { name: string }) => t.name === testName)).toBeTruthy();
  });
});
