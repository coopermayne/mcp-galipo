# QA Test Log — 2026-05-15

Comprehensive quality control sweep of the Galipo web application.
Two rounds of testing: Round 1 (general QA, 50 tests) + Round 2 (live updates & multi-user, partial).

---

## MASTER ISSUES LIST — THINGS TO FIX

### CRITICAL / HIGH

**1. Admin user (id=0) causes 500 errors across the app**
- `POST /api/v1/cases/{id}/read` — FK violation on `case_comment_reads` (user_id=0 not in users table)
- `POST /api/v1/intakes/{id}/read` — same FK violation
- `PUT /api/v1/cases/{id}` — fails when logging system comment with user_id=0
- `POST /api/v1/events` — fails when creating events as admin
- `DELETE /api/v1/intakes/{id}` — fails
- **Impact:** Admin user triggers 500 on nearly every write operation. Fires on every case/intake page load (mark-read). Backend logs fill with stack traces.
- **Fix:** Either insert user_id=0 into users table, or skip mark-read and comment logging for the admin test user.

**2. Non-integer path params return 500 (not 400)**
- `GET /api/v1/cases/abc` — unhandled `ValueError` from `int(path_params["case_id"])`
- Returns plain-text "Internal Server Error" instead of JSON
- **Fix:** Add try/except around `int()` calls in route handlers, return 422 JSON error.

**3. ValidationError not caught in route handlers**
- `GET /api/v1/cases?status=InvalidStatus` → 500 instead of 422
- `db/validation.py` raises `ValidationError` but routes don't catch it
- Any invalid enum value (status, urgency, etc.) crashes the route
- **Fix:** Add global exception handler for `ValidationError` → 422 response.

**4. Negative limit/offset returns 500**
- `GET /api/v1/intakes?limit=-1` or `?offset=-1` → PostgreSQL rejects, no input validation
- **Fix:** Clamp to `limit >= 1, limit <= MAX_LIMIT` and `offset >= 0`.

**5. Cases, Tasks, Events have NO real-time (SSE) updates**
- SSE only covers: `intake`, `comment`, `intake_comment`, `sms_message`, `sms_conversation`
- **NOT covered:** cases, tasks, events, financials, invoices, contacts, users
- Changes by User A to a case/task/event will NOT appear for User B until they refresh the page
- `refetchOnWindowFocus` is disabled, staleTime is 30s — so data can be stale indefinitely
- **Impact:** In a multi-user law firm, one paralegal's changes are invisible to another until full refresh
- **Fix:** Add `broadcast()` calls to `routes/cases.py`, `routes/tasks.py`, `routes/events.py`, etc. Add corresponding entries to `sse-invalidation-map.ts`.

### MEDIUM

**6. Trailing slash on API routes returns non-JSON 404**
- `GET /api/v1/cases/` → plain-text "Not found" (not JSON)
- `GET /api/v1/cases` → works fine
- Affects all routes. Inconsistent with JSON API contract.
- **Fix:** Add `redirect_slashes=True` to FastAPI or register routes with both variants.

**7. CourtListener page: React state update on unmounted component**
- Console error: "Can't perform a React state update on a component that hasn't mounted yet"
- Side-effect in render function should be in `useEffect`
- **Fix:** Move the state update into a `useEffect` hook.

**8. Intakes API search param completely ignored**
- `GET /api/v1/intakes?search=Doe` returns all 1809 results (no filtering)
- Frontend search works (client-side via TanStack Table), but server-side search is broken
- **Fix:** Implement the `search` query parameter in the intakes route handler.

**9. No limit cap on intakes API**
- `GET /api/v1/intakes?limit=999999` returns all 1809 records in one response
- Could cause memory issues with large datasets
- **Fix:** Enforce a maximum limit (e.g., 200).

**10. Sidebar links to Coming Soon templates navigate to blank pages**
- Sidebar > Templates > Case List / Retainer / Disbursement are clickable links
- Hub page correctly disables them (pointer-events-none), but sidebar doesn't
- `/templates/retainer` renders blank page — no route match, no 404
- **Fix:** Either hide these from sidebar nav, or add disabled state to sidebar items.

**11. SSE broadcasts "analyzing" before AI analysis runs — no error event if it fails**
- Intake creation broadcasts `"analyzing"` SSE event before AI analysis starts
- If analysis fails (500), client gets start event but never completion/error event
- Client may show perpetual "analyzing" state
- **Fix:** Add error broadcast on analysis failure, or move broadcast after analysis starts successfully.

### LOW

**12. Tiptap duplicate extension warning**
- Case detail Notes editor: `[tiptap warn]: Duplicate extension names found: ['link', 'underline']`
- The link and underline extensions are registered twice
- **Fix:** Remove duplicate extension registration in the TipTap editor setup.

