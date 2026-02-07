# SQLAlchemy Migration — Complete

All database access now uses SQLAlchemy. The psycopg2 connection pool has been removed.

Branch: `feat/sqlalchemy-session-layer`

## What happened

1. **15/15 db modules** migrated to SQLAlchemy ORM (phases 1-7)
2. **Phase 8**: Removed serialize helpers from db layer
3. **Phase 9 (final)**: Killed psycopg2 infrastructure entirely
   - Rewrote `db/connection.py`: removed `get_pool()`, `get_cursor()`, `get_connection()`, raw CREATE TABLE in `init_db()`, `migrate_db()`/`run_sql_migrations()`
   - Replaced `init_db()` / `drop_all_tables()` with `Base.metadata.create_all/drop_all`
   - Rewrote seed functions (`seed_admin_user`, `seed_jurisdictions`, `seed_expertise_types`, `seed_roles`) to use `SessionLocal` + `pg_insert().on_conflict_do_nothing()`
   - Migrated `services/chat/presets.py` (9 functions, 22 queries) to `session.execute(text(...))`
   - Migrated `routes/export.py` (1 function, 9 queries) to `session.execute(text(...))`
   - Migrated `seed_dev_users.py` and `seed_webhook_data.py` to `SessionLocal` + `session.execute(text(...))`
   - Deleted `database.py` (backwards-compat shim), updated all importers to `import db`
   - Deleted `migrations/` directory (Alembic handles all migrations now)
   - Deleted `scripts/export_data.py` (superseded by `routes/export.py`)
   - Fixed Dockerfile: added `models.py`, `alembic.ini`, `alembic/`; removed `database.py`, `migrations/`

## Current state of `db/connection.py`

| Symbol | Purpose |
|--------|---------|
| `DATABASE_URL` | Read from env, exported for other modules |
| `_NOT_PROVIDED` | Sentinel shared by all db modules via `session.py` re-export |
| `init_db()` | `Base.metadata.create_all(engine)` |
| `drop_all_tables()` | `Base.metadata.drop_all(engine)` |
| `seed_admin_user()` | Upsert admin user via `pg_insert` |
| `seed_jurisdictions()` | Seed default jurisdictions if empty |
| `seed_expertise_types()` | Seed default expertise types if empty |
| `seed_roles()` | Seed default roles if empty |
| `seed_db()` | Calls all seed functions + dev user seeding |

## Connection strategy

- **Single engine**: `db/session.py` creates the SQLAlchemy engine and `SessionLocal` factory
- **No psycopg2 pool**: All connections go through SQLAlchemy's built-in connection pool
- **Raw SQL queries**: `services/chat/presets.py` and `routes/export.py` use `session.execute(text(...))` — same SQL, SQLAlchemy transport

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
