/**
 * UI-Driven E2E Happy Path Tests
 *
 * Exercises the most-used flows by clicking buttons, filling forms,
 * and verifying the UI renders correctly. Each UI action is also
 * verified via API to confirm state persisted.
 *
 * Serial execution — tests share state (caseId, taskId, eventId).
 */
import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5175';
test.use({ baseURL: BASE_URL });

// ─── Shared state across serial tests ───────────────────────────────────
let caseId: number;
let taskId: number;
let eventId: number;
const ts = Date.now();
const caseName = `UI-E2E Case ${ts}`;
const taskName = `UI-E2E Task ${ts}`;
const eventName = `UI-E2E Event ${ts}`;

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

// ─── Serial test suite ──────────────────────────────────────────────────
test.describe.serial('UI Happy Paths', () => {
  test.beforeAll(async ({ browser }) => {
    // Warm-up: ensure authenticated session exists
    const page = await browser.newPage({ baseURL: BASE_URL });
    await ensureAuthenticated(page);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page).not.toHaveURL(/login/, { timeout: 15000 });
    await expect(page.getByRole('link', { name: /^cases$/i })).toBeVisible({ timeout: 5000 });
  });

  // ── 1. Create a new case via the UI form ──────────────────────────────
  test('create a new case via the UI form', async ({ page }) => {
    await page.goto('/cases');
    await expect(page).toHaveURL(/\/cases/);

    // Click "Add case" button
    await page.getByRole('button', { name: /add case/i }).click();

    // Fill case name
    const nameInput = page.getByPlaceholder(/enter case name/i);
    await expect(nameInput).toBeVisible({ timeout: 3000 });
    await nameInput.fill(caseName);

    // Click "Create"
    await page.getByRole('button', { name: 'Create' }).click();

    // Verify redirect to case detail page
    await expect(page).toHaveURL(/\/cases\/\d+/, { timeout: 10000 });

    // Extract caseId from URL
    const url = page.url();
    const match = url.match(/\/cases\/(\d+)/);
    expect(match).toBeTruthy();
    caseId = parseInt(match![1], 10);

    // Verify case name visible on detail page
    await expect(page.getByText(caseName).first()).toBeVisible({ timeout: 5000 });

    // Verify tabs visible (Overview, Tasks, Events)
    await expect(page.getByRole('button', { name: 'Overview', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tasks', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Events', exact: true })).toBeVisible();

    // Verify via API
    const res = await page.request.get(`/api/v1/cases/${caseId}`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.case_name).toBe(caseName);
  });

  // ── 2. Create a task via Ctrl+T keyboard shortcut ─────────────────────
  test('create a task via Ctrl+T keyboard shortcut', async ({ page }) => {
    await page.goto(`/cases/${caseId}`);
    await expect(page.getByText(caseName).first()).toBeVisible({ timeout: 5000 });

    // Press Ctrl+T to open task creation modal
    await page.keyboard.press('Control+t');

    // Wait for "New Task" modal
    await expect(page.getByText('New Task')).toBeVisible({ timeout: 3000 });

    // Fill task name
    const titleInput = page.getByPlaceholder('Task name');
    await expect(titleInput).toBeVisible();
    await titleInput.fill(taskName);

    // Open priority picker and select Priority 1 (Urgent)
    // Default is "Priority 3" — click it to open the picker
    await page.getByText('Priority 3').click();
    await page.getByText('Priority 1').click();

    // Click "Create Task"
    await page.getByRole('button', { name: 'Create Task', exact: true }).click();

    // Modal should close
    await expect(page.getByText('New Task')).not.toBeVisible({ timeout: 5000 });

    // Switch to Tasks tab and verify task visible
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

  // ── 3. Change task status through the detail sheet ────────────────────
  test('change task status through the detail sheet', async ({ page }) => {
    await page.goto(`/cases/${caseId}`);
    await page.getByRole('button', { name: /^Tasks/i }).click();
    await expect(page.getByText(taskName).first()).toBeVisible({ timeout: 5000 });

    // Click task row to open detail sheet
    await page.getByText(taskName).first().click();

    // Verify detail sheet opened — the title input should have our task name
    const titleInput = page.getByPlaceholder('Task name');
    await expect(titleInput).toBeVisible({ timeout: 3000 });
    await expect(titleInput).toHaveValue(taskName);

    const sheet = page.locator('.fixed.inset-0.z-50');
    const portal = page.locator('#datepicker-portal');

    // Pending → Active: click status label in the sheet, pick from portal
    await sheet.getByText('Pending', { exact: true }).click();
    await expect(portal.getByText('Active', { exact: true })).toBeVisible({ timeout: 3000 });
    await portal.getByText('Active', { exact: true }).click();
    await page.waitForTimeout(500);

    // Sheet should immediately reflect the new status
    await expect(sheet.getByText('Active', { exact: true })).toBeVisible({ timeout: 3000 });

    // Verify via API
    let res = await page.request.get(`/api/v1/tasks?case_id=${caseId}`);
    let data = await res.json();
    let task = data.tasks.find((t: { id: number }) => t.id === taskId);
    expect(task.status).toBe('Active');

    // Active → Done (click the now-visible "Active" label in the sheet)
    await sheet.getByText('Active', { exact: true }).click();
    await expect(portal.getByText('Done', { exact: true })).toBeVisible({ timeout: 3000 });
    await portal.getByText('Done', { exact: true }).click();
    await page.waitForTimeout(500);

    // Sheet should immediately reflect Done
    await expect(sheet.getByText('Done', { exact: true })).toBeVisible({ timeout: 3000 });

    res = await page.request.get(`/api/v1/tasks?case_id=${caseId}`);
    data = await res.json();
    task = data.tasks.find((t: { id: number }) => t.id === taskId);
    expect(task.status).toBe('Done');
    expect(task.completion_date).toBeTruthy();

    // Done → Pending (click "Done" label in sheet, pick Pending from portal)
    await sheet.getByText('Done', { exact: true }).click();
    await expect(portal.getByText('Pending', { exact: true })).toBeVisible({ timeout: 3000 });
    await portal.getByText('Pending', { exact: true }).click();
    await page.waitForTimeout(500);

    // Sheet should immediately reflect Pending
    await expect(sheet.getByText('Pending', { exact: true })).toBeVisible({ timeout: 3000 });

    res = await page.request.get(`/api/v1/tasks?case_id=${caseId}`);
    data = await res.json();
    task = data.tasks.find((t: { id: number }) => t.id === taskId);
    expect(task.status).toBe('Pending');

    // Close sheet
    await page.keyboard.press('Escape');
    await expect(titleInput).not.toBeVisible({ timeout: 3000 });
  });

  // ── 4. Edit task title and priority in the detail sheet ───────────────
  test('edit task title and priority in the detail sheet', async ({ page }) => {
    const updatedTaskName = `UI-E2E Task Updated ${ts}`;

    await page.goto(`/cases/${caseId}`);
    await page.getByRole('button', { name: /^Tasks/i }).click();
    await expect(page.getByText(taskName).first()).toBeVisible({ timeout: 5000 });

    // Click task row
    await page.getByText(taskName).first().click();

    // Wait for sheet to open
    const titleInput = page.getByPlaceholder('Task name');
    await expect(titleInput).toBeVisible({ timeout: 3000 });

    // Clear and type new name, then press Enter to trigger blur-save
    await titleInput.clear();
    await titleInput.fill(updatedTaskName);
    await titleInput.press('Enter');

    // Wait for save
    await page.waitForTimeout(500);

    // Click priority button (currently "Priority 1") to change priority
    const priorityButton = page.locator('button').filter({ hasText: 'Priority 1' });
    await priorityButton.click();

    // Select "Priority 2" (High) from portal picker
    const portal = page.locator('#datepicker-portal');
    await portal.getByText('Priority 2').click();

    // Wait for save
    await page.waitForTimeout(500);

    // Close sheet
    await page.keyboard.press('Escape');
    await expect(titleInput).not.toBeVisible({ timeout: 3000 });

    // Reopen task to verify title persisted in UI
    await page.getByText(updatedTaskName).first().click();
    await expect(page.getByPlaceholder('Task name')).toHaveValue(updatedTaskName);

    // Close sheet
    await page.keyboard.press('Escape');

    // Verify via API
    const res = await page.request.get(`/api/v1/tasks?case_id=${caseId}`);
    const data = await res.json();
    const task = data.tasks.find((t: { id: number }) => t.id === taskId);
    expect(task.description).toBe(updatedTaskName);
    expect(task.urgency).toBe('High');
  });

  // ── 5. Create an event via Ctrl+E keyboard shortcut ───────────────────
  test('create an event via Ctrl+E keyboard shortcut', async ({ page }) => {
    await page.goto(`/cases/${caseId}`);
    await expect(page.getByText(caseName).first()).toBeVisible({ timeout: 5000 });

    // Press Ctrl+E to open event creation modal
    await page.keyboard.press('Control+e');

    // Wait for "New Event" modal
    await expect(page.getByText('New Event')).toBeVisible({ timeout: 3000 });

    // Fill event description
    const descInput = page.getByPlaceholder('Event description');
    await expect(descInput).toBeVisible();
    await descInput.fill(eventName);

    // Click date row ("No date") to open the date picker
    await page.getByText('No date').click();

    // Click today in the date picker
    await page.locator('.react-datepicker__day--today').click();

    // Click "Mark as Key Date" to toggle star on
    await page.getByText('Mark as Key Date').click();
    // Verify it toggled — now shows "Key Date"
    await expect(page.getByText('Key Date').first()).toBeVisible();

    // Click "Create Event"
    await page.getByRole('button', { name: 'Create Event' }).click();

    // Modal should close
    await expect(page.getByText('New Event')).not.toBeVisible({ timeout: 5000 });

    // Switch to Events tab and verify event visible
    await page.getByRole('button', { name: /^Events/i }).click();
    await expect(page.getByText(eventName).first()).toBeVisible({ timeout: 5000 });

    // Extract eventId via API (event is today, so default query returns it — no include_past)
    const res = await page.request.get(`/api/v1/events?case_id=${caseId}`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    const event = data.events.find((e: { description: string }) => e.description === eventName);
    expect(event).toBeTruthy();
    eventId = event.id;
    expect(event.starred).toBe(true);
  });

  // ── 6. Edit event description and toggle star ─────────────────────────
  test('edit event description and toggle star', async ({ page }) => {
    const updatedEventName = `UI-E2E Event Updated ${ts}`;

    await page.goto(`/cases/${caseId}`);
    await page.getByRole('button', { name: /^Events/i }).click();
    await expect(page.getByText(eventName).first()).toBeVisible({ timeout: 5000 });

    // Click event row to open detail sheet
    await page.getByText(eventName).first().click();

    // Wait for sheet to open
    const descInput = page.getByPlaceholder('Event description');
    await expect(descInput).toBeVisible({ timeout: 3000 });

    // Clear and type new description, press Enter to save
    await descInput.clear();
    await descInput.fill(updatedEventName);
    await descInput.press('Enter');

    // Wait for save
    await page.waitForTimeout(500);

    // Toggle star off: "Key Date" → "Mark as Key Date"
    await page.getByText('Key Date').first().click();
    await page.waitForTimeout(300);

    // Toggle star back on: "Mark as Key Date" → "Key Date"
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

  // ── 7. Link and unlink a task to an event ─────────────────────────────
  test('link and unlink a task to an event', async ({ page }) => {
    const updatedTaskName = `UI-E2E Task Updated ${ts}`;
    const updatedEventName = `UI-E2E Event Updated ${ts}`;

    await page.goto(`/cases/${caseId}`);
    await page.getByRole('button', { name: /^Tasks/i }).click();
    await expect(page.getByText(updatedTaskName).first()).toBeVisible({ timeout: 5000 });

    // Click task row to open detail sheet
    await page.getByText(updatedTaskName).first().click();

    // Wait for sheet
    const titleInput = page.getByPlaceholder('Task name');
    await expect(titleInput).toBeVisible({ timeout: 3000 });

    // Click "Add event" link button inside the detail sheet (exact match to avoid "Add Events")
    const sheet = page.locator('.fixed.inset-0.z-50');
    await sheet.getByText('Add event', { exact: true }).click();

    // EventLinkPopover opens — click our event in the list
    await expect(page.getByText(updatedEventName).last()).toBeVisible({ timeout: 3000 });
    await page.getByText(updatedEventName).last().click();

    // Wait for link to persist
    await page.waitForTimeout(500);

    // Verify via API: task should have event_id set
    let res = await page.request.get(`/api/v1/tasks?case_id=${caseId}`);
    let data = await res.json();
    let task = data.tasks.find((t: { id: number }) => t.id === taskId);
    expect(task.event_id).toBe(eventId);

    // Close sheet and reopen to verify the link is displayed
    await page.keyboard.press('Escape');
    await expect(titleInput).not.toBeVisible({ timeout: 3000 });

    await page.getByText(updatedTaskName).first().click();
    await expect(page.getByPlaceholder('Task name')).toBeVisible({ timeout: 3000 });

    // Verify the linked event description is visible in the sheet
    await expect(sheet.getByText(updatedEventName)).toBeVisible({ timeout: 3000 });

    // Click the linked event area to open the EventLinkPopover
    await sheet.locator('button').filter({ hasText: updatedEventName }).click();

    // Verify the popover shows the "Unlink" button
    await expect(page.getByText('Unlink')).toBeVisible({ timeout: 3000 });

    // Click "Unlink"
    await page.getByText('Unlink').click();
    await page.waitForTimeout(500);

    // Verify via API: event_id should be null
    res = await page.request.get(`/api/v1/tasks?case_id=${caseId}`);
    data = await res.json();
    task = data.tasks.find((t: { id: number }) => t.id === taskId);
    expect(task.event_id).toBeNull();

    // Close sheet
    await page.keyboard.press('Escape');
  });

  // ── 8. Create second task and cycle through all statuses ──────────────
  test('create second task and cycle through all statuses', async ({ page }) => {
    const secondTaskName = `UI-E2E Status Cycle ${ts}`;

    await page.goto(`/cases/${caseId}`);
    await expect(page.getByText(caseName).first()).toBeVisible({ timeout: 5000 });

    // Press Ctrl+T to create a second task
    await page.keyboard.press('Control+t');
    await expect(page.getByText('New Task')).toBeVisible({ timeout: 3000 });

    const titleInput = page.getByPlaceholder('Task name');
    await titleInput.fill(secondTaskName);

    // Create with default priority (Medium / Priority 3)
    await page.getByRole('button', { name: 'Create Task', exact: true }).click();
    await expect(page.getByText('New Task')).not.toBeVisible({ timeout: 5000 });

    // Navigate to Tasks tab
    await page.getByRole('button', { name: /^Tasks/i }).click();
    await expect(page.getByText(secondTaskName).first()).toBeVisible({ timeout: 5000 });

    // Get second task ID via API
    let res = await page.request.get(`/api/v1/tasks?case_id=${caseId}`);
    let data = await res.json();
    const secondTask = data.tasks.find(
      (t: { description: string }) => t.description === secondTaskName
    );
    expect(secondTask).toBeTruthy();
    const secondTaskId = secondTask.id;

    const portal = page.locator('#datepicker-portal');
    const sheetTitle = page.getByPlaceholder('Task name');
    const sheet = page.locator('.fixed.inset-0.z-50');

    // Helper: change status within an already-open sheet, verify sheet updates + API
    async function cycleStatusViaSheet(
      fromStatus: string,
      toStatus: string,
      expectedTaskId: number,
    ) {
      // Click current status label inside the sheet → pick new status from portal
      await sheet.getByText(fromStatus, { exact: true }).click();
      await expect(portal.getByText(toStatus, { exact: true })).toBeVisible({ timeout: 3000 });
      await portal.getByText(toStatus, { exact: true }).click();
      await page.waitForTimeout(500);

      // Sheet should immediately reflect the new status
      await expect(sheet.getByText(toStatus, { exact: true })).toBeVisible({ timeout: 3000 });

      // Verify via API
      const res = await page.request.get(`/api/v1/tasks?case_id=${caseId}`);
      const data = await res.json();
      const task = data.tasks.find((t: { id: number }) => t.id === expectedTaskId);
      expect(task.status).toBe(toStatus);
      if (toStatus === 'Done') {
        expect(task.completion_date).toBeTruthy();
      }
    }

    // Open detail sheet once
    await page.getByText(secondTaskName).first().click();
    await expect(sheetTitle).toBeVisible({ timeout: 3000 });

    // Cycle: Pending → Active → Blocked → Pending → Done (all within the same open sheet)
    await cycleStatusViaSheet('Pending', 'Active', secondTaskId);
    await cycleStatusViaSheet('Active', 'Blocked', secondTaskId);
    await cycleStatusViaSheet('Blocked', 'Pending', secondTaskId);
    await cycleStatusViaSheet('Pending', 'Done', secondTaskId);

    // Close sheet
    await page.keyboard.press('Escape');
    await expect(sheetTitle).not.toBeVisible({ timeout: 3000 });
  });

  // ── 9. Cleanup ────────────────────────────────────────────────────────
  test.afterAll(async ({ request }) => {
    if (caseId) {
      await request.delete(`${BASE_URL}/api/v1/cases/${caseId}`);
    }
  });
});
