# QA Fixes — 2026-05-15

Issues discovered during comprehensive QA testing (60 tests across 2 rounds).
Each issue includes the root cause, affected files, and a concrete fix plan.

---

## CRITICAL

### 1. Admin user (id=0) causes 500 errors across the app

**Symptom:** Every case and intake page load triggers a 500 error in the background. Case updates, event creation, and intake deletion also fail for the admin user.

**Root cause:** The admin test account has `user_id=0` (set in auth as `sub=0`), but user_id=0 does not exist in the `users` table. Any operation that writes to a table with a FK constraint on `users.id` fails with `IntegrityError: ForeignKeyViolation`.

**Affected endpoints:**
- `POST /api/v1/cases/{id}/read` — inserts into `case_comment_reads` (FK on user_id)
- `POST /api/v1/intakes/{id}/read` — same pattern
- `PUT /api/v1/cases/{id}` — logs system comment with user_id=0
- `POST /api/v1/events` — same
- `DELETE /api/v1/intakes/{id}` — cascade issue

**Affected files:**
- `routes/cases.py:311` — `db.mark_case_read(case_id, user_id)`
- `routes/intakes.py` — similar mark-read call
- `routes/comments.py` — comment creation with user_id
- `db/cases.py` — `mark_case_read()` function
- `auth.py` — where `sub=0` is set for admin

**Fix options (pick one):**
1. **Insert admin into users table** — Add a row `(id=0, email='admin@test.com', ...)` to users table via migration. Simplest fix, makes admin a "real" user.
2. **Skip FK-dependent operations for admin** — In `mark_case_read()`, `log_system_comment()`, etc., check `if user_id == 0: return` to skip. Quick but scattered.
3. **Change admin to use a real user ID** — Modify auth to assign the admin a real users row on first login. Cleanest long-term.

**Verification:** After fix, navigate to any case detail page as admin — no 500 in backend logs, no console errors in browser.

---

### 2. Non-integer path params return 500

**Symptom:** `GET /api/v1/cases/abc` returns plain-text "Internal Server Error" instead of a JSON 400/422.

**Root cause:** Route handlers do `case_id = int(request.path_params["case_id"])` with no try/except. `ValueError` propagates as unhandled 500.

**Affected files:**
- `routes/cases.py:62` — `case_id = int(request.path_params["case_id"])`
- Likely also: `routes/tasks.py`, `routes/events.py`, `routes/intakes.py`, `routes/invoices.py` — any route with `{id}` path param

**Fix:**
```python
# Option A: try/except in each handler
try:
    case_id = int(request.path_params["case_id"])
except (ValueError, TypeError):
    return JSONResponse({"success": False, "error": {"message": "Invalid case ID", "code": "INVALID_PARAM"}}, status_code=422)

# Option B: global exception handler in main.py
@app.exception_handler(ValueError)
async def value_error_handler(request, exc):
    return JSONResponse({"success": False, "error": {"message": str(exc), "code": "INVALID_PARAM"}}, status_code=422)
```

**Verification:** `curl /api/v1/cases/abc` → 422 JSON response, not 500.

---

### 3. ValidationError not caught in route handlers

**Symptom:** `GET /api/v1/cases?status=InvalidStatus` returns 500. SQL injection attempts like `?status='; DROP TABLE cases;--` also return 500 (safe from injection, but wrong error code).

**Root cause:** `db/validation.py` raises a custom `ValidationError` for invalid enum values. Route handlers don't catch it — it bubbles up as an unhandled exception.

**Affected files:**
- `db/validation.py` — raises `ValidationError`
- `routes/cases.py` — doesn't catch it
- Any route that passes user-supplied values through validation

**Fix:** Add a global exception handler in `main.py`:
```python
from db.validation import ValidationError

@app.exception_handler(ValidationError)
async def validation_error_handler(request, exc):
    return JSONResponse(
        {"success": False, "error": {"message": str(exc), "code": "VALIDATION_ERROR"}},
        status_code=422
    )
```

**Verification:** `curl /api/v1/cases?status=FakeStatus` → 422 JSON error, not 500.

---

### 4. Negative limit/offset returns 500

**Symptom:** `GET /api/v1/intakes?limit=-1` or `?offset=-1` crashes because PostgreSQL rejects negative LIMIT/OFFSET.

**Root cause:** No input validation on pagination params before passing to SQL query.

**Affected files:**
- `routes/intakes.py` — where `limit` and `offset` query params are read
- Possibly other list endpoints

**Fix:**
```python
limit = max(1, min(int(request.query_params.get("limit", 50)), 200))  # clamp 1-200
offset = max(0, int(request.query_params.get("offset", 0)))  # clamp >= 0
```

