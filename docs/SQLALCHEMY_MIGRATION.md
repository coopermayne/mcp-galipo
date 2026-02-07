# SQLAlchemy Migration Tracker

Incremental migration from raw psycopg2 SQL to SQLAlchemy ORM sessions.

Branch: `feat/sqlalchemy-session-layer`

## Status Overview

| Phase | Module | Functions | Lines | Status |
|-------|--------|-----------|-------|--------|
| 1 | `db/jurisdictions.py` | 6 | 88 | Done |
| 1 | `db/roles.py` | 8 | ~120 | Done |
| 1 | `db/types.py` (expertise) | 5 | ~80 | Done |
| 2 | `db/notes.py` | 4 | 94 | Done |
| 2 | `db/activities.py` | 5 | ~130 | Done |
| 3 | `db/judges.py` | 10 | ~290 | Done |
| 3 | `db/proceedings.py` | 8 | ~240 | Done |
| 4 | `db/events.py` | ~12 | ~620 | Done |
| 4 | `db/tasks.py` | ~12 | ~620 | Done |
| 5 | `db/users.py` | ~11 | ~410 | Done |
| 5 | `db/webhooks.py` | ~11 | ~230 | Done |
| 6 | `db/cases.py` | 17 | 630 | **Next** |
| 6 | `db/persons.py` | 16 | 827 | Done |
| 7 | `db/import_case.py` | 10 | 570 | Pending |
| 7 | `db/dev_users.py` | 3 | 162 | Pending |
| 8 | `db/connection.py` cleanup | — | 645 | Pending |

**Progress: 12/15 modules migrated (~80% of functions, ~72% of lines)**

## Remaining Work

### Phase 6: Cases (persons done)

`db/persons.py` — **Done** (branch: `feat/sqlalchemy-persons`, 10 E2E tests passing)

`db/cases.py` (17 functions, 630 lines):
- Full case CRUD with complex joins (attorneys, paralegals, proceedings, tasks)
- `get_dashboard_stats` — aggregate query across multiple tables
- Staff assignment helpers (attorney_ids/paralegal_ids array columns)
- `search_cases` — multi-field ILIKE search

### Phase 7: Import + Dev Users (small, low priority)

`db/import_case.py` (10 functions, 570 lines):
- Bulk case import using raw `get_connection()` for manual transaction control
- Creates cases, persons, events, tasks in a single transaction
- May benefit from SQLAlchemy session transaction management

`db/dev_users.py` (3 functions, 162 lines):
- Dev seed data — only runs in dev environments
- Low priority, simple rewrite

### Phase 8: Connection.py Cleanup

Once all modules are migrated:
- Remove `get_cursor()`, `get_connection()`, `serialize_row()`, `serialize_rows()`, `serialize_value()`
- Remove psycopg2 connection pool (`ThreadedConnectionPool`)
- Keep `_NOT_PROVIDED` (re-exported by `session.py`)
- Keep `init_db()` / `migrate_db()` / `seed_db()` (startup tasks) — or migrate these too
- Remove psycopg2 from `requirements.txt` if no longer needed

## E2E Test Coverage

| Test File | Module(s) | Tests |
|-----------|-----------|-------|
| `e2e-roles-types.spec.ts` | roles, expertise_types | ~8 |
| `e2e-jurisdictions-notes.spec.ts` | jurisdictions, notes | ~10 |
| `e2e-activities-cross.spec.ts` | activities | ~6 |
| `e2e-judges-proceedings.spec.ts` | judges, proceedings | 12 |
| `e2e-events-tasks.spec.ts` | events, tasks | ~12 |
| `e2e-users-webhooks.spec.ts` | users, webhooks | ~8 |
| `e2e-persons.spec.ts` | persons | 10 |
| (needed) `e2e-cases.spec.ts` | cases | — |

## Patterns

All migrated modules follow the same pattern:
- `from .session import SessionLocal, _NOT_PROVIDED`
- `with SessionLocal() as session:` context manager
- `_to_dict()` helper with `.isoformat()` for datetimes
- `joinedload()` + `.unique()` for eager-loaded relationships
- `session.flush()` / `session.refresh()` / serialize / `session.commit()` for creates
- `func.now()` for `updated_at` on updates
- `pg_insert().on_conflict_do_update()` for PostgreSQL upserts
