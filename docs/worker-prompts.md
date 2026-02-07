# Worker Prompts for SQLAlchemy Migration Phase 6-7

Three parallel workers. Each checks out its branch, does the migration, commits, and pushes.

---

## Worker 1 (mcp-galipo): `feat/sqlalchemy-cases`

```
Implement the following plan:

# Plan: Migrate db/cases.py to SQLAlchemy ORM

## Context

Phase 6 of the SQLAlchemy migration. Replace raw psycopg2 SQL with SQLAlchemy ORM sessions in `db/cases.py` (17 functions, 630 lines).

Branch: `feat/sqlalchemy-cases` (already exists, branched from `feat/sqlalchemy-session-layer`)

## Files to modify

| File | Action |
|------|--------|
| `db/cases.py` | Rewrite 17 functions from psycopg2 → SQLAlchemy |
| `schemas.py` | Add `CaseOut`, `CaseSummaryOut` output schemas |
| `frontend/tests/e2e-cases.spec.ts` | New — Playwright E2E tests |

No changes to `routes/cases.py` — it calls db functions via `database as db` barrel and the function signatures stay identical.

## Key patterns to follow

**Established pattern** (from jurisdictions, notes, judges, proceedings migrations):
- `from .session import SessionLocal, _NOT_PROVIDED` + `with SessionLocal() as session:`
- `_to_dict()` helper converts ORM instances to serializable dicts with `.isoformat()` for datetimes
- `session.flush()` → `session.refresh()` → serialize → `session.commit()` → return dict
- `joinedload()` + `.unique()` for eager-loaded relationships
- `func.now()` for `updated_at` on updates

**Important — `_NOT_PROVIDED` sentinel**: `db/session.py` re-imports from `db/connection.py`. Routes use `db._NOT_PROVIDED` via the barrel. They must be the same object for `is not` checks.

**Important — `api_error()` response shape**: `{"success": false, "error": {"message": "...", "code": "..."}}` — `error` is an object, not a string.

**New for this migration:**
- **ARRAY columns** (`attorney_ids`, `paralegal_ids`): These are `ARRAY(Integer())` columns. SQLAlchemy handles them natively — assign Python lists directly. For the `&&` (overlap) operator, use `Case.attorney_ids.overlap(ids)`. For `ANY()` containment checks, use `Case.attorney_ids.any(user_id)`.
- **Correlated subqueries**: `get_all_cases` and `get_case_summary` use correlated subqueries for counts (pending tasks, upcoming events, client count, etc.). In SQLAlchemy, use `select(func.count(...)).where(...).correlate(Case).scalar_subquery()`.
- **`update_case` uses `**kwargs`**: The route passes `**data` directly. Keep the `kwargs` signature.
- **`CASE_COLORS` constant**: Keep it in the module — it's just a list, not SQL.
- **Validation functions** (`validate_case_status`, `validate_date_format`): Keep calling these — they're from `db/validation.py`.
- **`get_case_by_id` returns deeply nested data**: It fetches attorneys, paralegals, persons, activities, events, tasks, notes, proceedings. Use multiple queries within the same session (not joinedload for everything — that would be too many joins). The existing pattern of separate queries per sub-entity is fine.

## Implementation steps

### 1. Rewrite `db/cases.py` (17 functions)

Helper:
- `CASE_COLORS` list (keep as-is)
- `_case_to_dict(c: Case) -> dict` — serialize basic case fields

Functions:
1. `get_next_case_color()` — `select(func.count(Case.id))`, return `CASE_COLORS[count % len(CASE_COLORS)]`
2. `get_all_cases(status_filter, limit, offset, attorney_ids, unassigned)` — complex query with correlated subqueries for judge name, client_count, defendant_count, pending_task_count, upcoming_event_count. Use `.scalar_subquery()` for each.
3. `get_case_by_id(case_id)` — fetch case, then separate queries for: attorneys (via User where id in attorney_ids), paralegals (same), persons (via person_roles join), activities, events, tasks (with event join), notes, proceedings (with judges)
4. `get_case_by_name(case_name)` — simple select + delegate to `get_case_by_id`
5. `get_all_case_names()` — simple `select(Case.case_name).order_by(Case.case_name)`
6. `create_case(...)` — validate, get next color, create Case, commit, return `get_case_by_id`
7. `update_case(case_id, **kwargs)` — iterate allowed_fields, validate, set attrs, commit, return `get_case_by_id`
8. `delete_case(case_id)` — `session.get()`, `session.delete()`, `session.commit()`
9. `search_cases(query, case_number, person_name, status, limit)` — ILIKE + EXISTS subqueries
10. `get_case_summary(case_id)` — case + correlated subquery counts
11. `get_dashboard_stats(attorney_ids)` — aggregate queries with optional attorney filter
12. `get_case_users(case_id)` — fetch attorney_ids/paralegal_ids arrays, then fetch User objects
13. `assign_attorney_to_case(case_id, user_id)` — get arrays, append, update, auto-assign paralegal
14. `remove_attorney_from_case(case_id, user_id)` — get array, remove, update
15. `assign_paralegal_to_case(case_id, user_id)` — get array, append, update
16. `remove_paralegal_from_case(case_id, user_id)` — get array, remove, update
17. `get_cases_for_user(user_id, role)` — filter by `ANY(attorney_ids)` or `ANY(paralegal_ids)`

### 2. Add output schemas to `schemas.py`

Add `CaseOut` and `CaseSummaryOut` Pydantic models with `from_attributes=True`.

### 3. Write Playwright E2E tests

`frontend/tests/e2e-cases.spec.ts`:

**Tests (~8-10):**
- GET `/api/v1/cases` — list with pagination, verify structure (judges, counts)
- POST `/api/v1/cases` — create with all fields, verify auto-color assignment
- GET `/api/v1/cases/{id}` — verify full nested response (attorneys, persons, events, tasks, notes, proceedings)
- PUT `/api/v1/cases/{id}` — update individual fields, verify unchanged fields preserved
- DELETE `/api/v1/cases/{id}` — success + verify gone
- GET `/api/v1/cases/search?query=<partial>` — search by name
- GET `/api/v1/cases/{id}/summary` — verify lightweight summary with counts
- POST/DELETE attorney/paralegal assignment cycle
- 404 for nonexistent case

## Verification

```bash
source ~/.nvm/nvm.sh && nvm use 20
cd frontend && VITE_PORT=5173 npx playwright test tests/e2e-cases.spec.ts --reporter=line
curl -s http://localhost:8000/api/v1/cases | python3 -m json.tool | head -20
```
```