**13. Trial Calendar dashboard card missing description**
- All dashboard cards have a description subtitle except Trial Calendar
- **Fix:** Add description like "View upcoming trials and find open dates"

**14. React Router HydrateFallback warning on every page**
- "No HydrateFallback element provided to render during initial hydration"
- Benign React Router v7 warning, shows on every page load
- **Fix:** Add a `HydrateFallback` component to the router config.

**15. Dialog accessibility — missing aria-describedby**
- Task detail, Event detail, Add Task, Add Event dialogs all missing `DialogDescription`
- Radix warns: "Missing Description or aria-describedby for DialogContent"
- **Fix:** Add `<DialogDescription>` (can be visually hidden with `sr-only` class).

**16. No 404 fallback in templates sub-router**
- Navigating to undefined template routes (e.g. `/templates/retainer`) shows blank page
- **Fix:** Add catch-all route in templates router that shows "Coming Soon" or redirects to hub.

**17. No CORS headers configured**
- `OPTIONS /api/v1/cases` returns 405 Method Not Allowed
- Currently OK since frontend and API are same-origin, but would break if separated
- **Fix:** Add CORS middleware if cross-origin access is ever needed.

### INFORMATIONAL / UX

**18. API response format inconsistency**
- `/api/v1/users` wraps in `{success: true, data: [...]}` 
- Other endpoints use `{cases: [...]}`, `{tasks: [...]}`, etc.
- Auth endpoints also use `{success: true/false, ...}` wrapper
- Not a bug but inconsistent for API consumers.

**19. "New Intake" button opens AI-only dialog**
- No manual structured form for creating intakes
- Button label "New Intake" could be clearer as "AI Intake"
- Users who want to manually enter structured data have no option from this button.

---

## SECURITY ASSESSMENT — ALL CLEAR

| Check | Result |
|-------|--------|
| SQL Injection | SAFE — parameterized queries via SQLAlchemy ORM |
| XSS | SAFE — API returns JSON, React auto-escapes |
| Auth bypass | SAFE — invalid/expired tokens return 401 |
| Rate limiting | PRESENT — login endpoint rate-limited (5 attempts/60s) |
| Session management | OK — concurrent logins create separate sessions |
| Stack trace exposure | OK — 500s return "Internal Server Error" to client (traces server-side only) |

---

## TESTS COMPLETED

### Round 1 — General QA (50 tests, ALL COMPLETE)

Every page in the app was visited and tested:
- `/` (dashboard), `/login`, `/cases`, `/cases/all`, `/cases/{id}`, `/cases/{id}/costs`
- `/tasks`, `/events`, `/intakes`, `/intakes/{id}`
- `/trial-calendar` (calendar + table views), `/financials`, `/invoices`, `/payees`
- `/contacts` + 7 sub-pages (clients, counsel, experts, defendants, mediators, other, judges)
- `/templates` + 3 sub-pages (pleadings, toa, rfp)
- `/court-listener`, `/sms`, `/users`, `/activity`

Interactive elements tested:
- Login/logout flow
- Data tables: sorting, filtering, search, pagination, column visibility
- Dialogs: Add Task, Add Event, Add User, New Intake, Slot Finder, Add Blocking Event
- Case detail: all sections (tasks, events, notes, financials, people, activity)
- Status changes, inline editing, scope toggles, grouping options
- 20 API endpoints tested for correct responses
- 20 API edge cases tested (invalid IDs, SQL injection, XSS, auth, limits)

### Round 2 — Live Updates & Multi-User (partial, 10/50 tests)

SSE infrastructure (10 tests, ALL COMPLETE):
- SSE connection, heartbeat, auth rejection, multi-client — all work correctly
- Confirmed: intakes, comments, SMS have SSE broadcast
- Confirmed: cases, tasks, events do NOT have SSE broadcast
- Confirmed: no real-time updates for cases/tasks/events across users

Remaining 40 tests were attempted via Playwright agents but got stuck (shared browser conflict). 
The key finding — no SSE for cases/tasks/events — was already confirmed via the infrastructure tests.

---

## SCREENSHOTS

All screenshots saved to `test-screenshots/qa-*.png` and `test-screenshots/qa2-*.png`.

## WHAT'S NEXT

Priority fixes (in order):
1. Fix admin user FK errors (Issue #1) — blocks basic functionality
2. Add SSE broadcasts for cases, tasks, events (Issue #5) — biggest UX gap
3. Add input validation for path params and query params (Issues #2, #3, #4)
4. Fix Coming Soon template sidebar links (Issue #10)
5. Fix CourtListener React error (Issue #7)
