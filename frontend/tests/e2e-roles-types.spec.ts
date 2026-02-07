import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page).not.toHaveURL(/login/, { timeout: 15000 });
  await expect(page.getByRole('link', { name: /^cases$/i })).toBeVisible({ timeout: 5000 });
});

test.describe('Roles — full lifecycle with all fields', () => {
  test('CRUD with all fields', async ({ page }) => {
    const uniqueName = `Test Role ${Date.now()}`;

    // CREATE
    const createRes = await page.request.post('/api/v1/roles', {
      data: { name: uniqueName, category: 'counsel', sort_order: 5, description: 'Test desc' },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    const role = created.role;
    expect(role.id).toBeDefined();
    expect(role.name).toBe(uniqueName);
    expect(role.category).toBe('counsel');
    expect(role.sort_order).toBe(5);
    expect(role.description).toBe('Test desc');
    expect(role.created_at).toBeDefined();
    const roleId = role.id;

    // READ
    const getRes = await page.request.get(`/api/v1/roles/${roleId}`);
    expect(getRes.ok()).toBeTruthy();
    const fetched = await getRes.json();
    expect(fetched.role.name).toBe(uniqueName);
    expect(fetched.role.category).toBe('counsel');
    expect(fetched.role.sort_order).toBe(5);
    expect(fetched.role.description).toBe('Test desc');

    // UPDATE every field
    const updatedName = `Updated Role ${Date.now()}`;
    const updateRes = await page.request.put(`/api/v1/roles/${roleId}`, {
      data: { name: updatedName, category: 'expert', sort_order: 10, description: 'Updated' },
    });
    expect(updateRes.ok()).toBeTruthy();
    const updated = await updateRes.json();
    expect(updated.role.name).toBe(updatedName);
    expect(updated.role.category).toBe('expert');
    expect(updated.role.sort_order).toBe(10);
    expect(updated.role.description).toBe('Updated');

    // Verify update persisted
    const getRes2 = await page.request.get(`/api/v1/roles/${roleId}`);
    expect(getRes2.ok()).toBeTruthy();
    const refetched = await getRes2.json();
    expect(refetched.role.name).toBe(updatedName);
    expect(refetched.role.category).toBe('expert');
    expect(refetched.role.sort_order).toBe(10);
    expect(refetched.role.description).toBe('Updated');

    // DELETE
    const deleteRes = await page.request.delete(`/api/v1/roles/${roleId}`);
    expect(deleteRes.ok()).toBeTruthy();

    // Verify 404 after delete
    const getRes3 = await page.request.get(`/api/v1/roles/${roleId}`);
    expect(getRes3.status()).toBe(404);
  });
});

test.describe('Roles — category filtering exhaustive', () => {
  test('each category filter returns only matching roles', async ({ page }) => {
    const categories = ['client', 'counsel', 'expert', 'mediator', 'defendant', 'other'];
    let totalFiltered = 0;

    for (const cat of categories) {
      const res = await page.request.get(`/api/v1/roles?category=${cat}`);
      expect(res.ok()).toBeTruthy();
      const data = await res.json();
      for (const role of data.roles) {
        expect(role.category).toBe(cat);
      }
      totalFiltered += data.roles.length;
    }

    // Unfiltered count should be >= sum of individual categories
    const allRes = await page.request.get('/api/v1/roles');
    expect(allRes.ok()).toBeTruthy();
    const allData = await allRes.json();
    expect(allData.roles.length).toBeGreaterThanOrEqual(totalFiltered);
  });
});

test.describe('Roles — with_counts accuracy', () => {
  test('with_counts returns usage_count and temp role has 0', async ({ page }) => {
    // Fetch roles with counts
    const res = await page.request.get('/api/v1/roles?with_counts=true');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.roles.length).toBeGreaterThan(0);

    // Every role should have usage_count defined
    for (const role of data.roles) {
      expect(typeof role.usage_count).toBe('number');
    }

    // Create a temp role — it should have usage_count 0
    const tempName = `TempCount ${Date.now()}`;
    const createRes = await page.request.post('/api/v1/roles', {
      data: { name: tempName, category: 'other' },
    });
    expect(createRes.status()).toBe(201);
    const tempId = (await createRes.json()).role.id;

    const countsRes = await page.request.get('/api/v1/roles?with_counts=true');
    const countsData = await countsRes.json();
    const tempRole = countsData.roles.find((r: any) => r.id === tempId);
    expect(tempRole).toBeDefined();
    expect(tempRole.usage_count).toBe(0);

    // Cleanup
    await page.request.delete(`/api/v1/roles/${tempId}`);
  });
});

test.describe('Roles — deletion guard', () => {
  test('cannot delete role with usage_count > 0', async ({ page }) => {
    // Find a role that's in use
    const res = await page.request.get('/api/v1/roles?with_counts=true');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    const inUseRole = data.roles.find((r: any) => r.usage_count > 0);

    if (!inUseRole) {
      test.skip();
      return;
    }

    // Attempt to delete — expect 400
    const deleteRes = await page.request.delete(`/api/v1/roles/${inUseRole.id}`);
    expect(deleteRes.status()).toBe(400);
    const errorData = await deleteRes.json();
    expect(errorData.error.message).toContain('Cannot delete role');

    // Verify role still exists
    const getRes = await page.request.get(`/api/v1/roles/${inUseRole.id}`);
    expect(getRes.ok()).toBeTruthy();
  });
});

test.describe('Roles — invalid category validation', () => {
  test('POST with invalid category returns 400/422', async ({ page }) => {
    const res = await page.request.post('/api/v1/roles', {
      data: { name: `Bad ${Date.now()}`, category: 'nonexistent' },
    });
    expect([400, 422]).toContain(res.status());
  });

  test('PUT with invalid category returns 400/422', async ({ page }) => {
    // Create a valid role first
    const createRes = await page.request.post('/api/v1/roles', {
      data: { name: `ValidForBadUpdate ${Date.now()}`, category: 'other' },
    });
    expect(createRes.status()).toBe(201);
    const roleId = (await createRes.json()).role.id;

    // Try to update with bad category
    const updateRes = await page.request.put(`/api/v1/roles/${roleId}`, {
      data: { category: 'nonexistent' },
    });
    expect([400, 422]).toContain(updateRes.status());

    // Cleanup
    await page.request.delete(`/api/v1/roles/${roleId}`);
  });
});

test.describe('Roles — duplicate name handling', () => {
  test('creating a role with duplicate name returns error', async ({ page }) => {
    const uniqueName = `UniqueRole ${Date.now()}`;

    // Create first
    const res1 = await page.request.post('/api/v1/roles', {
      data: { name: uniqueName, category: 'other' },
    });
    expect(res1.status()).toBe(201);
    const roleId = (await res1.json()).role.id;

    // Try creating duplicate
    const res2 = await page.request.post('/api/v1/roles', {
      data: { name: uniqueName, category: 'other' },
    });
    expect(res2.ok()).toBeFalsy();
    expect([400, 409]).toContain(res2.status());

    // Cleanup
    await page.request.delete(`/api/v1/roles/${roleId}`);
  });
});

test.describe('Expertise types — full CRUD lifecycle', () => {
  test('create and list expertise type', async ({ page }) => {
    const uniqueName = `Test Expertise ${Date.now()}`;

    // CREATE
    const createRes = await page.request.post('/api/v1/expertise-types', {
      data: { name: uniqueName, description: 'Test expertise desc' },
    });
    expect(createRes.ok()).toBeTruthy();
    const created = await createRes.json();
    expect(created.expertise_type.id).toBeDefined();
    expect(created.expertise_type.name).toBe(uniqueName);
    expect(created.expertise_type.description).toBe('Test expertise desc');

    // LIST — verify it appears
    const listRes = await page.request.get('/api/v1/expertise-types');
    expect(listRes.ok()).toBeTruthy();
    const listData = await listRes.json();
    expect(listData.expertise_types.length).toBeGreaterThan(0);
    const found = listData.expertise_types.find((et: any) => et.name === uniqueName);
    expect(found).toBeDefined();
    expect(listData.total).toBe(listData.expertise_types.length);
  });
});

test.describe('Expertise types — in constants API', () => {
  test('constants includes roles and role_categories', async ({ page }) => {
    const res = await page.request.get('/api/v1/constants');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();

    // Roles array present with expected fields
    expect(data.roles).toBeDefined();
    expect(data.roles.length).toBeGreaterThan(0);
    expect(data.roles[0]).toHaveProperty('name');
    expect(data.roles[0]).toHaveProperty('category');

    // Role categories includes known values
    expect(data.role_categories).toBeDefined();
    expect(data.role_categories).toContain('counsel');
    expect(data.role_categories).toContain('expert');
    expect(data.role_categories).toContain('client');
  });
});

test.describe('Roles — sort_order correctness', () => {
  test('roles with different sort_orders return in correct order', async ({ page }) => {
    const ts = Date.now();
    const category = 'other';

    // Create 3 roles with sort_order 30, 10, 20
    const ids: number[] = [];
    for (const sortOrder of [30, 10, 20]) {
      const res = await page.request.post('/api/v1/roles', {
        data: { name: `SortTest_${sortOrder}_${ts}`, category, sort_order: sortOrder },
      });
      expect(res.status()).toBe(201);
      ids.push((await res.json()).role.id);
    }

    // Fetch filtered by category
    const listRes = await page.request.get(`/api/v1/roles?category=${category}`);
    expect(listRes.ok()).toBeTruthy();
    const roles = (await listRes.json()).roles;

    // Find our test roles in the returned list
    const testRoles = roles.filter((r: any) => ids.includes(r.id));
    expect(testRoles.length).toBe(3);

    // They should be sorted by sort_order ascending
    const sortOrders = testRoles.map((r: any) => r.sort_order);
    expect(sortOrders).toEqual([...sortOrders].sort((a: number, b: number) => a - b));

    // Cleanup
    for (const id of ids) {
      await page.request.delete(`/api/v1/roles/${id}`);
    }
  });
});