---

## Worker 2 (mcp-galipo_2): `feat/sqlalchemy-persons`

```
Implement the following plan:

# Plan: Migrate db/persons.py to SQLAlchemy ORM

## Context

Phase 6 of the SQLAlchemy migration. Replace raw psycopg2 SQL with SQLAlchemy ORM sessions in `db/persons.py` (16 functions, 827 lines). This is the largest and most complex module.

Branch: `feat/sqlalchemy-persons` (already exists, branched from `feat/sqlalchemy-session-layer`)

## Files to modify

| File | Action |
|------|--------|
| `db/persons.py` | Rewrite 16 functions from psycopg2 → SQLAlchemy |
| `schemas.py` | Add `PersonOut`, `PersonRoleOut` output schemas |
| `frontend/tests/e2e-persons.spec.ts` | New — Playwright E2E tests |

No changes to `routes/persons.py` — it calls db functions via `database as db` barrel and the function signatures stay identical.

## Key patterns to follow

**Established pattern** (from jurisdictions, notes, judges, proceedings migrations):
- `from .session import SessionLocal, _NOT_PROVIDED` + `with SessionLocal() as session:`
- `_to_dict()` helper converts ORM instances to serializable dicts with `.isoformat()` for datetimes
- `session.flush()` → `session.refresh()` → serialize → `session.commit()` → return dict
- `joinedload()` + `.unique()` for eager-loaded relationships
- `func.now()` for `updated_at` on updates

**Important — `_NOT_PROVIDED` sentinel**: `db/session.py` re-imports from `db/connection.py`. Routes use `db._NOT_PROVIDED` via the barrel. They must be the same object for `is not` checks.

**Important — `api_error()` response shape**: `{"success": false, "error": {"message": "...", "code": "..."}}` — `error` is an object, not a string.

**New for this migration:**
- **JSONB columns** (phones, emails, attributes): Assign Python lists/dicts directly, no `json.dumps()` needed.
- **`person_roles` junction table**: Complex joins with roles, cases, persons (for grouped_under). Use `joinedload` for the role relationship, separate queries for case data.
- **Nested `role` object in response**: The existing code builds `person["role"] = {"id": ..., "name": ..., "category": ...}` — this structure must be preserved for frontend compatibility.
- **`_validate_and_ensure_expertises()`**: This helper does a cursor-based query. Convert to use the session — `session.execute(select(Role.category).where(Role.id == role_id))`, etc.
- **`search_persons` has many filter conditions**: Uses EXISTS subqueries for role_id, category, case_id, unassigned, user_id. Convert each to SQLAlchemy `exists()` with `select(PersonRole.id).where(...)`.
- **`merge_persons`**: Complex multi-table transaction. This is the hardest function. It does: delete conflicting assignments, reassign person_roles, update grouped_under references, merge fields (phones/emails union by value, notes concatenation), then delete secondary person. Keep it in a single `with SessionLocal() as session:` block.
- **`include_roles` flag in `search_persons`**: When true, does a second query to fetch all roles for the returned persons and builds a roles_map. Use `.in_()` for the person_ids filter.
- **`change_person_role_on_case`**: Imports `ValidationError` from validation — keep that import.

## Implementation steps

### 1. Rewrite `db/persons.py` (16 functions)

Helpers:
- `_validate_and_ensure_expertises(session, role_id, attributes)` — same logic, using session
- `_person_to_dict(p: Person) -> dict` — serialize basic person fields
- `_person_assignment_to_dict(row)` — serialize a person+role assignment row with nested `role` object

Functions:
1. `create_person(name, phones, emails, address, organization, notes, **kwargs)` — create Person with JSONB fields, flush/refresh, serialize, commit
2. `get_person_by_id(person_id)` — fetch person, then fetch role assignments with joins to roles, cases, grouped_under persons
3. `update_person(person_id, **kwargs)` — iterate allowed_fields, set attrs (JSONB natively), commit, return `get_person_by_id`
4. `search_persons(name, role_id, category, ..., include_roles, limit, offset)` — build conditions list, count query + data query, optional roles fetch
5. `delete_person(person_id)` — clear grouped_under refs, then delete
6. `archive_person(person_id)` — set archived=true, return `get_person_by_id`
7. `assign_person_to_case(case_id, person_id, role_id, ...)` — check existing, upsert, return full assignment
8. `update_case_assignment(assignment_id, **kwargs)` — validate expertises, update fields
9. `change_person_role_on_case(case_id, person_id, old_role_id, new_role_id)` — check conflicts, update role, clear grouped_under
10. `remove_person_from_case(case_id, person_id, role_id)` — clear grouped_under refs, delete assignment(s)
11. `get_case_persons(case_id, role_id, category)` — filtered query with joins
12. `find_duplicate_persons()` — CTE with name grouping (use `func.lower(func.trim(Person.name))`)
13. `_check_merge_conflicts(session, person_ids)` — check for overlapping assignments
14. `preview_merge(primary_id, secondary_id)` — fetch both, find field + assignment conflicts
15. `merge_persons(primary_id, secondary_id, field_resolutions)` — complex multi-step merge in single session
16. (helper) `_validate_and_ensure_expertises` already counted above

### 2. Add output schemas to `schemas.py`

Add `PersonOut` and `PersonRoleOut` Pydantic models with `from_attributes=True`.

### 3. Write Playwright E2E tests

`frontend/tests/e2e-persons.spec.ts`:

**Tests (~8-10):**
- POST `/api/v1/persons` — create with JSONB phones/emails
- GET `/api/v1/persons/{id}` — verify all fields + roles array
- PUT `/api/v1/persons/{id}` — update name, phones, organization
- GET `/api/v1/persons/search?name=<partial>` — search with pagination
- POST `/api/v1/cases/{caseId}/persons` — assign person to case with role
- PUT `/api/v1/cases/{caseId}/persons/{assignmentId}` — update assignment
- DELETE `/api/v1/cases/{caseId}/persons/{personId}` — remove from case
- GET `/api/v1/cases/{caseId}/persons` — list with nested role objects
- DELETE `/api/v1/persons/{id}` — delete person
- 404 for nonexistent person
- Duplicate detection (if endpoint exposed)

## Verification

```bash
source ~/.nvm/nvm.sh && nvm use 20
cd frontend && VITE_PORT=5174 npx playwright test tests/e2e-persons.spec.ts --reporter=line
curl -s "http://localhost:8001/api/v1/persons/search?limit=3" | python3 -m json.tool | head -20
```
```

