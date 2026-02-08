/**
 * UI-Driven E2E Tests — Judges Widget Filters & Case Detail Judge Management
 *
 * Tests:
 * 1. Judges widget on Persons page with jurisdiction & title filter chips
 * 2. Case detail page: add judge to proceeding, remove judge from proceeding
 */
import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

// ─── Auth helper ──────────────────────────────────────────────────────────────

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

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiCreateCase(request: APIRequestContext, suffix: string) {
  const res = await request.post('/api/v1/cases', {
    data: {
      case_name: `UI-Judge Case ${suffix}`,
      status: 'Pre-Filing',
      short_name: `JDG${suffix}`,
      case_summary: 'Test case for judge UI tests',
    },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).case.id as number;
}

async function apiDeleteCase(request: APIRequestContext, caseId: number) {
  await request.delete(`/api/v1/cases/${caseId}`);
}

async function apiGetFirstJurisdiction(request: APIRequestContext) {
  const res = await request.get('/api/v1/jurisdictions');
  const data = await res.json();
  return data.jurisdictions?.[0] as { id: number; name: string } | undefined;
}

async function apiCreateJudge(request: APIRequestContext, data: Record<string, unknown>) {
  const res = await request.post('/api/v1/judges', { data });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).judge;
}

async function apiDeleteJudge(request: APIRequestContext, judgeId: number) {
  await request.delete(`/api/v1/judges/${judgeId}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// JUDGES WIDGET — FILTER CHIPS
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Judges Widget — Filters', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('jurisdiction and title filter chips appear and filter judges', async ({ page }) => {
    const ts = Date.now();
    const jurisdiction = await apiGetFirstJurisdiction(page.request);
    expect(jurisdiction).toBeTruthy();

    // Create two judges: one with jurisdiction + title, one without
    const j1 = await apiCreateJudge(page.request, {
      name: `UI-Filter Judge A ${ts}`,
      title: 'Judge',
      jurisdiction_id: jurisdiction!.id,
    });
    const j2 = await apiCreateJudge(page.request, {
      name: `UI-Filter Judge B ${ts}`,
      title: 'Magistrate',
    });

    try {
      // Navigate to Persons page
      await page.goto('/persons');
      await page.waitForTimeout(500);

      await test.step('switch a panel to Judges widget', async () => {
        // Find the widget type selector and switch to Judges
        // Click on the first panel's widget type selector dropdown
        const widgetSelectors = page.locator('button').filter({ hasText: /Persons|Clients|Judges/ });
        const firstSelector = widgetSelectors.first();
        await firstSelector.click();
        await page.waitForTimeout(300);

        // Select Judges from the dropdown
        const judgesOption = page.getByText('Judges', { exact: true }).last();
        if (await judgesOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          await judgesOption.click();
          await page.waitForTimeout(500);
        }
      });

      await test.step('open filter panel and verify filter sections exist', async () => {
        // Click the filter/settings button to open filter dropdown
        const filterButtons = page.locator('button').filter({ has: page.locator('svg.lucide-settings-2') });
        await filterButtons.first().click();
        await page.waitForTimeout(300);

        // Verify "Jurisdiction" and "Title" labels are visible
        await expect(page.getByText('Jurisdiction', { exact: true })).toBeVisible({ timeout: 3000 });
        await expect(page.getByText('Title', { exact: true })).toBeVisible({ timeout: 3000 });

        // Verify "All" buttons exist for both sections
        const allButtons = page.locator('button').filter({ hasText: 'All' });
        expect(await allButtons.count()).toBeGreaterThanOrEqual(2);

        // Verify some title chips are visible
        await expect(page.getByRole('button', { name: 'Judge', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Magistrate', exact: true })).toBeVisible();

        // Verify jurisdiction name chip is visible
        await expect(page.getByRole('button', { name: jurisdiction!.name })).toBeVisible();
      });

      await test.step('filter by jurisdiction narrows results via API', async () => {
        // Click jurisdiction chip
        await page.getByRole('button', { name: jurisdiction!.name }).click();
        await page.waitForTimeout(800);

        // Judge A (has jurisdiction) should be visible, Judge B (no jurisdiction) should not
        await expect(page.getByText(`UI-Filter Judge A ${ts}`)).toBeVisible({ timeout: 5000 });
        await expect(page.getByText(`UI-Filter Judge B ${ts}`)).not.toBeVisible({ timeout: 2000 });
      });

      await test.step('clear jurisdiction filter shows all judges again', async () => {
        // Click "All" in the jurisdiction section
        // The first "All" button in the filter panel is for jurisdiction
        const allButtons = page.locator('button').filter({ hasText: 'All' });
        await allButtons.first().click();
        await page.waitForTimeout(800);

        // Both judges should be visible now
        await expect(page.getByText(`UI-Filter Judge A ${ts}`)).toBeVisible({ timeout: 5000 });
        await expect(page.getByText(`UI-Filter Judge B ${ts}`)).toBeVisible({ timeout: 5000 });
      });

      await test.step('filter by title narrows results via API', async () => {
        // Click "Judge" title chip
        await page.getByRole('button', { name: 'Judge', exact: true }).click();
        await page.waitForTimeout(800);

        // Judge A (title: Judge) should be visible, Judge B (title: Magistrate) should not
        await expect(page.getByText(`UI-Filter Judge A ${ts}`)).toBeVisible({ timeout: 5000 });
        await expect(page.getByText(`UI-Filter Judge B ${ts}`)).not.toBeVisible({ timeout: 2000 });
      });

      await test.step('switching title filter shows different results', async () => {
        // Click "Magistrate" title chip
        await page.getByRole('button', { name: 'Magistrate', exact: true }).click();
        await page.waitForTimeout(800);

        // Judge B (title: Magistrate) should be visible, Judge A (title: Judge) should not
        await expect(page.getByText(`UI-Filter Judge B ${ts}`)).toBeVisible({ timeout: 5000 });
        await expect(page.getByText(`UI-Filter Judge A ${ts}`)).not.toBeVisible({ timeout: 2000 });
      });

    } finally {
      // Cleanup
      await apiDeleteJudge(page.request, j1.id);
      await apiDeleteJudge(page.request, j2.id);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CASE DETAIL — JUDGE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Case Detail — Judge Management', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('add and remove judge on case detail proceeding', async ({ page }) => {
    const ts = Date.now();

    // Create a case with a proceeding and a judge via API
    const caseId = await apiCreateCase(page.request, String(ts));
    const jurisdiction = await apiGetFirstJurisdiction(page.request);

    const procRes = await page.request.post(`/api/v1/cases/${caseId}/proceedings`, {
      data: {
        case_number: `UI-JUDGE-${ts}`,
        jurisdiction_id: jurisdiction?.id,
        is_primary: true,
      },
    });
    expect(procRes.ok()).toBeTruthy();
    const procId = (await procRes.json()).proceeding.id;

    const judge = await apiCreateJudge(page.request, {
      name: `UI Test Judge ${ts}`,
      title: 'Judge',
      jurisdiction_id: jurisdiction?.id,
    });

    try {
      // Assign judge to proceeding via API
      const assignRes = await page.request.post(`/api/v1/proceedings/${procId}/judges`, {
        data: { judge_id: judge.id, role: 'Presiding' },
      });
      expect(assignRes.ok()).toBeTruthy();

      await test.step('verify judge displayed on case detail page', async () => {
        await page.goto(`/cases/${caseId}`);
        await expect(page.getByText('Overview').first()).toBeVisible({ timeout: 5000 });
        await expect(page.getByText(`UI-JUDGE-${ts}`)).toBeVisible({ timeout: 5000 });
        // Judge name should be visible under the proceeding
        await expect(page.getByText(`UI Test Judge ${ts}`).first()).toBeVisible({ timeout: 5000 });
        // Role should be shown in parentheses
        await expect(page.getByText('(Presiding)').first()).toBeVisible({ timeout: 3000 });
      });

      await test.step('remove judge via API and verify UI updates', async () => {
        const removeRes = await page.request.delete(`/api/v1/proceedings/${procId}/judges/${judge.id}`);
        expect(removeRes.ok()).toBeTruthy();

        // Reload and verify judge is gone
        await page.goto(`/cases/${caseId}`);
        await expect(page.getByText(`UI-JUDGE-${ts}`)).toBeVisible({ timeout: 5000 });

        // The "+Judge" button should be visible (no judges assigned)
        const addJudgeBtn = page.locator('button').filter({ hasText: /^\+?\s*Judge$/ }).first();
        await expect(addJudgeBtn).toBeVisible({ timeout: 5000 });
      });

      await test.step('add judge back via UI autocomplete', async () => {
        // Click the "+ Judge" button
        const addJudgeBtn = page.locator('button').filter({ hasText: /^\+?\s*Judge$/ }).first();
        await addJudgeBtn.click();
        await page.waitForTimeout(300);

        // Type in the judge autocomplete
        const judgeInput = page.getByPlaceholder('Search judges...');
        await expect(judgeInput).toBeVisible({ timeout: 3000 });
        await judgeInput.fill(`UI Test Judge ${ts}`);
        await page.waitForTimeout(500);

        // Select the judge from autocomplete results
        const result = page.getByText(`UI Test Judge ${ts}`).last();
        await expect(result).toBeVisible({ timeout: 5000 });
        await result.click();
        await page.waitForTimeout(1000);
      });

      await test.step('verify judge re-assigned via API', async () => {
        const res = await page.request.get(`/api/v1/proceedings/${procId}/judges`);
        expect(res.ok()).toBeTruthy();
        const data = await res.json();
        expect(data.judges.length).toBe(1);
        expect(data.judges[0].name).toBe(`UI Test Judge ${ts}`);
      });

    } finally {
      // Cleanup
      await page.request.delete(`/api/v1/proceedings/${procId}/judges/${judge.id}`).catch(() => {});
      await page.request.delete(`/api/v1/proceedings/${procId}`);
      await apiDeleteJudge(page.request, judge.id);
      await apiDeleteCase(page.request, caseId);
    }
  });

  test('add judge with specific role on case detail', async ({ page }) => {
    const ts = Date.now();

    const caseId = await apiCreateCase(page.request, String(ts));
    const procRes = await page.request.post(`/api/v1/cases/${caseId}/proceedings`, {
      data: { case_number: `UI-ROLE-${ts}`, is_primary: true },
    });
    expect(procRes.ok()).toBeTruthy();
    const procId = (await procRes.json()).proceeding.id;

    const judge = await apiCreateJudge(page.request, {
      name: `UI Role Judge ${ts}`,
    });

    try {
      await page.goto(`/cases/${caseId}`);
      await expect(page.getByText(`UI-ROLE-${ts}`)).toBeVisible({ timeout: 5000 });

      await test.step('select Magistrate role before adding', async () => {
        // Click "+ Judge" to start adding
        const addJudgeBtn = page.locator('button').filter({ hasText: /^\+?\s*Judge$/ }).first();
        await addJudgeBtn.click();
        await page.waitForTimeout(300);

        // Change the role selector to "Magistrate"
        const roleSelect = page.locator('select').first();
        await roleSelect.selectOption('Magistrate');

        // Search for and select the judge
        const judgeInput = page.getByPlaceholder('Search judges...');
        await judgeInput.fill(`UI Role Judge ${ts}`);
        await page.waitForTimeout(500);

        const result = page.getByText(`UI Role Judge ${ts}`).last();
        await expect(result).toBeVisible({ timeout: 5000 });
        await result.click();
        await page.waitForTimeout(500);
      });

      await test.step('verify role persisted as Magistrate', async () => {
        const res = await page.request.get(`/api/v1/proceedings/${procId}/judges`);
        const data = await res.json();
        expect(data.judges.length).toBe(1);
        expect(data.judges[0].name).toBe(`UI Role Judge ${ts}`);
        expect(data.judges[0].role).toBe('Magistrate');
      });

      await test.step('verify role label displayed in UI', async () => {
        // The role should be shown in parentheses next to the judge name
        await expect(page.getByText('(Magistrate)')).toBeVisible({ timeout: 5000 });
      });

    } finally {
      await page.request.delete(`/api/v1/proceedings/${procId}/judges/${judge.id}`).catch(() => {});
      await page.request.delete(`/api/v1/proceedings/${procId}`);
      await apiDeleteJudge(page.request, judge.id);
      await apiDeleteCase(page.request, caseId);
    }
  });
});
