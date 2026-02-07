import { test, expect } from '@playwright/test';

// ─── Auth helper ──────────────────────────────────────────────────────────────
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page).not.toHaveURL(/login/, { timeout: 15000 });
  await expect(page.getByRole('link', { name: /^cases$/i })).toBeVisible({ timeout: 5000 });
});

// ─── Shared helpers ───────────────────────────────────────────────────────────
async function getFirstCaseId(page): Promise<number> {
  const res = await page.request.get('/api/v1/cases');
  const data = await res.json();
  const id = Array.isArray(data) ? data[0]?.id : data.cases?.[0]?.id;
  expect(id).toBeDefined();
  return id;
}

async function getFirstUserId(page): Promise<number> {
  const res = await page.request.get('/api/v1/users');
  const data = await res.json();
  const users = Array.isArray(data) ? data : (data.data ?? data.users);
  expect(users.length).toBeGreaterThan(0);
  return users[0].id;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function futureDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Events — CRUD lifecycle', () => {

  test('create, read, update, delete event', async ({ page }) => {
    const caseId = await getFirstCaseId(page);
    const ts = Date.now();

    // --- CREATE ---
    const createRes = await page.request.post('/api/v1/events', {
      data: {
        case_id: caseId,
        date: futureDate(7),
        description: `E2E Event ${ts}`,
        time: '09:30',
        location: 'Courtroom 5',
        starred: false,
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const { event: created } = await createRes.json();
    expect(created.id).toBeGreaterThan(0);
    expect(created.case_id).toBe(caseId);
    expect(created.description).toBe(`E2E Event ${ts}`);
    expect(created.date).toBe(futureDate(7));
    expect(created.time).toBe('09:30');
    expect(created.location).toBe('Courtroom 5');
    expect(created.starred).toBe(false);
    const eventId = created.id;

    // --- READ ---
    const getRes = await page.request.get(`/api/v1/events/${eventId}`);
    expect(getRes.ok()).toBeTruthy();
    const { event: fetched } = await getRes.json();
    expect(fetched.id).toBe(eventId);
    expect(fetched.description).toBe(`E2E Event ${ts}`);
    expect(fetched.case_name).toBeTruthy();
    expect(fetched.attendees).toBeDefined();
    expect(Array.isArray(fetched.attendees)).toBeTruthy();

    // --- UPDATE ---
    const updateRes = await page.request.put(`/api/v1/events/${eventId}`, {
      data: { description: `E2E Event ${ts} Updated`, starred: true },
    });
    expect(updateRes.ok()).toBeTruthy();
    const { event: updated } = await updateRes.json();
    expect(updated.description).toBe(`E2E Event ${ts} Updated`);
    expect(updated.starred).toBe(true);
    // Unchanged fields should persist
    expect(updated.time).toBe('09:30');
    expect(updated.location).toBe('Courtroom 5');

    // --- DELETE ---
    const deleteRes = await page.request.delete(`/api/v1/events/${eventId}`);
    expect(deleteRes.ok()).toBeTruthy();

    // Verify gone
    const getDeleted = await page.request.get(`/api/v1/events/${eventId}`);
    expect(getDeleted.status()).toBe(404);
  });

  test('GET /api/v1/events returns list with date, description', async ({ page }) => {
    const res = await page.request.get('/api/v1/events');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data).toHaveProperty('events');
    expect(data).toHaveProperty('total');
    expect(Array.isArray(data.events)).toBeTruthy();
    if (data.events.length > 0) {
      expect(data.events[0]).toHaveProperty('date');
      expect(data.events[0]).toHaveProperty('description');
    }
  });

  test('search events by query', async ({ page }) => {
    const caseId = await getFirstCaseId(page);
    const ts = Date.now();
    const searchTerm = `SearchableEvt${ts}`;

    // Create event with unique description
    const createRes = await page.request.post('/api/v1/events', {
      data: { case_id: caseId, date: futureDate(5), description: searchTerm },
    });
    expect(createRes.ok()).toBeTruthy();
    const eventId = (await createRes.json()).event.id;

    // Search
    const searchRes = await page.request.get(`/api/v1/events/search?q=${searchTerm}`);
    expect(searchRes.ok()).toBeTruthy();
    const { events } = await searchRes.json();
    expect(events.length).toBeGreaterThan(0);
    expect(events.some((e: { description: string }) => e.description === searchTerm)).toBeTruthy();

    // Cleanup
    await page.request.delete(`/api/v1/events/${eventId}`);
  });

  test('404 for nonexistent event', async ({ page }) => {
    const res = await page.request.get('/api/v1/events/99999');
    expect(res.status()).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT ATTENDEES
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Event Attendees', () => {

  test('add and remove attendee', async ({ page }) => {
    const caseId = await getFirstCaseId(page);
    const userId = await getFirstUserId(page);
    const ts = Date.now();

    // Create event
    const createRes = await page.request.post('/api/v1/events', {
      data: { case_id: caseId, date: futureDate(10), description: `Attendee test ${ts}` },
    });
    expect(createRes.ok()).toBeTruthy();
    const eventId = (await createRes.json()).event.id;

    // Add attendee
    const addRes = await page.request.post(`/api/v1/events/${eventId}/attendees/${userId}`);
    expect(addRes.ok()).toBeTruthy();

    // Verify attendee is present
    const getRes = await page.request.get(`/api/v1/events/${eventId}/attendees`);
    expect(getRes.ok()).toBeTruthy();
    const { data: attendees } = await getRes.json();
    expect(attendees.length).toBeGreaterThan(0);
    expect(attendees.some((a: { id: number }) => a.id === userId)).toBeTruthy();

    // Verify via event detail
    const detailRes = await page.request.get(`/api/v1/events/${eventId}`);
    const detail = await detailRes.json();
    expect(detail.event.attendees.length).toBeGreaterThan(0);

    // Remove attendee
    const removeRes = await page.request.delete(`/api/v1/events/${eventId}/attendees/${userId}`);
    expect(removeRes.ok()).toBeTruthy();

    // Verify removed
    const getRes2 = await page.request.get(`/api/v1/events/${eventId}/attendees`);
    const { data: attendees2 } = await getRes2.json();
    expect(attendees2.every((a: { id: number }) => a.id !== userId)).toBeTruthy();

    // Cleanup
    await page.request.delete(`/api/v1/events/${eventId}`);
  });

  test('adding same attendee twice is idempotent', async ({ page }) => {
    const caseId = await getFirstCaseId(page);
    const userId = await getFirstUserId(page);
    const ts = Date.now();

    const createRes = await page.request.post('/api/v1/events', {
      data: { case_id: caseId, date: futureDate(10), description: `Idempotent test ${ts}` },
    });
    const eventId = (await createRes.json()).event.id;

    // Add twice
    await page.request.post(`/api/v1/events/${eventId}/attendees/${userId}`);
    await page.request.post(`/api/v1/events/${eventId}/attendees/${userId}`);

    // Should still be only one entry
    const getRes = await page.request.get(`/api/v1/events/${eventId}/attendees`);
    const { data: attendees } = await getRes.json();
    const count = attendees.filter((a: { id: number }) => a.id === userId).length;
    expect(count).toBe(1);

    // Cleanup
    await page.request.delete(`/api/v1/events/${eventId}`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TASKS
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Tasks — CRUD lifecycle', () => {

  test('create, read, update, delete task', async ({ page }) => {
    const caseId = await getFirstCaseId(page);
    const ts = Date.now();

    // --- CREATE ---
    const createRes = await page.request.post('/api/v1/tasks', {
      data: {
        case_id: caseId,
        description: `E2E Task ${ts}`,
        due_date: futureDate(3),
        status: 'Pending',
        urgency: 'Medium',
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const { task: created } = await createRes.json();
    expect(created.id).toBeGreaterThan(0);
    expect(created.case_id).toBe(caseId);
    expect(created.description).toBe(`E2E Task ${ts}`);
    expect(created.status).toBe('Pending');
    expect(created.urgency).toBe('Medium');
    expect(created.sort_order).toBeGreaterThan(0);
    expect(created.completion_date).toBeNull();
    const taskId = created.id;

    // --- READ (via list) ---
    const listRes = await page.request.get(`/api/v1/tasks?case_id=${caseId}`);
    expect(listRes.ok()).toBeTruthy();
    const listData = await listRes.json();
    expect(listData).toHaveProperty('tasks');
    expect(listData).toHaveProperty('total');
    const found = listData.tasks.find((t: { id: number }) => t.id === taskId);
    expect(found).toBeTruthy();
    expect(found.description).toBe(`E2E Task ${ts}`);

    // --- UPDATE ---
    const updateRes = await page.request.put(`/api/v1/tasks/${taskId}`, {
      data: { description: `E2E Task ${ts} Updated`, urgency: 'High' },
    });
    expect(updateRes.ok()).toBeTruthy();
    const { task: updated } = await updateRes.json();
    expect(updated.description).toBe(`E2E Task ${ts} Updated`);
    expect(updated.urgency).toBe('High');

    // --- DELETE ---
    const deleteRes = await page.request.delete(`/api/v1/tasks/${taskId}`);
    expect(deleteRes.ok()).toBeTruthy();

    // Verify gone
    const deleteAgain = await page.request.delete(`/api/v1/tasks/${taskId}`);
    expect(deleteAgain.status()).toBe(404);
  });

  test('GET /api/v1/tasks returns list with description, status, urgency', async ({ page }) => {
    const res = await page.request.get('/api/v1/tasks');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data).toHaveProperty('tasks');
    expect(data).toHaveProperty('total');
    expect(Array.isArray(data.tasks)).toBeTruthy();
    if (data.tasks.length > 0) {
      expect(data.tasks[0]).toHaveProperty('description');
      expect(data.tasks[0]).toHaveProperty('status');
      expect(data.tasks[0]).toHaveProperty('urgency');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TASK — Completion date auto-management
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Tasks — completion date auto-management', () => {

  test('marking task as Done auto-sets completion_date', async ({ page }) => {
    const caseId = await getFirstCaseId(page);
    const ts = Date.now();

    // Create a Pending task
    const createRes = await page.request.post('/api/v1/tasks', {
      data: { case_id: caseId, description: `Done test ${ts}`, status: 'Pending' },
    });
    const taskId = (await createRes.json()).task.id;

    // Mark as Done
    const updateRes = await page.request.put(`/api/v1/tasks/${taskId}`, {
      data: { status: 'Done' },
    });
    expect(updateRes.ok()).toBeTruthy();
    const { task } = await updateRes.json();
    expect(task.status).toBe('Done');
    expect(task.completion_date).toBeTruthy();
    // Verify it's a valid date (server timezone may differ from browser)
    expect(task.completion_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Cleanup
    await page.request.delete(`/api/v1/tasks/${taskId}`);
  });

  test('changing status away from Done clears completion_date', async ({ page }) => {
    const caseId = await getFirstCaseId(page);
    const ts = Date.now();

    // Create as Done
    const createRes = await page.request.post('/api/v1/tasks', {
      data: { case_id: caseId, description: `Undone test ${ts}`, status: 'Done' },
    });
    const { task: created } = await createRes.json();
    expect(created.completion_date).toBeTruthy();
    const taskId = created.id;

    // Change to Pending
    const updateRes = await page.request.put(`/api/v1/tasks/${taskId}`, {
      data: { status: 'Pending' },
    });
    expect(updateRes.ok()).toBeTruthy();
    const { task: updated } = await updateRes.json();
    expect(updated.status).toBe('Pending');
    expect(updated.completion_date).toBeNull();

    // Cleanup
    await page.request.delete(`/api/v1/tasks/${taskId}`);
  });

  test('creating task with status Done auto-sets completion_date', async ({ page }) => {
    const caseId = await getFirstCaseId(page);
    const ts = Date.now();

    const createRes = await page.request.post('/api/v1/tasks', {
      data: { case_id: caseId, description: `Created Done ${ts}`, status: 'Done' },
    });
    expect(createRes.ok()).toBeTruthy();
    const { task } = await createRes.json();
    expect(task.status).toBe('Done');
    expect(task.completion_date).toBeTruthy();
    // Verify it's a valid date (server timezone may differ from browser)
    expect(task.completion_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Cleanup
    await page.request.delete(`/api/v1/tasks/${task.id}`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TASK — Reorder
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Tasks — reorder', () => {

  test('reorder changes sort_order', async ({ page }) => {
    const caseId = await getFirstCaseId(page);
    const ts = Date.now();

    // Create task
    const createRes = await page.request.post('/api/v1/tasks', {
      data: { case_id: caseId, description: `Reorder test ${ts}` },
    });
    const taskId = (await createRes.json()).task.id;

    // Reorder
    const reorderRes = await page.request.post('/api/v1/tasks/reorder', {
      data: { task_id: taskId, sort_order: 42 },
    });
    expect(reorderRes.ok()).toBeTruthy();
    const { task } = await reorderRes.json();
    expect(task.sort_order).toBe(42);

    // Cleanup
    await page.request.delete(`/api/v1/tasks/${taskId}`);
  });

  test('reorder with urgency change', async ({ page }) => {
    const caseId = await getFirstCaseId(page);
    const ts = Date.now();

    const createRes = await page.request.post('/api/v1/tasks', {
      data: { case_id: caseId, description: `Reorder urgency ${ts}`, urgency: 'Low' },
    });
    const taskId = (await createRes.json()).task.id;

    const reorderRes = await page.request.post('/api/v1/tasks/reorder', {
      data: { task_id: taskId, sort_order: 100, urgency: 'Urgent' },
    });
    expect(reorderRes.ok()).toBeTruthy();
    const { task } = await reorderRes.json();
    expect(task.sort_order).toBe(100);
    expect(task.urgency).toBe('Urgent');

    // Cleanup
    await page.request.delete(`/api/v1/tasks/${taskId}`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EVENTS — delete cascades to tasks
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Events — cascade delete', () => {

  test('deleting event also deletes its linked tasks', async ({ page }) => {
    const caseId = await getFirstCaseId(page);
    const ts = Date.now();

    // Create event
    const eventRes = await page.request.post('/api/v1/events', {
      data: { case_id: caseId, date: futureDate(14), description: `Cascade test ${ts}` },
    });
    const eventId = (await eventRes.json()).event.id;

    // Create task linked to event
    const taskRes = await page.request.post('/api/v1/tasks', {
      data: { case_id: caseId, description: `Linked task ${ts}`, event_id: eventId },
    });
    const taskId = (await taskRes.json()).task.id;

    // Verify task exists
    const listBefore = await page.request.get(`/api/v1/tasks?case_id=${caseId}`);
    const tasksBefore = (await listBefore.json()).tasks;
    expect(tasksBefore.some((t: { id: number }) => t.id === taskId)).toBeTruthy();

    // Delete event (should cascade to tasks)
    const deleteRes = await page.request.delete(`/api/v1/events/${eventId}`);
    expect(deleteRes.ok()).toBeTruthy();

    // Verify task is gone
    const listAfter = await page.request.get(`/api/v1/tasks?case_id=${caseId}`);
    const tasksAfter = (await listAfter.json()).tasks;
    expect(tasksAfter.every((t: { id: number }) => t.id !== taskId)).toBeTruthy();
  });
});