**Verification:** `curl /api/v1/intakes?limit=-1` → 200 with default pagination, not 500.

---

### 5. Cases, Tasks, Events have NO real-time (SSE) updates

**Symptom:** If User A changes a case status, adds a task, or creates an event, User B sees nothing until they manually refresh the page. This is because SSE broadcasts only exist for intakes, comments, and SMS.

**Root cause:** `routes/cases.py`, `routes/tasks.py`, `routes/events.py` never call `broadcast()`. The `sse-invalidation-map.ts` has no entries for `case`, `task`, or `event` entities.

**Affected files (backend — add broadcasts):**
- `routes/cases.py` — add `broadcast({"entity": "case", "action": "updated", "id": case_id})` to PUT/POST/DELETE handlers
- `routes/tasks.py` — add `broadcast({"entity": "task", "action": "created/updated/deleted", "id": task_id})`
- `routes/events.py` — add `broadcast({"entity": "event", "action": "created/updated/deleted", "id": event_id})`
- `routes/invoices.py` — add `broadcast({"entity": "invoice", ...})`
- `routes/financials.py` — add `broadcast({"entity": "financial", ...})`
- `routes/persons.py` — add `broadcast({"entity": "person", ...})`
- `routes/judges.py` — add `broadcast({"entity": "judge", ...})`
- `routes/users.py` — add `broadcast({"entity": "user", ...})`

**Affected files (frontend — add invalidation mappings):**
- `frontend/src/lib/sse-invalidation-map.ts` — add entries:
```typescript
case: (event) => {
  const keys = ["cases", "case-counts"]
  if (event.id) keys.push(["case", event.id])
  return keys
},
task: (event) => {
  const keys = ["tasks"]
  if (event.id) keys.push(["task", event.id])
  if (event.case_id) keys.push(["case", event.case_id]) // refresh parent case
  return keys
},
event: (event) => {
  const keys = ["events", "trial-calendar"]
  if (event.id) keys.push(["event", event.id])
  if (event.case_id) keys.push(["case", event.case_id])
  return keys
},
invoice: (event) => {
  const keys = ["invoices", "invoice-stats"]
  if (event.case_id) keys.push(["case-costs", event.case_id])
  return keys
},
person: () => ["persons"],
user: () => ["users"],
```

**Pattern to follow:** Look at how `routes/intakes.py` calls `broadcast()` — copy that pattern to the other route files. Import `broadcast` from `routes/sse.py`.

**Verification:** Open app in two browser tabs as different users. Change a case status in tab 1 — tab 2 should update within 1-2 seconds without refresh.

---

## MEDIUM

### 6. Trailing slash on API routes returns non-JSON 404

**Symptom:** `GET /api/v1/cases/` → plain text "Not found". `GET /api/v1/cases` → works.

**Affected files:**
- `main.py` — FastAPI/Starlette app config

**Fix:** Add redirect middleware or configure `redirect_slashes=True`:
```python
app = FastAPI(redirect_slashes=True)
```
Or if using Starlette routes directly, register both `/cases` and `/cases/`.

**Verification:** `curl /api/v1/cases/` → 307 redirect to `/api/v1/cases`, or direct 200 response.

---

### 7. CourtListener page: React state update on unmounted component

**Symptom:** Console error on `/court-listener`: "Can't perform a React state update on a component that hasn't mounted yet. This indicates that you have a side-effect in your render function that asynchronously tries to update the component."

**Affected files:**
- `frontend/src/pages/court-listener/index.tsx` — or a component it renders

**Fix:** Find the state update that runs during render (likely a `setState` call outside of `useEffect`) and move it into a `useEffect` hook. Search for `useState` + immediate `set*` calls in the component body.

**Verification:** Navigate to `/court-listener` — zero console errors.

---

### 8. No limit cap on intakes API

**Symptom:** `GET /api/v1/intakes?limit=999999` returns all 1809 records in one response.

**Affected files:**
- `routes/intakes.py` — where limit param is read

**Fix:** `limit = min(int(limit), 200)` — enforce a max of 200 (or whatever is appropriate).

**Verification:** `curl /api/v1/intakes?limit=999999` → returns at most 200 records.

---

### 9. Sidebar links to Coming Soon templates navigate to blank pages

**Symptom:** Sidebar shows Case List, Retainer, Disbursement as clickable links. Clicking them navigates to `/templates/case-list` etc. which render blank (no route defined, no 404 fallback).

**Affected files:**
- `frontend/src/components/layout/nav-data.ts` — sidebar nav items for templates
- `frontend/src/pages/templates/index.tsx` — router config (no catch-all)

**Fix (two parts):**
1. In `nav-data.ts`: add a `disabled: true` or `comingSoon: true` flag to Case List, Retainer, Disbursement items. In the sidebar renderer, render disabled items as non-clickable (gray text, no link).
2. In `pages/templates/index.tsx`: add a catch-all route that redirects to `/templates` or shows "Coming Soon".

