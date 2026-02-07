# SQLAlchemy Migration Plan — Phase 2+

## Status

**Phase 1 (Complete):** SQLAlchemy models + Alembic baseline
- `models.py` — 15 ORM models reverse-engineered from live DB
- `alembic/` — initialized, baseline stamped at `bb79fda85ea4`
- `requirements.txt` — sqlalchemy + alembic added
- All docs updated

**Phase 2 (Next):** Session layer + first module migrations

---

## Phase 2: Session Layer + Simple Modules

### Step 1: Create `db/session.py`

New file that sets up the SQLAlchemy engine and session factory. This runs alongside the existing `get_cursor()` — no need to remove it yet.

```python
# db/session.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

engine = create_engine(os.environ["DATABASE_URL"])
SessionLocal = sessionmaker(bind=engine)

def get_session():
    """Context manager for database sessions."""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
```

Then wire it into FastAPI as a dependency so routes can use it:

```python
# In routes, eventually:
from fastapi import Depends
from db.session import get_session

@router.post("/api/v1/jurisdictions")
async def create_jurisdiction(data: ..., session = Depends(get_session)):
    ...
```

For now, `db/` functions can also use it directly:

```python
from db.session import SessionLocal

def get_jurisdictions():
    with SessionLocal() as session:
        return session.query(Jurisdiction).all()
```

### Step 2: Migrate simple modules (one at a time)

These modules have the fewest queries and simplest logic. Migrate in this order:

| Module | Queries | Complexity | Notes |
|--------|---------|------------|-------|
| `db/jurisdictions.py` | ~6 | Low | Pure CRUD, no relationships needed |
| `db/notes.py` | ~6 | Low | Just case_id FK |
| `db/roles.py` | ~10 | Low | Simple lookup table |
| `db/types.py` | ~6 | Low | Has deletion guard (check person_roles.attributes) |
| `db/activities.py` | ~8 | Low | case_id FK, date fields |

**For each module:**

1. Rewrite functions to use SQLAlchemy session instead of `get_cursor()`
2. Return Pydantic models (or dicts via `.model_dump()`) instead of raw RealDictCursor rows
3. Update the corresponding `routes/` file to use the new functions
4. Update the corresponding `tools/` file if it calls these db functions
5. Test via the frontend and/or MCP tools
6. Commit

### Step 3: Add Pydantic output schemas

`schemas.py` currently only has input models. Add output models for the migrated tables:

```python
# In schemas.py (or a new schemas/ package if it gets big)

class JurisdictionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    local_rules_link: str | None = None
    notes: str | None = None
    created_at: datetime | None = None
```

The `from_attributes=True` config lets Pydantic read directly from SQLAlchemy model instances — no manual dict conversion needed.

---

## Phase 3: Medium Complexity Modules

| Module | Queries | Complexity | Notes |
|--------|---------|------------|-------|
| `db/users.py` | ~12 | Medium | Self-referencing paralegal FK, bcrypt auth |
| `db/judges.py` | ~12 | Medium | JSONB phones/emails, jurisdiction relationship |
| `db/events.py` | ~15 | Medium | ARRAY attendee_ids, date/time handling |
| `db/tasks.py` | ~20 | Medium | Sort order logic, bulk updates, urgency CHECK |
| `db/proceedings.py` | ~15 | Medium | CourtListener integration, proceeding_judges M2M |
| `db/webhooks.py` | ~10 | Medium | JSONB payload/headers, idempotency |

**Key challenges:**
- JSONB queries (phones, emails, attributes) — use `cast()` and PostgreSQL JSONB operators
- ARRAY columns (attendee_ids, attorney_ids) — use `func.any()` or `.contains()`
- Bulk operations in tasks — SQLAlchemy `update().where()` for mass status changes
- Sort order reindexing — may be cleaner to keep as raw SQL via `session.execute(text(...))`

---

## Phase 4: Heavy Hitters

| Module | Queries | Complexity | Notes |
|--------|---------|------------|-------|
| `db/cases.py` | ~35 | High | Dashboard stats, staff assignment arrays, complex aggregations |
| `db/persons.py` | ~45 | High | Duplicate detection, merge logic, expertise validation, grouped_under |

