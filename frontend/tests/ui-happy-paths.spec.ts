/**
 * UI-Driven E2E Happy Path Tests
 *
 * Exercises the most-used flows by clicking buttons, filling forms,
 * and verifying the UI renders correctly. Each UI action is also
 * verified via API to confirm state persisted.
 *
 * Each test is fully independent — creates its own data via API,
 * exercises UI flows using test.step, and cleans up afterward.
 */
import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5175';
test.use({ baseURL: BASE_URL });

// ─── API helpers for test data setup/teardown ────────────────────────────

async function apiCreateCase(request: APIRequestContext, suffix: string) {
  const res = await request.post('/api/v1/cases', {
    data: {
      case_name: `UI-E2E Case ${suffix}`,
      status: 'Pre-Filing',
      short_name: `E2E${suffix}`,
      case_summary: 'Test case for UI E2E',
    },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body.case.id as number;
}

async function apiCreateTask(request: APIRequestContext, caseId: number, name: string) {
  const res = await request.post('/api/v1/tasks', {
    data: {
      case_id: caseId,
      description: name,
      status: 'Pending',
      urgency: 'Medium',
    },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body.task.id as number;
}

async function apiCreateEvent(request: APIRequestContext, caseId: number, name: string) {
  const today = new Date().toISOString().split('T')[0];
  const res = await request.post('/api/v1/events', {
    data: {
      case_id: caseId,
      description: name,
      date: today,
      starred: true,
    },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body.event.id as number;
}

async function apiDeleteCase(request: APIRequestContext, caseId: number) {
  await request.delete(`/api/v1/cases/${caseId}`);
}

// ─── Auth helper ────────────────────────────────────────────────────────

async function ensureAuthenticated(page: Page) {
  await page.goto('/');
  const isLoginPage = await page
    .locator('#username')
    .isVisible({ timeout: 2000 })
    .catch(() => false);
  if (isLoginPage) {
    const USERNAME = process.env.APP_EMAIL || 'cmayne@example.com';
    const PASSWORD = process.env.APP_PASSWORD || 'galipo2026';
    await page.locator('#username').fill(USERNAME);
    await page.locator('#password').fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
  }
  await expect(page).not.toHaveURL(/login/, { timeout: 15000 });
  await expect(page.getByRole('link', { name: /^cases$/i })).toBeVisible({ timeout: 5000 });
}

// ─── Tests ───────────────────────────────────────────────────────────────

test.describe('UI Happy Paths', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  // ── 1. Create a new case via the UI form ──────────────────────────────
  test('create a new case via the UI form', async ({ page }) => {
    const ts = Date.now();
    const caseName = `UI-E2E Case ${ts}`;
    let caseId: number;

    await page.goto('/cases');
    await expect(page).toHaveURL(/\/cases/);

    await test.step('fill and submit case creation form', async () => {
      await page.getByRole('button', { name: /add case/i }).click();
      const nameInput = page.getByPlaceholder(/enter case name/i);
      await expect(nameInput).toBeVisible({ timeout: 3000 });
      await nameInput.fill(caseName);
      await page.getByRole('button', { name: 'Create' }).click();
      await expect(page).toHaveURL(/\/cases\/\d+/, { timeout: 10000 });

      const url = page.url();
      const match = url.match(/\/cases\/(\d+)/);
      expect(match).toBeTruthy();
      caseId = parseInt(match![1], 10);
    });

    await test.step('verify case detail page renders correctly', async () => {
      await expect(page.getByText(caseName).first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole('button', { name: 'Overview', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Tasks', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Events', exact: true })).toBeVisible();
    });

    await test.step('verify case persisted via API', async () => {
      const res = await page.request.get(`/api/v1/cases/${caseId}`);
      expect(res.ok()).toBeTruthy();
      const data = await res.json();
      expect(data.case_name).toBe(caseName);
    });

    // Cleanup
    await apiDeleteCase(page.request, caseId);
  });

  // ── 2. Task creation and management ───────────────────────────────────
  test('create task via shortcut, change status, and edit details', async ({ page }) => {
    const ts = Date.now();
    const caseName = `UI-E2E Case ${ts}`;
    const taskName = `UI-E2E Task ${ts}`;
    const updatedTaskName = `UI-E2E Task Updated ${ts}`;
    const caseId = await apiCreateCase(page.request, String(ts));
    let taskId: number;

    await test.step('create task via Ctrl+T keyboard shortcut', async () => {
      await page.goto(`/cases/${caseId}`);
      await expect(page.getByText(caseName).first()).toBeVisible({ timeout: 5000 });

      await page.keyboard.press('Control+t');
      await expect(page.getByText('New Task')).toBeVisible({ timeout: 3000 });

      const titleInput = page.getByPlaceholder('Task name');
      await expect(titleInput).toBeVisible();
      await titleInput.fill(taskName);

      // Change priority to 1 (Urgent)
      await page.getByText('Priority 3').click();
      await page.getByText('Priority 1').click();

      await page.getByRole('button', { name: 'Create Task', exact: true }).click();
      await expect(page.getByText('New Task')).not.toBeVisible({ timeout: 5000 });

      // Verify in Tasks tab
      await page.getByRole('button', { name: /^Tasks/i }).click();
      await expect(page.getByText(taskName).first()).toBeVisible({ timeout: 5000 });

      // Extract taskId via API
      const res = await page.request.get(`/api/v1/tasks?case_id=${caseId}`);
      expect(res.ok()).toBeTruthy();
      const data = await res.json();
      const task = data.tasks.find((t: { description: string }) => t.description === taskName);
      expect(task).toBeTruthy();
      taskId = task.id;
      expect(task.urgency).toBe('Urgent');
    });

    await test.step('change task status through the detail sheet', async () => {
      await page.goto(`/cases/${caseId}`);
      await page.getByRole('button', { name: /^Tasks/i }).click();
      await expect(page.getByText(taskName).first()).toBeVisible({ timeout: 5000 });

      // Open detail sheet
      await page.getByText(taskName).first().click();
      const titleInput = page.getByPlaceholder('Task name');
      await expect(titleInput).toBeVisible({ timeout: 3000 });
      await expect(titleInput).toHaveValue(taskName);

      const sheet = page.locator('.fixed.inset-0.z-50');
      const portal = page.locator('#datepicker-portal');

      // Pending → Active
      await sheet.getByText('Pending', { exact: true }).click();
      await expect(portal.getByText('Active', { exact: true })).toBeVisible({ timeout: 3000 });
      await portal.getByText('Active', { exact: true }).click();
      await page.waitForTimeout(500);
      await expect(sheet.getByText('Active', { exact: true })).toBeVisible({ timeout: 3000 });

      let res = await page.request.get(`/api/v1/tasks?case_id=${caseId}`);
      let data = await res.json();
      let task = data.tasks.find((t: { id: number }) => t.id === taskId);
      expect(task.status).toBe('Active');

      // Active → Done
      await sheet.getByText('Active', { exact: true }).click();
      await expect(portal.getByText('Done', { exact: true })).toBeVisible({ timeout: 3000 });
      await portal.getByText('Done', { exact: true }).click();
      await page.waitForTimeout(500);
      await expect(sheet.getByText('Done', { exact: true })).toBeVisible({ timeout: 3000 });

      res = await page.request.get(`/api/v1/tasks?case_id=${caseId}`);
      data = await res.json();
      task = data.tasks.find((t: { id: number }) => t.id === taskId);
      expect(task.status).toBe('Done');
      expect(task.completion_date).toBeTruthy();

      // Done → Pending
      await sheet.getByText('Done', { exact: true }).click();
      await expect(portal.getByText('Pending', { exact: true })).toBeVisible({ timeout: 3000 });
      await portal.getByText('Pending', { exact: true }).click();
      await page.waitForTimeout(500);
      await expect(sheet.getByText('Pending', { exact: true })).toBeVisible({ timeout: 3000 });

      res = await page.request.get(`/api/v1/tasks?case_id=${caseId}`);
      data = await res.json();
      task = data.tasks.find((t: { id: number }) => t.id === taskId);
      expect(task.status).toBe('Pending');

      // Close sheet
      await page.keyboard.press('Escape');
      await expect(titleInput).not.toBeVisible({ timeout: 3000 });
    });

    await test.step('edit task title and priority in the detail sheet', async () => {
      await page.goto(`/cases/${caseId}`);
      await page.getByRole('button', { name: /^Tasks/i }).click();
      await expect(page.getByText(taskName).first()).toBeVisible({ timeout: 5000 });

      // Open detail sheet
      await page.getByText(taskName).first().click();
      const titleInput = page.getByPlaceholder('Task name');
      await expect(titleInput).toBeVisible({ timeout: 3000 });

      // Update title
      await titleInput.clear();
      await titleInput.fill(updatedTaskName);
      await titleInput.press('Enter');
      await page.waitForTimeout(500);

      // Change priority from 1 to 2
      const priorityButton = page.locator('button').filter({ hasText: 'Priority 1' });
      await priorityButton.click();
      const portal = page.locator('#datepicker-portal');
      await portal.getByText('Priority 2').click();
      await page.waitForTimeout(500);

      // Close and reopen to verify persistence
      await page.keyboard.press('Escape');
      await expect(titleInput).not.toBeVisible({ timeout: 3000 });

      await page.getByText(updatedTaskName).first().click();
      await expect(page.getByPlaceholder('Task name')).toHaveValue(updatedTaskName);
      await page.keyboard.press('Escape');

      // Verify via API
      const res = await page.request.get(`/api/v1/tasks?case_id=${caseId}`);
      const data = await res.json();
      const task = data.tasks.find((t: { id: number }) => t.id === taskId);
      expect(task.description).toBe(updatedTaskName);
      expect(task.urgency).toBe('High');
    });

    // Cleanup
    await apiDeleteCase(page.request, caseId);
  });

  // ── 3. Event creation and editing ─────────────────────────────────────
  test('create event via shortcut and edit details', async ({ page }) => {
    const ts = Date.now();
    const caseName = `UI-E2E Case ${ts}`;
    const eventName = `UI-E2E Event ${ts}`;
    const updatedEventName = `UI-E2E Event Updated ${ts}`;
    const caseId = await apiCreateCase(page.request, String(ts));
    let eventId: number;

    await test.step('create event via Ctrl+E keyboard shortcut', async () => {
      await page.goto(`/cases/${caseId}`);
      await expect(page.getByText(caseName).first()).toBeVisible({ timeout: 5000 });

      await page.keyboard.press('Control+e');
      await expect(page.getByText('New Event')).toBeVisible({ timeout: 3000 });

      const descInput = page.getByPlaceholder('Event description');
      await expect(descInput).toBeVisible();
      await descInput.fill(eventName);

      // Set date to today
      await page.getByText('No date').click();
      await page.locator('.react-datepicker__day--today').click();

      // Mark as Key Date
      await page.getByText('Mark as Key Date').click();
      await expect(page.getByText('Key Date').first()).toBeVisible();

      await page.getByRole('button', { name: 'Create Event' }).click();
      await expect(page.getByText('New Event')).not.toBeVisible({ timeout: 5000 });

      // Verify in Events tab
      await page.getByRole('button', { name: /^Events/i }).click();
      await expect(page.getByText(eventName).first()).toBeVisible({ timeout: 5000 });

      // Extract eventId via API
      const res = await page.request.get(`/api/v1/events?case_id=${caseId}`);
      expect(res.ok()).toBeTruthy();
      const data = await res.json();
      const event = data.events.find((e: { description: string }) => e.description === eventName);
      expect(event).toBeTruthy();
      eventId = event.id;
      expect(event.starred).toBe(true);
    });

    await test.step('edit event description and toggle star', async () => {
      await page.goto(`/cases/${caseId}`);
      await page.getByRole('button', { name: /^Events/i }).click();
      await expect(page.getByText(eventName).first()).toBeVisible({ timeout: 5000 });

      // Open detail sheet
      await page.getByText(eventName).first().click();
      const descInput = page.getByPlaceholder('Event description');
      await expect(descInput).toBeVisible({ timeout: 3000 });

      // Update description
      await descInput.clear();
      await descInput.fill(updatedEventName);
      await descInput.press('Enter');
      await page.waitForTimeout(500);

      // Toggle star off then back on
      await page.getByText('Key Date').first().click();
      await page.waitForTimeout(300);
      await page.getByText('Mark as Key Date').click();
      await page.waitForTimeout(300);

      // Close sheet
      await page.keyboard.press('Escape');
      await expect(descInput).not.toBeVisible({ timeout: 3000 });

      // Verify via API
      const res = await page.request.get(`/api/v1/events?case_id=${caseId}`);
      const data = await res.json();
      const event = data.events.find((e: { id: number }) => e.id === eventId);
      expect(event.description).toBe(updatedEventName);
      expect(event.starred).toBe(true);
    });

    // Cleanup
    await apiDeleteCase(page.request, caseId);
  });

  // ── 4. Link and unlink a task to an event ─────────────────────────────
  test('link and unlink a task to an event', async ({ page }) => {
    const ts = Date.now();
    const taskName = `UI-E2E Link Task ${ts}`;
    const eventName = `UI-E2E Link Event ${ts}`;
    const caseId = await apiCreateCase(page.request, String(ts));
    const taskId = await apiCreateTask(page.request, caseId, taskName);
    const eventId = await apiCreateEvent(page.request, caseId, eventName);

    await page.goto(`/cases/${caseId}`);
    await page.getByRole('button', { name: /^Tasks/i }).click();
    await expect(page.getByText(taskName).first()).toBeVisible({ timeout: 5000 });

    await test.step('link task to event via detail sheet', async () => {
      await page.getByText(taskName).first().click();
      const titleInput = page.getByPlaceholder('Task name');
      await expect(titleInput).toBeVisible({ timeout: 3000 });

      // Click "Add event" in the detail sheet
      const sheet = page.locator('.fixed.inset-0.z-50');
      await sheet.getByText('Add event', { exact: true }).click();

      // Select the event from the popover
      await expect(page.getByText(eventName).last()).toBeVisible({ timeout: 3000 });
      await page.getByText(eventName).last().click();
      await page.waitForTimeout(500);

      // Verify via API
      const res = await page.request.get(`/api/v1/tasks?case_id=${caseId}`);
      const data = await res.json();
      const task = data.tasks.find((t: { id: number }) => t.id === taskId);
      expect(task.event_id).toBe(eventId);

      // Close sheet
      await page.keyboard.press('Escape');
      await expect(titleInput).not.toBeVisible({ timeout: 3000 });
    });

    await test.step('verify link persists and unlink task from event', async () => {
      const sheet = page.locator('.fixed.inset-0.z-50');

      // Reopen sheet and verify linked event visible
      await page.getByText(taskName).first().click();
      await expect(page.getByPlaceholder('Task name')).toBeVisible({ timeout: 3000 });
      await expect(sheet.getByText(eventName)).toBeVisible({ timeout: 3000 });

      // Click linked event to open popover, then unlink
      await sheet.locator('button').filter({ hasText: eventName }).click();
      await expect(page.getByText('Unlink')).toBeVisible({ timeout: 3000 });
      await page.getByText('Unlink').click();
      await page.waitForTimeout(500);

      // Verify via API
      const res = await page.request.get(`/api/v1/tasks?case_id=${caseId}`);
      const data = await res.json();
      const task = data.tasks.find((t: { id: number }) => t.id === taskId);
      expect(task.event_id).toBeNull();

      await page.keyboard.press('Escape');
    });

    // Cleanup
    await apiDeleteCase(page.request, caseId);
  });

  // ── 5. Cycle task through all statuses in detail sheet ────────────────
  test('cycle task through all statuses in detail sheet', async ({ page }) => {
    const ts = Date.now();
    const taskName = `UI-E2E Status Cycle ${ts}`;
    const caseId = await apiCreateCase(page.request, String(ts));
    const taskId = await apiCreateTask(page.request, caseId, taskName);

    await page.goto(`/cases/${caseId}`);
    await page.getByRole('button', { name: /^Tasks/i }).click();
    await expect(page.getByText(taskName).first()).toBeVisible({ timeout: 5000 });

    // Open detail sheet once
    await page.getByText(taskName).first().click();
    const sheetTitle = page.getByPlaceholder('Task name');
    await expect(sheetTitle).toBeVisible({ timeout: 3000 });

    const sheet = page.locator('.fixed.inset-0.z-50');
    const portal = page.locator('#datepicker-portal');

    async function cycleStatus(fromStatus: string, toStatus: string) {
      await sheet.getByText(fromStatus, { exact: true }).click();
      await expect(portal.getByText(toStatus, { exact: true })).toBeVisible({ timeout: 3000 });
      await portal.getByText(toStatus, { exact: true }).click();
      await page.waitForTimeout(500);

      await expect(sheet.getByText(toStatus, { exact: true })).toBeVisible({ timeout: 3000 });

      const res = await page.request.get(`/api/v1/tasks?case_id=${caseId}`);
      const data = await res.json();
      const task = data.tasks.find((t: { id: number }) => t.id === taskId);
      expect(task.status).toBe(toStatus);
      if (toStatus === 'Done') {
        expect(task.completion_date).toBeTruthy();
      }
    }

    // Cycle: Pending → Active → Blocked → Pending → Done
    await test.step('Pending → Active', () => cycleStatus('Pending', 'Active'));
    await test.step('Active → Blocked', () => cycleStatus('Active', 'Blocked'));
    await test.step('Blocked → Pending', () => cycleStatus('Blocked', 'Pending'));
    await test.step('Pending → Done', () => cycleStatus('Pending', 'Done'));

    // Close sheet
    await page.keyboard.press('Escape');
    await expect(sheetTitle).not.toBeVisible({ timeout: 3000 });

    // Cleanup
    await apiDeleteCase(page.request, caseId);
  });
});
