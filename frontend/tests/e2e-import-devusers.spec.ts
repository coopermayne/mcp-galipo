import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5175';

test.use({ baseURL: BASE_URL });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page).not.toHaveURL(/login/, { timeout: 15000 });
  await expect(page.getByRole('link', { name: /^cases$/i })).toBeVisible({ timeout: 5000 });
});

// ---------------------------------------------------------------------------
// 1. Dev Users — verify seeded users
// ---------------------------------------------------------------------------

test.describe('Dev Users — seeded user verification', () => {
  test('seeded dev users exist and have correct properties', async ({ page }) => {
    // GET all users
    const res = await page.request.get('/api/v1/users');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);

    const users = body.data;
    expect(users.length).toBeGreaterThanOrEqual(14); // At least 14 dev users

    // Check specific attorney exists with correct fields
    const cooper = users.find((u: any) => u.email === 'cmayne@galipolaw.com');
    expect(cooper).toBeTruthy();
    expect(cooper.firstName).toBe('Cooper');
    expect(cooper.lastName).toBe('Mayne');
    expect(cooper.initials).toBe('CM');
    expect(cooper.position).toBe('attorney');
    expect(cooper.isAdmin).toBe(true);
    expect(cooper.isActive).toBe(true);
    expect(cooper.barNumber).toBe('343169');

    // Check specific paralegal exists
    const darci = users.find((u: any) => u.email === 'dgilbert@galipolaw.com');
    expect(darci).toBeTruthy();
    expect(darci.firstName).toBe('Darci');
    expect(darci.lastName).toBe('Gilbert');
    expect(darci.position).toBe('paralegal');
    expect(darci.isAdmin).toBe(false);

    // Check manager exists
    const dave = users.find((u: any) => u.email === 'davegalipo@galipolaw.com');
    expect(dave).toBeTruthy();
    expect(dave.position).toBe('manager');
  });

  test('attorney-paralegal relationships are set correctly', async ({ page }) => {
    const res = await page.request.get('/api/v1/users');
    const body = await res.json();
    const users = body.data;

    // Cooper Mayne should have Darci Gilbert as paralegal
    const cooper = users.find((u: any) => u.email === 'cmayne@galipolaw.com');
    const darci = users.find((u: any) => u.email === 'dgilbert@galipolaw.com');
    expect(cooper).toBeTruthy();
    expect(darci).toBeTruthy();
    expect(cooper.paralegalId).toBe(darci.id);

    // Hang Lee should have Santiago Laurel as paralegal
    const hang = users.find((u: any) => u.email === 'hlee@galipolaw.com');
    const santiago = users.find((u: any) => u.email === 'slaurel@galipolaw.com');
    expect(hang).toBeTruthy();
    expect(santiago).toBeTruthy();
    expect(hang.paralegalId).toBe(santiago.id);
  });

  test('all expected positions are represented', async ({ page }) => {
    const res = await page.request.get('/api/v1/users');
    const body = await res.json();
    const users = body.data;

    const positions = new Set(users.map((u: any) => u.position));
    expect(positions.has('attorney')).toBe(true);
    expect(positions.has('paralegal')).toBe(true);
    expect(positions.has('manager')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Case Creation + Attorney Assignment (import_case building blocks)
// ---------------------------------------------------------------------------

test.describe('Case creation and attorney assignment', () => {
  let caseId: number;

  test.afterAll(async ({ request }) => {
    if (caseId) {
      await request.delete(`/api/v1/cases/${caseId}`);
    }
  });

  test('create case, assign attorney, verify paralegal auto-assigned', async ({ page }) => {
    const ts = Date.now();

    // Step 1: Create a case
    const createRes = await page.request.post('/api/v1/cases', {
      data: {
        case_name: `E2E Import Test ${ts}`,
        short_name: `IMP-${ts}`,
        status: 'Signing Up',
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const createBody = await createRes.json();
    expect(createBody.success).toBe(true);
    caseId = createBody.case.id;
    expect(caseId).toBeDefined();

    // Step 2: Find an attorney with a paralegal
    const usersRes = await page.request.get('/api/v1/users');
    const usersBody = await usersRes.json();
    const users = usersBody.data;

    // Find Cooper Mayne (attorney with paralegal)
    const attorney = users.find((u: any) => u.email === 'cmayne@galipolaw.com');
    expect(attorney).toBeTruthy();
    expect(attorney.paralegalId).toBeTruthy();

    // Step 3: Assign attorney to case
    const assignRes = await page.request.post(
      `/api/v1/cases/${caseId}/attorneys/${attorney.id}`
    );
    expect(assignRes.ok()).toBeTruthy();
    const assignBody = await assignRes.json();
    expect(assignBody.success).toBe(true);

    // Step 4: Verify case has attorney and auto-assigned paralegal
    const caseRes = await page.request.get(`/api/v1/cases/${caseId}`);
    expect(caseRes.ok()).toBeTruthy();
    const caseBody = await caseRes.json();

    expect(caseBody.attorney_ids).toContain(attorney.id);
    expect(caseBody.paralegal_ids).toContain(attorney.paralegalId);

    // Step 5: Get case users and verify both show up
    const caseUsersRes = await page.request.get(`/api/v1/cases/${caseId}/users`);
    expect(caseUsersRes.ok()).toBeTruthy();
    const caseUsersBody = await caseUsersRes.json();
    expect(caseUsersBody.success).toBe(true);

    const attorneys = caseUsersBody.data.attorneys || [];
    const paralegals = caseUsersBody.data.paralegals || [];
    expect(attorneys.some((a: any) => a.id === attorney.id)).toBe(true);
    expect(paralegals.some((p: any) => p.id === attorney.paralegalId)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Case with Events and Tasks (import_case entity creation pattern)
// ---------------------------------------------------------------------------

test.describe('Case with events and tasks (import building blocks)', () => {
  let caseId: number;

  test.afterAll(async ({ request }) => {
    if (caseId) {
      await request.delete(`/api/v1/cases/${caseId}`);
    }
  });

  test('create case with events and linked tasks', async ({ page }) => {
    const ts = Date.now();
    const futureDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    // Step 1: Create a case
    const caseRes = await page.request.post('/api/v1/cases', {
      data: {
        case_name: `E2E Import Entities ${ts}`,
        short_name: `ENT-${ts}`,
        status: 'Discovery',
      },
    });
    expect(caseRes.ok()).toBeTruthy();
    const caseBody = await caseRes.json();
    caseId = caseBody.case.id;

    // Step 2: Create an event linked to the case
    const eventRes = await page.request.post('/api/v1/events', {
      data: {
        case_id: caseId,
        date: futureDate,
        description: `Hearing for import test ${ts}`,
        time: '10:00',
        location: 'Courtroom 4B',
      },
    });
    expect(eventRes.ok()).toBeTruthy();
    const eventBody = await eventRes.json();
    expect(eventBody.success).toBe(true);
    const eventId = eventBody.event.id;
    expect(eventId).toBeDefined();

    // Step 3: Create a task linked to the event
    const taskRes = await page.request.post('/api/v1/tasks', {
      data: {
        case_id: caseId,
        description: `Prepare documents for hearing ${ts}`,
        event_id: eventId,
        status: 'Pending',
        urgency: 'High',
        due_date: futureDate,
      },
    });
    expect(taskRes.ok()).toBeTruthy();
    const taskBody = await taskRes.json();
    expect(taskBody.success).toBe(true);
    expect(taskBody.task.id).toBeDefined();
    expect(taskBody.task.event_id).toBe(eventId);

    // Step 4: Verify event has linked tasks
    const eventTasksRes = await page.request.get(`/api/v1/events/${eventId}/tasks`);
    expect(eventTasksRes.ok()).toBeTruthy();
    const eventTasksBody = await eventTasksRes.json();
    const eventTasks = eventTasksBody.tasks;
    expect(eventTasks.length).toBeGreaterThanOrEqual(1);
    expect(eventTasks.some((t: any) => t.description.includes(`${ts}`))).toBe(true);

    // Step 5: Verify case deletion cascades (events + tasks cleaned up)
    const deleteRes = await page.request.delete(`/api/v1/cases/${caseId}`);
    expect(deleteRes.ok()).toBeTruthy();

    // Event should be gone
    const eventCheckRes = await page.request.get(`/api/v1/events/${eventId}`);
    expect(eventCheckRes.status()).toBe(404);

    // Mark as cleaned up so afterAll doesn't try again
    caseId = 0;
  });
});

// ---------------------------------------------------------------------------
// 4. Persons and Roles (import_case person creation pattern)
// ---------------------------------------------------------------------------

test.describe('Persons and roles (import building blocks)', () => {
  let personId: number;
  let caseId: number;

  test.afterAll(async ({ request }) => {
    if (personId) {
      await request.delete(`/api/v1/persons/${personId}`);
    }
    if (caseId) {
      await request.delete(`/api/v1/cases/${caseId}`);
    }
  });

  test('create person and assign role to case', async ({ page }) => {
    const ts = Date.now();

    // Step 1: Create a case for person assignment
    const caseRes = await page.request.post('/api/v1/cases', {
      data: {
        case_name: `E2E Person Test ${ts}`,
        status: 'Signing Up',
      },
    });
    const caseBody = await caseRes.json();
    caseId = caseBody.case.id;

    // Step 2: Get available roles
    const rolesRes = await page.request.get('/api/v1/roles');
    expect(rolesRes.ok()).toBeTruthy();
    const rolesBody = await rolesRes.json();
    expect(rolesBody.success).toBe(true);
    const roles = rolesBody.roles;
    expect(Array.isArray(roles)).toBe(true);
    expect(roles.length).toBeGreaterThan(0);

    // Find "plaintiff" role (the client category role)
    const plaintiffRole = roles.find((r: any) => r.name === 'plaintiff');
    expect(plaintiffRole).toBeTruthy();

    // Step 3: Create a person
    const personRes = await page.request.post('/api/v1/persons', {
      data: {
        name: `Test Person ${ts}`,
        phones: [{ value: '555-0100', primary: true }],
        emails: [{ value: `test${ts}@example.com`, primary: true }],
        organization: 'Test Org',
      },
    });
    expect(personRes.ok()).toBeTruthy();
    const personBody = await personRes.json();
    expect(personBody.success).toBe(true);
    personId = personBody.person.id;
    expect(personId).toBeDefined();

    // Step 4: Assign person to case with role
    const assignRes = await page.request.post(`/api/v1/cases/${caseId}/persons`, {
      data: {
        person_id: personId,
        role_id: plaintiffRole.id,
      },
    });
    expect(assignRes.ok()).toBeTruthy();
    const assignBody = await assignRes.json();
    expect(assignBody.success).toBe(true);

    // Step 5: Verify person shows up in case persons
    const casePersonsRes = await page.request.get(`/api/v1/cases/${caseId}/persons`);
    expect(casePersonsRes.ok()).toBeTruthy();
    const casePersonsBody = await casePersonsRes.json();
    expect(casePersonsBody.success).toBe(true);
    const casePersons = casePersonsBody.persons;
    expect(Array.isArray(casePersons)).toBe(true);

    const assignedPerson = casePersons.find((p: any) =>
      p.name?.includes(`${ts}`) || p.person_name?.includes(`${ts}`)
    );
    expect(assignedPerson).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 5. Jurisdictions and Proceedings (import_case proceeding pattern)
// ---------------------------------------------------------------------------

test.describe('Jurisdictions and proceedings (import building blocks)', () => {
  let caseId: number;

  test.afterAll(async ({ request }) => {
    if (caseId) {
      await request.delete(`/api/v1/cases/${caseId}`);
    }
  });

  test('create proceeding with jurisdiction', async ({ page }) => {
    const ts = Date.now();

    // Step 1: Create a case
    const caseRes = await page.request.post('/api/v1/cases', {
      data: {
        case_name: `E2E Proceeding Test ${ts}`,
        status: 'Pre-Filing',
      },
    });
    const caseBody = await caseRes.json();
    caseId = caseBody.case.id;

    // Step 2: Get a jurisdiction
    const jurRes = await page.request.get('/api/v1/jurisdictions');
    expect(jurRes.ok()).toBeTruthy();
    const jurBody = await jurRes.json();
    const jurisdictions = jurBody.data ?? jurBody.jurisdictions ?? jurBody;
    expect(Array.isArray(jurisdictions)).toBe(true);
    expect(jurisdictions.length).toBeGreaterThan(0);
    const jurisdictionId = jurisdictions[0].id;

    // Step 3: Create a proceeding (route is /api/v1/cases/{case_id}/proceedings)
    const procRes = await page.request.post(`/api/v1/cases/${caseId}/proceedings`, {
      data: {
        case_number: `CV-${ts}`,
        jurisdiction_id: jurisdictionId,
        is_primary: true,
      },
    });
    expect(procRes.ok()).toBeTruthy();
    const procBody = await procRes.json();
    expect(procBody.success).toBe(true);
    const procId = procBody.proceeding.id;
    expect(procId).toBeDefined();

    // Step 4: Verify proceeding shows in case proceedings
    const getCaseProcsRes = await page.request.get(`/api/v1/cases/${caseId}/proceedings`);
    expect(getCaseProcsRes.ok()).toBeTruthy();
    const getCaseProcsBody = await getCaseProcsRes.json();
    expect(getCaseProcsBody.proceedings).toBeDefined();
    expect(getCaseProcsBody.proceedings.length).toBeGreaterThanOrEqual(1);

    // Verify our proceeding is there
    const ourProc = getCaseProcsBody.proceedings.find((p: any) => p.id === procId);
    expect(ourProc).toBeTruthy();
    expect(ourProc.case_number).toBe(`CV-${ts}`);
  });
});