**Strategy for complex queries:**
- Use SQLAlchemy Core (`select()`, `func`, `case()`) rather than ORM for aggregations
- Keep raw SQL via `session.execute(text(...))` for the most complex queries (dashboard stats, merge)
- Don't force every query into ORM style — readability matters

---

## Phase 5: Cleanup

Once all modules are migrated:

1. **Remove `get_cursor()` and psycopg2 connection pool** from `db/connection.py`
2. **Remove `database.py`** barrel re-export (update imports in routes/tools)
3. **Remove `db/__init__.py`** barrel (417 lines of re-exports)
4. **Remove `db/validation.py`** — validators should live in Pydantic schemas or SQLAlchemy model methods
5. **Remove `psycopg2-binary`** from requirements.txt (if no longer needed)
6. **Remove `init_db()`** from `db/connection.py` — Alembic owns schema creation now
7. **Remove old `migrations/`** SQL files and `schema_migrations` table
8. **Update Dockerfile** if any files were added/removed

---

## Decisions to Make

These don't need to be decided upfront — decide as you go:

### Sync vs Async?
- **Current:** All db functions are sync, called via `asyncio.to_thread()` in routes
- **Option A (simpler):** Stay sync with SQLAlchemy's sync engine — same pattern, less risk
- **Option B (full async):** Switch to `AsyncSession` + `asyncpg` — more work, better performance
- **Recommendation:** Start with sync. Switch to async later if needed.

### Where do Pydantic output schemas live?
- **Option A:** Keep everything in `schemas.py` (fine until ~50 models)
- **Option B:** Split into `schemas/` package with `cases.py`, `tasks.py`, etc.
- **Recommendation:** Start in `schemas.py`, split when it gets unwieldy.

### How to handle the `database.py` barrel during migration?
- It re-exports everything from `db/` so routes can do `import database as db`
- **During migration:** Keep it working — just update re-exports as functions change
- **After migration:** Remove it, have routes import from `db/` directly

---

## Migration Pattern (template for each module)

Here's the step-by-step for converting any `db/` module:

```python
# BEFORE (db/jurisdictions.py)
from db.connection import get_cursor

def get_jurisdictions():
    with get_cursor() as cur:
        cur.execute("SELECT * FROM jurisdictions ORDER BY name")
        return cur.fetchall()  # returns list of RealDictRow

def create_jurisdiction(name, local_rules_link=None, notes=None):
    with get_cursor() as cur:
        cur.execute(
            "INSERT INTO jurisdictions (name, local_rules_link, notes) VALUES (%s, %s, %s) RETURNING *",
            (name, local_rules_link, notes)
        )
        return cur.fetchone()
```

```python
# AFTER (db/jurisdictions.py)
from sqlalchemy import select
from db.session import SessionLocal
from models import Jurisdiction

def get_jurisdictions():
    with SessionLocal() as session:
        stmt = select(Jurisdiction).order_by(Jurisdiction.name)
        return session.scalars(stmt).all()

def create_jurisdiction(name, local_rules_link=None, notes=None):
    with SessionLocal() as session:
        j = Jurisdiction(name=name, local_rules_link=local_rules_link, notes=notes)
        session.add(j)
        session.flush()  # get the ID
        session.commit()
        session.refresh(j)
        return j
```

The route/tool layer may need minor updates if it was accessing dict keys (`row["name"]`) vs attributes (`row.name`), but Pydantic's `from_attributes=True` handles most of this automatically.

---

## Files That Will Be Created/Modified

### New files
- `db/session.py` — SQLAlchemy engine + session factory

### Modified files (per module migration)
- `db/<module>.py` — rewrite queries
- `routes/<module>.py` — update if return types change
- `tools/<module>.py` or `tools.py` — update if return types change
- `schemas.py` — add output models
- `database.py` — update re-exports
- `db/__init__.py` — update re-exports

### Eventually removed
- `db/validation.py` — logic moves to Pydantic/SQLAlchemy
- `database.py` — barrel becomes unnecessary
- `db/__init__.py` — barrel becomes unnecessary
- Old `migrations/*.sql` files
