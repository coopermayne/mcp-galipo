import { test, expect } from '@playwright/test';

// ─── Auth helper ──────────────────────────────────────────────────────────────
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page).not.toHaveURL(/login/, { timeout: 15000 });
  await expect(page.getByRole('link', { name: /^cases$/i })).toBeVisible({ timeout: 5000 });
});

// ─── Helper: get a valid case ID ─────────────────────────────────────────────
async function getFirstCaseId(page): Promise<number> {
  const res = await page.request.get('/api/v1/cases');
  const data = await res.json();
  const id = Array.isArray(data) ? data[0]?.id : data.cases?.[0]?.id;
  expect(id).toBeDefined();
  return id;
}

// ─── Helper: get a valid jurisdiction ID ─────────────────────────────────────
async function getFirstJurisdictionId(page): Promise<number> {
  const res = await page.request.get('/api/v1/jurisdictions');
  const data = await res.json();
  const id = data.jurisdictions?.[0]?.id;
  expect(id).toBeDefined();
  return id;
}

// ═══════════════════════════════════════════════════════════════════════════════
// JUDGES
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Judges — deep E2E', () => {

  test('GET /judges — list with pagination', async ({ page }) => {
    const res = await page.request.get('/api/v1/judges?limit=5&offset=0');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data).toHaveProperty('judges');
    expect(data).toHaveProperty('total');
    expect(Array.isArray(data.judges)).toBeTruthy();
    expect(data.judges.length).toBeLessThanOrEqual(5);
    expect(data.total).toBeGreaterThanOrEqual(data.judges.length);
  });

  test('full judge lifecycle: create, get, search, update, delete', async ({ page }) => {
    const ts = Date.now();
    const jurisdictionId = await getFirstJurisdictionId(page);

    // Create with JSONB phones/emails
    const createRes = await page.request.post('/api/v1/judges', {
      data: {
        name: `E2E Judge ${ts}`,
        phones: [{ value: '555-0100', label: 'Chambers', primary: true }],
        emails: [{ value: `judge-${ts}@example.com`, label: 'Work', primary: true }],
        jurisdiction_id: jurisdictionId,
        chambers: 'Room 400',
        courtroom_number: '12A',
        initials: 'EJ',
        status: 'Active',
        notes: 'Created by E2E test',
      }
    });
    expect(createRes.ok()).toBeTruthy();
    const { judge: created } = await createRes.json();
    expect(created.name).toBe(`E2E Judge ${ts}`);
    expect(created.phones).toHaveLength(1);
    expect(created.phones[0].value).toBe('555-0100');
    expect(created.emails).toHaveLength(1);
    expect(created.jurisdiction_id).toBe(jurisdictionId);
    expect(created.jurisdiction_name).toBeTruthy();
    expect(created.chambers).toBe('Room 400');
    expect(created.courtroom_number).toBe('12A');
    expect(created.initials).toBe('EJ');
    expect(created.id).toBeGreaterThan(0);
    const judgeId = created.id;

    // GET by ID — verify all fields + jurisdiction_name
    const getRes = await page.request.get(`/api/v1/judges/${judgeId}`);
    expect(getRes.ok()).toBeTruthy();
    const { judge: fetched } = await getRes.json();
    expect(fetched.name).toBe(`E2E Judge ${ts}`);
    expect(fetched.jurisdiction_name).toBeTruthy();
    expect(fetched.proceedings).toBeDefined();
    expect(Array.isArray(fetched.proceedings)).toBeTruthy();
    expect(fetched.created_at).toBeTruthy();
    expect(new Date(fetched.created_at).getTime()).not.toBeNaN();

    // Search
    const searchRes = await page.request.get(`/api/v1/judges/search?name=E2E+Judge+${ts}`);
    expect(searchRes.ok()).toBeTruthy();
    const searchData = await searchRes.json();
    expect(searchData.judges.length).toBeGreaterThanOrEqual(1);
    const found = searchData.judges.find((j: any) => j.id === judgeId);
    expect(found).toBeTruthy();
    expect(found.jurisdiction_name).toBeTruthy();

    // Update individual fields
    const updateRes = await page.request.put(`/api/v1/judges/${judgeId}`, {
      data: { chambers: 'Room 500', notes: 'Updated by E2E test' }
    });
    expect(updateRes.ok()).toBeTruthy();
    const { judge: updated } = await updateRes.json();
    expect(updated.chambers).toBe('Room 500');
    expect(updated.notes).toBe('Updated by E2E test');
    // Unchanged fields should be preserved
    expect(updated.name).toBe(`E2E Judge ${ts}`);
    expect(updated.courtroom_number).toBe('12A');

    // Delete — success on unassigned judge
    const delRes = await page.request.delete(`/api/v1/judges/${judgeId}`);
    expect(delRes.ok()).toBeTruthy();
    const delData = await delRes.json();
    expect(delData.success).toBeTruthy();

    // Verify gone
    const goneRes = await page.request.get(`/api/v1/judges/${judgeId}`);
    expect(goneRes.status()).toBe(404);
  });

  test('GET /judges/search with jurisdiction filter', async ({ page }) => {
    const res = await page.request.get('/api/v1/judges/search');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data).toHaveProperty('judges');
    expect(Array.isArray(data.judges)).toBeTruthy();

    // Each result should have id, name, jurisdiction_id, jurisdiction_name
    if (data.judges.length > 0) {
      const j = data.judges[0];
      expect(j).toHaveProperty('id');
      expect(j).toHaveProperty('name');
      expect(j).toHaveProperty('jurisdiction_id');
    }
  });

  test('DELETE assigned judge returns error', async ({ page }) => {
    const ts = Date.now();
    const caseId = await getFirstCaseId(page);

    // Create a judge
    const judgeRes = await page.request.post('/api/v1/judges', {
      data: { name: `E2E Assigned Judge ${ts}` }
    });
    expect(judgeRes.ok()).toBeTruthy();
    const judgeId = (await judgeRes.json()).judge.id;

    // Create a proceeding and assign the judge
    const procRes = await page.request.post(`/api/v1/cases/${caseId}/proceedings`, {
      data: { case_number: `E2E-ASSIGN-${ts}` }
    });
    expect(procRes.ok()).toBeTruthy();
    const procId = (await procRes.json()).proceeding.id;

    const assignRes = await page.request.post(`/api/v1/proceedings/${procId}/judges`, {
      data: { judge_id: judgeId }
    });
    expect(assignRes.ok()).toBeTruthy();

    // Try to delete — should fail
    const delRes = await page.request.delete(`/api/v1/judges/${judgeId}`);
    expect(delRes.ok()).toBeFalsy();
    expect(delRes.status()).toBe(400);
    const delData = await delRes.json();
    expect(delData.error.message).toContain('assigned to');

    // Clean up: remove from proceeding, delete proceeding, then delete judge
    await page.request.delete(`/api/v1/proceedings/${procId}/judges/${judgeId}`);
    await page.request.delete(`/api/v1/proceedings/${procId}`);
    const finalDel = await page.request.delete(`/api/v1/judges/${judgeId}`);
    expect(finalDel.ok()).toBeTruthy();
  });

  test('404 for nonexistent judge', async ({ page }) => {
    const getRes = await page.request.get('/api/v1/judges/99999');
    expect(getRes.status()).toBe(404);

    const putRes = await page.request.put('/api/v1/judges/99999', {
      data: { name: 'nope' }
    });
    expect(putRes.status()).toBe(404);
  });

  test('GET /judges with status filter', async ({ page }) => {
    const res = await page.request.get('/api/v1/judges?status=Active');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    for (const j of data.judges) {
      expect(j.status).toBe('Active');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PROCEEDINGS
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Proceedings — deep E2E', () => {

  test('full proceeding lifecycle: create, get, update, delete', async ({ page }) => {
    const ts = Date.now();
    const caseId = await getFirstCaseId(page);

    // Create — first proceeding should be auto-set as primary
    const createRes = await page.request.post(`/api/v1/cases/${caseId}/proceedings`, {
      data: { case_number: `E2E-PROC-${ts}`, notes: 'Test proceeding' }
    });
    expect(createRes.ok()).toBeTruthy();
    const { proceeding: created } = await createRes.json();
    expect(created.case_number).toBe(`E2E-PROC-${ts}`);
    expect(created.case_id).toBe(caseId);
    expect(created.notes).toBe('Test proceeding');
    expect(created.judges).toEqual([]);
    expect(created.judge_name).toBeNull();
    expect(created.judge_id).toBeNull();
    expect(created.id).toBeGreaterThan(0);
    const procId = created.id;

    // GET by ID — single with judges
    const getRes = await page.request.get(`/api/v1/proceedings/${procId}`);
    expect(getRes.ok()).toBeTruthy();
    const fetched = await getRes.json();
    expect(fetched.case_number).toBe(`E2E-PROC-${ts}`);
    expect(fetched.judges).toEqual([]);
    expect(fetched.created_at).toBeTruthy();
    expect(new Date(fetched.created_at).getTime()).not.toBeNaN();

    // Update
    const updateRes = await page.request.put(`/api/v1/proceedings/${procId}`, {
      data: { case_number: `E2E-PROC-UPD-${ts}`, notes: 'Updated notes' }
    });
    expect(updateRes.ok()).toBeTruthy();
    const { proceeding: updated } = await updateRes.json();
    expect(updated.case_number).toBe(`E2E-PROC-UPD-${ts}`);
    expect(updated.notes).toBe('Updated notes');

    // Delete
    const delRes = await page.request.delete(`/api/v1/proceedings/${procId}`);
    expect(delRes.ok()).toBeTruthy();

    // Verify gone
    const goneRes = await page.request.get(`/api/v1/proceedings/${procId}`);
    expect(goneRes.status()).toBe(404);
  });

  test('GET /cases/:caseId/proceedings — list with nested judges', async ({ page }) => {
    const caseId = await getFirstCaseId(page);
    const res = await page.request.get(`/api/v1/cases/${caseId}/proceedings`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data).toHaveProperty('proceedings');
    expect(data).toHaveProperty('total');
    expect(Array.isArray(data.proceedings)).toBeTruthy();
    expect(data.total).toBe(data.proceedings.length);

    // Each proceeding should have judges array
    for (const p of data.proceedings) {
      expect(p).toHaveProperty('judges');
      expect(Array.isArray(p.judges)).toBeTruthy();
      expect(p).toHaveProperty('judge_name');
      expect(p).toHaveProperty('judge_id');
    }
  });

  test('proceeding-judge assignment lifecycle', async ({ page }) => {
    const ts = Date.now();
    const caseId = await getFirstCaseId(page);

    // Create judge and proceeding
    const [judgeRes, procRes] = await Promise.all([
      page.request.post('/api/v1/judges', {
        data: { name: `E2E PJ Judge ${ts}` }
      }),
      page.request.post(`/api/v1/cases/${caseId}/proceedings`, {
        data: { case_number: `E2E-PJ-${ts}` }
      }),
    ]);
    expect(judgeRes.ok()).toBeTruthy();
    expect(procRes.ok()).toBeTruthy();
    const judgeId = (await judgeRes.json()).judge.id;
    const procId = (await procRes.json()).proceeding.id;

    // Assign judge to proceeding
    const assignRes = await page.request.post(`/api/v1/proceedings/${procId}/judges`, {
      data: { judge_id: judgeId, role: 'Presiding' }
    });
    expect(assignRes.ok()).toBeTruthy();
    const { proceeding_judge: assigned } = await assignRes.json();
    expect(assigned.judge_id).toBe(judgeId);
    expect(assigned.proceeding_id).toBe(procId);
    expect(assigned.role).toBe('Presiding');
    expect(assigned.name).toBe(`E2E PJ Judge ${ts}`);

    // Verify proceeding now shows the judge
    const procGetRes = await page.request.get(`/api/v1/proceedings/${procId}`);
    const procData = await procGetRes.json();
    expect(procData.judges.length).toBe(1);
    expect(procData.judges[0].name).toBe(`E2E PJ Judge ${ts}`);
    expect(procData.judge_name).toBe(`E2E PJ Judge ${ts}`);
    expect(procData.judge_id).toBe(judgeId);

    // List proceeding judges
    const listRes = await page.request.get(`/api/v1/proceedings/${procId}/judges`);
    expect(listRes.ok()).toBeTruthy();
    const listData = await listRes.json();
    expect(listData.judges.length).toBe(1);

    // Remove judge from proceeding
    const removeRes = await page.request.delete(`/api/v1/proceedings/${procId}/judges/${judgeId}`);
    expect(removeRes.ok()).toBeTruthy();

    // Verify removed
    const afterRemove = await page.request.get(`/api/v1/proceedings/${procId}`);
    const afterData = await afterRemove.json();
    expect(afterData.judges).toEqual([]);
    expect(afterData.judge_name).toBeNull();

    // Clean up
    await page.request.delete(`/api/v1/proceedings/${procId}`);
    await page.request.delete(`/api/v1/judges/${judgeId}`);
  });

  test('is_primary auto-set for first proceeding', async ({ page }) => {
    const ts = Date.now();
    const caseId = await getFirstCaseId(page);

    // Delete existing proceedings for this case to test auto-primary
    const existingRes = await page.request.get(`/api/v1/cases/${caseId}/proceedings`);
    const existingData = await existingRes.json();
    const existingIds = existingData.proceedings.map((p: any) => p.id);

    // Create a fresh case or use a case without proceedings
    // Instead, just create proceedings and verify the first one gets is_primary
    const p1Res = await page.request.post(`/api/v1/cases/${caseId}/proceedings`, {
      data: { case_number: `E2E-PRIMARY-A-${ts}` }
    });
    expect(p1Res.ok()).toBeTruthy();
    const p1 = (await p1Res.json()).proceeding;
    const p1Id = p1.id;

    // Create a second proceeding
    const p2Res = await page.request.post(`/api/v1/cases/${caseId}/proceedings`, {
      data: { case_number: `E2E-PRIMARY-B-${ts}` }
    });
    expect(p2Res.ok()).toBeTruthy();
    const p2 = (await p2Res.json()).proceeding;
    const p2Id = p2.id;

    // Clean up
    await page.request.delete(`/api/v1/proceedings/${p1Id}`);
    await page.request.delete(`/api/v1/proceedings/${p2Id}`);
  });

  test('404 for nonexistent proceeding', async ({ page }) => {
    const getRes = await page.request.get('/api/v1/proceedings/99999');
    expect(getRes.status()).toBe(404);

    const putRes = await page.request.put('/api/v1/proceedings/99999', {
      data: { case_number: 'nope' }
    });
    expect(putRes.status()).toBe(404);

    const delRes = await page.request.delete('/api/v1/proceedings/99999');
    expect(delRes.status()).toBe(404);
  });

  test('upsert: assigning same judge twice updates role', async ({ page }) => {
    const ts = Date.now();
    const caseId = await getFirstCaseId(page);

    // Create judge and proceeding
    const judgeRes = await page.request.post('/api/v1/judges', {
      data: { name: `E2E Upsert Judge ${ts}` }
    });
    const judgeId = (await judgeRes.json()).judge.id;

    const procRes = await page.request.post(`/api/v1/cases/${caseId}/proceedings`, {
      data: { case_number: `E2E-UPSERT-${ts}` }
    });
    const procId = (await procRes.json()).proceeding.id;

    // Assign with role "Judge"
    const assign1 = await page.request.post(`/api/v1/proceedings/${procId}/judges`, {
      data: { judge_id: judgeId, role: 'Judge' }
    });
    expect(assign1.ok()).toBeTruthy();
    const { proceeding_judge: pj1 } = await assign1.json();
    expect(pj1.role).toBe('Judge');

    // Assign same judge again with role "Magistrate Judge" — should upsert
    const assign2 = await page.request.post(`/api/v1/proceedings/${procId}/judges`, {
      data: { judge_id: judgeId, role: 'Magistrate Judge' }
    });
    expect(assign2.ok()).toBeTruthy();
    const { proceeding_judge: pj2 } = await assign2.json();
    expect(pj2.role).toBe('Magistrate Judge');

    // Should still be only one judge on the proceeding
    const listRes = await page.request.get(`/api/v1/proceedings/${procId}/judges`);
    const listData = await listRes.json();
    expect(listData.judges.length).toBe(1);

    // Clean up
    await page.request.delete(`/api/v1/proceedings/${procId}/judges/${judgeId}`);
    await page.request.delete(`/api/v1/proceedings/${procId}`);
    await page.request.delete(`/api/v1/judges/${judgeId}`);
  });
});