**Verification:** Click "Case List" in sidebar — nothing happens (or shows "Coming Soon" message). Direct URL `/templates/retainer` → redirects to `/templates` hub.

---

### 10. SSE broadcasts "analyzing" with no error event on failure

**Symptom:** Intake creation broadcasts `"analyzing"` SSE event immediately. If AI analysis then fails (500), no `"analysis_failed"` event is sent. Client may show perpetual "analyzing" spinner.

**Affected files:**
- `routes/intakes.py` or `services/intake_ai.py` — where analysis is triggered and broadcast happens

**Fix:** Wrap the analysis call in try/except. On failure, broadcast `{"entity": "intake", "action": "analysis_failed", "id": intake_id}`. Add `"analysis_failed"` to the `SERVER_SIDE_ACTIONS` set in `sse-invalidation-map.ts`.

**Verification:** Create intake with invalid data that causes analysis failure → client receives "analysis_failed" event and shows appropriate state.

---

## LOW

### 11. Tiptap duplicate extension warning

**Symptom:** Console warning: `[tiptap warn]: Duplicate extension names found: ['link', 'underline']`

**Affected files:**
- Wherever TipTap editor is configured — likely `frontend/src/components/common/rich-text-editor.tsx` or similar. Search for `useEditor` or `EditorProvider` and check if `Link` and `Underline` extensions are listed twice.

**Fix:** Remove the duplicate extension entries from the extensions array.

---

### 12. Trial Calendar dashboard card missing description

**Symptom:** All dashboard cards have a subtitle description except Trial Calendar.

**Affected files:**
- `frontend/src/pages/dashboard/index.tsx` — or wherever dashboard card data is defined

**Fix:** Add description like `"View upcoming trials and find open dates"` to the Trial Calendar card config.

---

### 13. React Router HydrateFallback warning on every page

**Symptom:** "No HydrateFallback element provided to render during initial hydration" on every page load.

**Affected files:**
- `frontend/src/main.tsx` — where `createBrowserRouter` is called

**Fix:** Add `hydrateFallbackElement` to the router config:
```typescript
const router = createBrowserRouter(routes, {
  hydrateFallbackElement: <div />,  // or a loading spinner
})
```

---

### 14. No 404 fallback in templates sub-router

**Symptom:** `/templates/retainer` shows blank page.

**Affected files:**
- `frontend/src/pages/templates/index.tsx` — router config

**Fix:** Add a catch-all route:
```tsx
{ path: "*", element: <Navigate to="/templates" replace /> }
```

---

### 15. No CORS headers

**Symptom:** `OPTIONS /api/v1/cases` returns 405. No CORS middleware.

**Affected files:**
- `main.py`

**Fix:** Only needed if frontend will ever be served from a different origin. If needed:
```python
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], ...)
```

---

## INFORMATIONAL (no fix needed, just awareness)

### 16. API response format inconsistency
- `/api/v1/users` → `{success: true, data: [...]}`
- Other endpoints → `{cases: [...]}`, `{tasks: [...]}`, etc.
- Auth endpoints → `{success: true/false, token: ...}`
- Consider standardizing if building external API consumers.

### 17. "New Intake" button is AI-only
- Opens AI intake dialog, no manual form option
- Consider renaming button to "AI Intake" or adding a separate "Manual Intake" option.

---

## TESTING COVERAGE

### Pages tested (all 18 routes + sub-pages):
`/`, `/login`, `/cases`, `/cases/all`, `/cases/{id}`, `/cases/{id}/costs`, `/tasks`, `/events`, `/intakes`, `/intakes/{id}`, `/trial-calendar`, `/financials`, `/invoices`, `/payees`, `/contacts` (+7 sub-pages), `/templates` (+3 sub-pages), `/court-listener`, `/sms`, `/users`, `/activity`

### API endpoints tested (20):
Auth (login, verify, logout), cases (list, detail, counts, CRUD), tasks (list, CRUD), events (list, CRUD), intakes (list, detail, counts), users (list), financials, invoices, payees, persons, trial-calendar, webhooks, SMS conversations, activity, health

### Edge cases tested (20):
Non-existent resources (404s), invalid IDs, empty request bodies, SQL injection, XSS, invalid auth tokens, negative pagination, huge page sizes, double login, CORS

### SSE tests (10):
Connection, heartbeat, auth rejection, multi-client, intake events, comment events, case events (confirmed missing), task events (confirmed missing), event events (confirmed missing)

### Screenshots:
30+ screenshots saved in `test-screenshots/qa-*.png` and `test-screenshots/qa2-*.png`
