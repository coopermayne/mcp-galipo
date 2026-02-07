# Pydantic Output Models & Backend Cleanup Plan

## Problem

We migrated to Pydantic (input validation) and SQLAlchemy (query layer) in two separate efforts, but never connected them on the output side. Every `db/` module has hand-rolled `_to_dict()` serializers that are the de facto response schemas — untyped, undocumented, and easy to break.

```
Current flow:
  Request → Route → Pydantic input schema → db/ function → ORM object → hand-rolled _to_dict() → raw dict → JSONResponse

Target flow:
  Request → Route → Pydantic input schema → db/ function → ORM object → Pydantic output schema → JSONResponse
```

## Scope

Three targeted changes. No file moves, no renames, no restructuring.

### 1. Split `schemas.py` → `schemas/` package (with output models)

Current `schemas.py` has input models + a few output models for simpler entities. Split into per-domain files and add output models for all entities.

```
schemas.py (delete after migration)

schemas/
  __init__.py          # Re-exports everything (keeps `from schemas import X` working)
  common.py            # Literal types, constants, ContactInfo, shared base classes
  case.py              # CreateCaseInput, UpdateCaseInput, CaseOut, CaseSummaryOut
  task.py              # CreateTaskInput, UpdateTaskInput, TaskOut, TaskAssigneeOut
  event.py             # CreateEventInput, UpdateEventInput, EventOut
  person.py            # PersonOut, PersonRoleOut, CasePersonOut
  judge.py             # JudgeOut (already exists, move here)
  proceeding.py        # ProceedingOut, ProceedingJudgeOut (already exist, move here)
  activity.py          # CreateActivityInput, UpdateActivityInput, ActivityOut (already exists)
  note.py              # CreateNoteInput, UpdateNoteInput, NoteOut (already exists)
  role.py              # RoleOut, RoleWithCountOut (already exist, move here)
  jurisdiction.py      # JurisdictionOut (already exists, move here)
  user.py              # UserOut, CaseStaffUserOut
  webhook.py           # WebhookOut (if needed)
```

**Output model pattern:**

```python
class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    case_id: int
    description: str
    due_date: Optional[date] = None
    completion_date: Optional[date] = None
    status: TaskStatus
    urgency: Urgency
    sort_order: int
    event_id: Optional[int] = None
    assignee_id: Optional[int] = None
    created_at: Optional[datetime] = None

class TaskWithRelationsOut(TaskOut):
    """Task with joined case/event/assignee info — what the API actually returns."""
    case_name: Optional[str] = None
    short_name: Optional[str] = None
    case_color: Optional[str] = None
    event_description: Optional[str] = None
    event_date: Optional[date] = None
    has_events: bool = False
    assignee: Optional[TaskAssigneeOut] = None
```

**Key rule:** Output models describe what the API *actually returns today*. Don't reshape responses — just type what's already there. The frontend TypeScript types are the reference for what each endpoint returns.

### 2. Add `config.py` (Pydantic BaseSettings)

Replace scattered `os.environ.get()` calls with a single typed settings object.

```python
# config.py
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    database_url: str
    auth_username: str
    auth_password: str
    port: int = 8000
    vite_port: int = 5173
    anthropic_api_key: str = ""
    chat_model: str = ""
    webhook_secret_courtlistener: str = ""
    mcp_auth_password: str = ""
    mcp_base_url: str = ""
    reset_db: bool = False
    dev_skip_auth: bool = False
    vite_dev_skip_auth: bool = False
    dev_auth_user: str = ""

settings = Settings()
```

Then replace `os.environ.get("DATABASE_URL")` → `settings.database_url` everywhere. Catches missing/invalid env vars at startup instead of at runtime.

### 3. Add `tests/` directory

Backend unit/integration tests for the `db/` layer and route handlers.

```
tests/
  __init__.py
  conftest.py          # Test DB, session fixture, test client
  test_cases.py
  test_tasks.py
  test_events.py
  ...
```

This is the biggest gap in the project. E2E tests catch integration issues but are slow. Unit tests for `db/` functions catch regressions fast.

## Migration Order

Do these incrementally, one PR at a time:

### Phase 1: `schemas/` package with output models

1. Create `schemas/` directory with `__init__.py` that re-exports everything
2. Move existing content from `schemas.py` into domain files
3. Verify all existing imports still work (`from schemas import CreateTaskInput`)
4. Delete `schemas.py`
5. Add output models for the simple entities first (roles, jurisdictions, notes — these already have `*Out` classes)
6. Add output models for complex entities (tasks, events, cases, persons) — use frontend TypeScript types as the reference for field names/shapes

**Then, per db/ module:**

7. Replace `_to_dict()` / `_row_to_dict()` with Pydantic `.model_validate()` or `.model_dump()`
8. Remove the hand-rolled serializer functions
9. Run E2E tests to verify responses haven't changed

### Phase 2: `config.py`

1. Add `pydantic-settings` to requirements.txt
2. Create `config.py` with `Settings` class
3. Replace `os.environ` calls one module at a time
4. Update Dockerfile if needed

### Phase 3: `tests/`

1. Create `tests/conftest.py` with test DB setup
2. Add tests for `db/` functions starting with the most complex modules (cases, tasks, events)
3. Add route-level tests using FastAPI test client

## What We're NOT Doing

- **Not moving files into `app/` package** — avoids rewriting every import path
- **Not renaming `db/` → `crud/`** — `db/` is accurate, modules do more than CRUD
- **Not renaming `routes/` → `routers/`** — cosmetic, not worth the churn
- **Not splitting `models.py`** — 15 models in one file is fine at this scale
- **Not adding a repository pattern** — module-level functions work for this project
- **Not reshaping API responses** — output models describe current shapes, frontend stays untouched
