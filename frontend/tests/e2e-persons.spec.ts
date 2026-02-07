import { test, expect } from '@playwright/test';

// ─── Auth helper ──────────────────────────────────────────────────────────────
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page).not.toHaveURL(/login/, { timeout: 15000 });
  await expect(page.getByRole('link', { name: /^cases$/i })).toBeVisible({ timeout: 5000 });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function getFirstCaseId(page): Promise<number> {
  const res = await page.request.get('/api/v1/cases');
  const data = await res.json();
  const id = Array.isArray(data) ? data[0]?.id : data.cases?.[0]?.id;
  expect(id).toBeDefined();
  return id;
}

async function getFirstRoleId(page, category?: string): Promise<{ id: number; name: string; category: string }> {
  let url = '/api/v1/roles';
  if (category) url += `?category=${category}`;
  const res = await page.request.get(url);
  const data = await res.json();
  const role = data.roles?.[0];
  expect(role).toBeDefined();
  return { id: role.id, name: role.name, category: role.category };
}

async function createTestPerson(page, suffix: string) {
  const ts = Date.now();
  const res = await page.request.post('/api/v1/persons', {
    data: {
      name: `E2E Person ${suffix}-${ts}`,
      phones: [{ value: '555-0199', label: 'Mobile', primary: true }],
      emails: [{ value: `e2e-${suffix}-${ts}@test.com`, label: 'Work', primary: true }],
      organization: `Test Org ${suffix}`,
      address: '123 Test St',
      notes: `Created by E2E test ${suffix}`,
    },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.success).toBe(true);
  return body.person;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERSONS — CRUD
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Persons — CRUD lifecycle', () => {

  test('GET /persons — list with pagination', async ({ page }) => {
    const res = await page.request.get('/api/v1/persons?limit=5&offset=0');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data).toHaveProperty('persons');
    expect(data).toHaveProperty('total');
    expect(Array.isArray(data.persons)).toBeTruthy();
    expect(data.persons.length).toBeLessThanOrEqual(5);
    expect(data.total).toBeGreaterThanOrEqual(data.persons.length);
  });

  test('full person lifecycle: create, get, update, archive, delete', async ({ page }) => {
    const ts = Date.now();

    // CREATE
    const createRes = await page.request.post('/api/v1/persons', {
      data: {
        name: `E2E Lifecycle ${ts}`,
        phones: [{ value: '555-1234', label: 'Office', primary: true }],
        emails: [{ value: `lifecycle-${ts}@test.com`, label: 'Work', primary: true }],
        organization: 'Lifecycle Corp',
        address: '456 Main St',
        notes: 'Test notes',
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const createBody = await createRes.json();
    expect(createBody.success).toBe(true);
    const person = createBody.person;
    expect(person.name).toBe(`E2E Lifecycle ${ts}`);
    expect(person.phones).toHaveLength(1);
    expect(person.phones[0].value).toBe('555-1234');
    expect(person.emails).toHaveLength(1);
    expect(person.organization).toBe('Lifecycle Corp');
    expect(person.address).toBe('456 Main St');
    expect(person.notes).toBe('Test notes');
    expect(person.id).toBeGreaterThan(0);
    expect(person.created_at).toBeTruthy();
    const personId = person.id;

    // GET by ID — verify all fields + roles array
    const getRes = await page.request.get(`/api/v1/persons/${personId}`);
    expect(getRes.ok()).toBeTruthy();
    const getBody = await getRes.json();
    expect(getBody.success).toBe(true);
    expect(getBody.person.name).toBe(`E2E Lifecycle ${ts}`);
    expect(getBody.person.organization).toBe('Lifecycle Corp');
    expect(Array.isArray(getBody.person.roles)).toBeTruthy();

    // UPDATE — change name and organization
    const updateRes = await page.request.put(`/api/v1/persons/${personId}`, {
      data: {
        name: `E2E Updated ${ts}`,
        organization: 'Updated Corp',
      },
    });
    expect(updateRes.ok()).toBeTruthy();
    const updateBody = await updateRes.json();
    expect(updateBody.success).toBe(true);
    expect(updateBody.person.name).toBe(`E2E Updated ${ts}`);
    expect(updateBody.person.organization).toBe('Updated Corp');
    // Unchanged fields should persist
    expect(updateBody.person.address).toBe('456 Main St');

    // ARCHIVE
    const archiveRes = await page.request.post(`/api/v1/persons/${personId}/archive`);
    expect(archiveRes.ok()).toBeTruthy();
    const archiveBody = await archiveRes.json();
    expect(archiveBody.success).toBe(true);
    expect(archiveBody.person.archived).toBe(true);

    // DELETE
    const deleteRes = await page.request.delete(`/api/v1/persons/${personId}`);
    expect(deleteRes.ok()).toBeTruthy();
    const deleteBody = await deleteRes.json();
    expect(deleteBody.success).toBe(true);

    // Verify 404 on get after delete
    const gone = await page.request.get(`/api/v1/persons/${personId}`);
    expect(gone.status()).toBe(404);
  });

  test('search by name and organization', async ({ page }) => {
    const ts = Date.now();
    const person = await createTestPerson(page, `search-${ts}`);
    const personId = person.id;

    // Search by partial name
    const nameRes = await page.request.get(`/api/v1/persons?name=E2E+Person+search-${ts}`);
    expect(nameRes.ok()).toBeTruthy();
    const nameData = await nameRes.json();
    expect(nameData.total).toBeGreaterThanOrEqual(1);
    expect(nameData.persons.some((p: any) => p.id === personId)).toBeTruthy();

    // Search by organization
    const orgRes = await page.request.get(`/api/v1/persons?organization=Test+Org+search-${ts}`);
    expect(orgRes.ok()).toBeTruthy();
    const orgData = await orgRes.json();
    expect(orgData.total).toBeGreaterThanOrEqual(1);

    // Cleanup
    await page.request.delete(`/api/v1/persons/${personId}`);
  });

  test('search with include_roles', async ({ page }) => {
    const res = await page.request.get('/api/v1/persons?limit=3&include_roles=true');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    // Every person in the result should have a roles array
    for (const p of data.persons) {
      expect(Array.isArray(p.roles)).toBeTruthy();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CASE-PERSON ROLE ASSIGNMENTS
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Case-Person role assignments', () => {

  test('assign person to case, get case persons, update assignment, remove', async ({ page }) => {
    const caseId = await getFirstCaseId(page);
    const role = await getFirstRoleId(page);
    const person = await createTestPerson(page, 'assign');
    const personId = person.id;

    // ASSIGN person to case
    const assignRes = await page.request.post(`/api/v1/cases/${caseId}/persons`, {
      data: {
        person_id: personId,
        role_id: role.id,
        notes: 'Test assignment',
        is_primary: true,
      },
    });
    expect(assignRes.ok()).toBeTruthy();
    const assignBody = await assignRes.json();
    expect(assignBody.success).toBe(true);
    const assignment = assignBody.assignment;
    expect(assignment.id).toBe(personId);
    expect(assignment.role_id).toBe(role.id);
    expect(assignment.is_primary).toBe(true);
    expect(assignment.role_notes).toBe('Test assignment');
    expect(assignment.role).toBeDefined();
    expect(assignment.role.id).toBe(role.id);
    expect(assignment.role.name).toBe(role.name);
    const assignmentId = assignment.assignment_id;

    // GET case persons
    const listRes = await page.request.get(`/api/v1/cases/${caseId}/persons`);
    expect(listRes.ok()).toBeTruthy();
    const listBody = await listRes.json();
    expect(listBody.success).toBe(true);
    expect(Array.isArray(listBody.persons)).toBeTruthy();
    const found = listBody.persons.find((p: any) => p.id === personId);
    expect(found).toBeDefined();
    expect(found.role.id).toBe(role.id);

    // UPDATE assignment
    const updateRes = await page.request.put(`/api/v1/cases/${caseId}/person-roles/${assignmentId}`, {
      data: {
        notes: 'Updated notes',
        is_primary: false,
      },
    });
    expect(updateRes.ok()).toBeTruthy();
    const updateBody = await updateRes.json();
    expect(updateBody.success).toBe(true);
    expect(updateBody.assignment.role_notes).toBe('Updated notes');
    expect(updateBody.assignment.is_primary).toBe(false);

    // REMOVE person from case
    const removeRes = await page.request.delete(`/api/v1/cases/${caseId}/persons/${personId}?role_id=${role.id}`);
    expect(removeRes.ok()).toBeTruthy();
    const removeBody = await removeRes.json();
    expect(removeBody.success).toBe(true);

    // Verify removed
    const verifyRes = await page.request.get(`/api/v1/cases/${caseId}/persons`);
    const verifyBody = await verifyRes.json();
    const stillThere = verifyBody.persons.find((p: any) => p.id === personId && p.role_id === role.id);
    expect(stillThere).toBeUndefined();

    // Cleanup
    await page.request.delete(`/api/v1/persons/${personId}`);
  });

  test('re-assign same person+role updates existing assignment (upsert)', async ({ page }) => {
    const caseId = await getFirstCaseId(page);
    const role = await getFirstRoleId(page);
    const person = await createTestPerson(page, 'upsert');
    const personId = person.id;

    // First assignment
    const res1 = await page.request.post(`/api/v1/cases/${caseId}/persons`, {
      data: { person_id: personId, role_id: role.id, notes: 'First' },
    });
    expect(res1.ok()).toBeTruthy();
    const body1 = await res1.json();
    const firstAssignmentId = body1.assignment.assignment_id;

    // Re-assign same person+role — should update, not duplicate
    const res2 = await page.request.post(`/api/v1/cases/${caseId}/persons`, {
      data: { person_id: personId, role_id: role.id, notes: 'Second' },
    });
    expect(res2.ok()).toBeTruthy();
    const body2 = await res2.json();
    expect(body2.assignment.assignment_id).toBe(firstAssignmentId);
    expect(body2.assignment.role_notes).toBe('Second');

    // Cleanup
    await page.request.delete(`/api/v1/cases/${caseId}/persons/${personId}`);
    await page.request.delete(`/api/v1/persons/${personId}`);
  });

  test('change person role on case', async ({ page }) => {
    const caseId = await getFirstCaseId(page);
    const roles = await page.request.get('/api/v1/roles');
    const rolesData = await roles.json();
    // Need at least two different roles
    expect(rolesData.roles.length).toBeGreaterThanOrEqual(2);
    const role1 = rolesData.roles[0];
    const role2 = rolesData.roles[1];

    const person = await createTestPerson(page, 'changerole');
    const personId = person.id;

    // Assign with role1
    const assignRes = await page.request.post(`/api/v1/cases/${caseId}/persons`, {
      data: { person_id: personId, role_id: role1.id },
    });
    expect(assignRes.ok()).toBeTruthy();

    // Change to role2
    const changeRes = await page.request.patch(`/api/v1/cases/${caseId}/persons/${personId}/change-role`, {
      data: { old_role_id: role1.id, new_role_id: role2.id },
    });
    expect(changeRes.ok()).toBeTruthy();
    const changeBody = await changeRes.json();
    expect(changeBody.success).toBe(true);
    expect(changeBody.assignment.role_id).toBe(role2.id);
    expect(changeBody.assignment.role.id).toBe(role2.id);

    // Cleanup
    await page.request.delete(`/api/v1/cases/${caseId}/persons/${personId}`);
    await page.request.delete(`/api/v1/persons/${personId}`);
  });

  test('filter case persons by category', async ({ page }) => {
    const caseId = await getFirstCaseId(page);

    // Get persons filtered by category (if any exist)
    const res = await page.request.get(`/api/v1/cases/${caseId}/persons?category=client`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.persons)).toBeTruthy();
    // All returned persons should be in the client category
    for (const p of body.persons) {
      expect(p.role.category).toBe('client');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DUPLICATE DETECTION & MERGE
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Duplicate detection and merge', () => {

  test('find duplicates endpoint returns groups', async ({ page }) => {
    const ts = Date.now();
    const dupName = `E2E Duplicate ${ts}`;

    // Create two persons with the same name
    const res1 = await page.request.post('/api/v1/persons', {
      data: { name: dupName, organization: 'Org A' },
    });
    const body1 = await res1.json();
    const id1 = body1.person.id;

    const res2 = await page.request.post('/api/v1/persons', {
      data: { name: dupName, organization: 'Org B' },
    });
    const body2 = await res2.json();
    const id2 = body2.person.id;

    // Check duplicates
    const dupRes = await page.request.get('/api/v1/persons/duplicates');
    expect(dupRes.ok()).toBeTruthy();
    const dupData = await dupRes.json();
    expect(dupData).toHaveProperty('groups');
    expect(dupData).toHaveProperty('total');

    // Find our duplicate group
    const ourGroup = dupData.groups.find((g: any) =>
      g.persons.some((p: any) => p.id === id1) && g.persons.some((p: any) => p.id === id2)
    );
    expect(ourGroup).toBeDefined();
    expect(ourGroup.has_conflicts).toBe(true); // different organizations

    // Cleanup
    await page.request.delete(`/api/v1/persons/${id1}`);
    await page.request.delete(`/api/v1/persons/${id2}`);
  });

  test('preview merge and execute merge', async ({ page }) => {
    const ts = Date.now();

    // Create primary and secondary persons
    const res1 = await page.request.post('/api/v1/persons', {
      data: {
        name: `E2E Merge Primary ${ts}`,
        phones: [{ value: '555-0001', label: 'Work' }],
        emails: [{ value: `primary-${ts}@test.com`, label: 'Work' }],
        organization: 'Primary Org',
        notes: 'Primary notes',
      },
    });
    const primary = (await res1.json()).person;

    const res2 = await page.request.post('/api/v1/persons', {
      data: {
        name: `E2E Merge Secondary ${ts}`,
        phones: [{ value: '555-0002', label: 'Home' }],
        emails: [{ value: `secondary-${ts}@test.com`, label: 'Home' }],
        organization: 'Secondary Org',
        notes: 'Secondary notes',
      },
    });
    const secondary = (await res2.json()).person;

    // PREVIEW merge
    const previewRes = await page.request.get(
      `/api/v1/persons/merge-preview?primary_id=${primary.id}&secondary_id=${secondary.id}`
    );
    expect(previewRes.ok()).toBeTruthy();
    const preview = await previewRes.json();
    expect(preview.primary.id).toBe(primary.id);
    expect(preview.secondary.id).toBe(secondary.id);
    expect(preview.conflicts).toBeDefined();
    expect(preview.conflicts.field_conflicts.length).toBeGreaterThan(0); // different organizations
    expect(preview).toHaveProperty('auto_mergeable');

    // MERGE — resolve organization to primary
    const mergeRes = await page.request.post('/api/v1/persons/merge', {
      data: {
        primary_id: primary.id,
        secondary_id: secondary.id,
        field_resolutions: { organization: 'primary', name: 'primary' },
      },
    });
    expect(mergeRes.ok()).toBeTruthy();
    const mergeBody = await mergeRes.json();
    expect(mergeBody.success).toBe(true);
    const merged = mergeBody.person;
    expect(merged.id).toBe(primary.id);
    expect(merged.organization).toBe('Primary Org');
    // Phones should be merged (union)
    expect(merged.phones.length).toBe(2);
    // Emails should be merged (union)
    expect(merged.emails.length).toBe(2);
    // Notes should be concatenated by default
    expect(merged.notes).toContain('Primary notes');
    expect(merged.notes).toContain('Secondary notes');

    // Secondary should be gone
    const goneRes = await page.request.get(`/api/v1/persons/${secondary.id}`);
    expect(goneRes.status()).toBe(404);

    // Cleanup
    await page.request.delete(`/api/v1/persons/${primary.id}`);
  });
});
