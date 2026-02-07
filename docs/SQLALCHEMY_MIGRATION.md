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
| 6 | `db/cases.py` | 17 | 630 | Done |
| 6 | `db/persons.py` | 16 | 827 | Done |
| 7 | `db/import_case.py` | 10 | 570 | Done |
| 7 | `db/dev_users.py` | 3 | 162 | Done |
| 8 | `db/connection.py` cleanup | — | — | Done |

**Progress: 15/15 db modules migrated to SQLAlchemy ORM**

## Phase 8: connection.py Cleanup (completed)

Removed from `db/connection.py`:
- `serialize_value()`, `serialize_row()`, `serialize_rows()` — no longer used by any db module
- Dead import of `serialize_rows` in `db/roles.py`
- Re-exports removed from `db/__init__.py` and `database.py`

Migrated in `tools.py`:
- Converted the single remaining `get_cursor()` + `serialize_row()` usage (task detail query) to SQLAlchemy ORM

### What remains in connection.py (for future work)

The following are still used by non-db-module code and **cannot be removed yet**:

| Function | Used by |
|----------|---------|
| `get_cursor()` | `services/chat/presets.py` (9 calls), `routes/export.py` (1 call), seed scripts, `init_db()`/`migrate_db()`/`seed_db()` |
| `get_connection()` | Used internally by `get_cursor()` |
| Connection pool (`ThreadedConnectionPool`) | Required by `get_cursor()`/`get_connection()` |
| `_NOT_PROVIDED` | Sentinel shared by all db modules (permanent) |
| `init_db()`, `migrate_db()`, `seed_db()`, `drop_all_tables()` | Startup/admin functions |
| `seed_admin_user()`, `seed_jurisdictions()`, `seed_expertise_types()`, `seed_roles()` | Called by `seed_db()` |

`psycopg2` stays in `requirements.txt` until these remaining usages are migrated.

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
| `e2e-cases.spec.ts` | cases | ~14 |

## Patterns

All migrated modules follow the same pattern:
- `from .session import SessionLocal, _NOT_PROVIDED`
- `with SessionLocal() as session:` context manager
- `_to_dict()` helper with `.isoformat()` for datetimes
- `joinedload()` + `.unique()` for eager-loaded relationships
- `session.flush()` / `session.refresh()` / serialize / `session.commit()` for creates
- `func.now()` for `updated_at` on updates
- `pg_insert().on_conflict_do_update()` for PostgreSQL upserts