---

## Worker 3 (mcp-galipo_3): `feat/sqlalchemy-import-devusers`

```
Implement the following plan:

# Plan: Migrate db/import_case.py and db/dev_users.py to SQLAlchemy ORM

## Context

Phase 7 of the SQLAlchemy migration. Replace raw psycopg2 SQL with SQLAlchemy ORM sessions in `db/import_case.py` (10 functions, 570 lines) and `db/dev_users.py` (3 functions, 162 lines).

Branch: `feat/sqlalchemy-import-devusers` (already exists, branched from `feat/sqlalchemy-session-layer`)

## Files to modify

| File | Action |
|------|--------|
| `db/import_case.py` | Rewrite 10 functions from psycopg2 → SQLAlchemy |
| `db/dev_users.py` | Rewrite 3 functions from psycopg2 → SQLAlchemy |
| `frontend/tests/e2e-import.spec.ts` | New — Playwright E2E tests for import |

No route changes needed.

## Key patterns to follow

**Established pattern** (from jurisdictions, notes, judges, proceedings migrations):
- `from .session import SessionLocal` + `with SessionLocal() as session:`
- `_to_dict()` helper converts ORM instances to serializable dicts with `.isoformat()` for datetimes
- `session.flush()` → `session.refresh()` → serialize → `session.commit()` → return dict
- `func.now()` for `updated_at` on updates

**Important — `api_error()` response shape**: `{"success": false, "error": {"message": "...", "code": "..."}}` — `error` is an object, not a string.

**New for this migration:**
- **`import_case` uses `get_connection()` for manual transactions**: Replace with a single `with SessionLocal() as session:` block. SQLAlchemy sessions handle transactions natively — everything within the `with` block is one transaction. If an exception occurs, it rolls back.
- **JSONB columns**: Assign Python lists/dicts directly, no `json.dumps()` needed. This applies to `phones`, `emails`, `attributes` in persons/person_roles, and `payload`/`headers` in other tables.
- **`_get_or_create_role_id`**: Uses cursor. Convert to `session.scalars(select(Role).where(func.lower(Role.name) == func.lower(role_name))).first()`.
- **`_validate_and_ensure_expertises`**: Not used in import_case, but `_create_person_and_assign` does manual role lookups.
- **`psycopg2.extras.RealDictCursor`**: Remove this import — not needed with SQLAlchemy.
- **`dev_users.py` uses ON CONFLICT upsert**: Use `from sqlalchemy.dialects.postgresql import insert as pg_insert` with `.on_conflict_do_update()`, same pattern as `add_judge_to_proceeding` in the already-migrated `db/judges.py`.
- **`dev_users.py` helper functions**: `is_dev_environment()` and `_hash_password()` are pure Python — no SQL needed, keep as-is. Only `seed_dev_users()` needs migration.

## Implementation steps

### 1. Rewrite `db/import_case.py` (10 functions)

The main function `import_case(data)` orchestrates everything in a single transaction. Replace `get_connection()` + manual cursor with `SessionLocal()`.

Functions:
1. `import_case(data)` — main orchestrator. Use `with SessionLocal() as session:` wrapping all sub-calls. Pass `session` to all helper functions. On success, `session.commit()`. On exception, session auto-rolls-back.
2. `_create_case(session, case_data)` — `Case(...)`, `session.add()`, `session.flush()`, return `case.id`
3. `_create_person_and_assign(session, case_id, person_data)` — create Person, optionally create PersonRole
4. `_get_or_create_role_id(session, role_name)` — `select(Role).where(func.lower(Role.name) == func.lower(name))`
5. `_infer_role_category(role_name)` — pure Python, no changes needed
6. `_create_proceeding(session, case_id, proc_data)` — create Proceeding, handle jurisdiction lookup/create, handle judges
7. `_create_event(session, case_id, event_data)` — create Event
8. `_create_note(session, case_id, note_data)` — create Note
9. `_create_activity(session, case_id, activity_data)` — create Activity
10. `_assign_attorneys(session, case_id, attorney_ids)` — fetch users, build arrays, update case

Key change: All helper functions take `session` as first arg instead of `cur`. Replace `cur.execute(SQL, params)` → SQLAlchemy ORM operations. Replace `cur.fetchone()["id"]` → `obj.id` after flush.

### 2. Rewrite `db/dev_users.py` (3 functions)

1. `is_dev_environment()` — pure Python, no changes
2. `_hash_password(password)` — pure Python, no changes
3. `seed_dev_users()` — replace `get_cursor()` + raw SQL with `SessionLocal()` + `pg_insert(User).on_conflict_do_update()`. Two passes: first upsert all users, then update paralegal relationships.

### 3. Write Playwright E2E tests

`frontend/tests/e2e-import.spec.ts`:

**Tests (~5-6):**
- POST `/api/v1/import` — import a minimal case (just case + one person)
- POST `/api/v1/import` — import with proceedings + judges (verify auto-created judges)
- POST `/api/v1/import` — import with events, notes, activities
- POST `/api/v1/import` — import with attorney assignment (verify auto-paralegal)
- POST `/api/v1/import` — validation error (missing case_name)
- Verify imported case appears in GET `/api/v1/cases/{id}` with all nested data

## Verification

```bash
source ~/.nvm/nvm.sh && nvm use 20
cd frontend && VITE_PORT=5175 npx playwright test tests/e2e-import.spec.ts --reporter=line

# Quick smoke test
curl -s http://localhost:8002/api/v1/cases | python3 -m json.tool | head -10
```
```

---

## Setup for each worker

Each worker should start with:

```bash
git fetch origin
git checkout feat/sqlalchemy-<branch-name>
git pull origin feat/sqlalchemy-<branch-name>
/dev
```

After implementation + tests pass:

```bash
git add <files>
git commit -m "refactor: migrate db/<module>.py to SQLAlchemy ORM"
git push origin feat/sqlalchemy-<branch-name>
```

Then integrate all 3 branches back into `feat/sqlalchemy-session-layer` from mcp-galipo_2.
