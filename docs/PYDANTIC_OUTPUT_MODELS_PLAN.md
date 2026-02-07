# Pydantic Output Models Plan

> **Status: COMPLETE** — Migration finished 2026-02-07.
>
> All output models created, `schemas/` package live, 12 of 13 db modules wired up.
> `db/cases.py` intentionally left as-is (generic row converter, not a fixed-shape entity).

## Problem

Pydantic guards the front door (inputs) but the back door (outputs) is 11 different hand-built locks.

**Inputs (clean, centralized):** Routes parse JSON into Pydantic models from `schemas.py`. One place, one pattern, type-checked.

**Outputs (fragmented):** Every `db/` module has its own hand-rolled serializer — different names, different date handling, no shared contract:

```python
# db/tasks.py
def _task_to_dict(task):        # builds dict field-by-field
def _serialize_value(val):      # custom date→string

# db/cases.py
def _sv(val):                   # different date→string helper
def _row_to_dict(row):          # iterates row._mapping

# db/activities.py — the ONE file already doing it right
def _serialize(obj):
    return ActivityOut.model_validate(obj).model_dump(mode="json")
```

~80 `_to_dict` calls across 11 files. Each one is an untyped, undocumented API contract.

```
Current flow:
  Request → Pydantic input → db/ function → ORM object → hand-rolled _to_dict() → raw dict → JSON

Target flow:
  Request → Pydantic input → db/ function → ORM object → Pydantic output model → JSON
```

## Current State

**Migration complete.** Here's what was done:

- **`schemas/` package created** — `common.py`, `inputs.py`, `outputs.py`, `__init__.py` (re-exports everything, so `from schemas import X` still works)
- **~30 output models in `schemas/outputs.py`** — covers all entities: Activity, Role, ExpertiseType, Jurisdiction, Note, Webhook, User, Attorney, Judge, Proceeding, ProceedingJudge, Event, Task, Person, CasePerson, RoleAssignment, CaseList, CaseDetail, CaseSearch, CaseSummary, CaseBrief, plus sub-models (UserBriefOut, CaseStaffUserOut, RoleBriefOut) and variants (*WithCaseOut, *WithRelationsOut, *DetailOut)
- **12 of 13 db modules wired up** — all use `Model.model_validate(obj).model_dump(mode="json")` pattern
- **`db/cases.py` left as-is** — `_sv` and `_row_to_dict` are generic row converters for arbitrary query column sets; cannot be replaced with fixed Pydantic models
- **Dockerfile updated** — `schemas.py` → `COPY schemas/ ./schemas/`
- **E2E tests verified** — 114/121 pass, 5 failures all pre-existing/unrelated

## Final File Structure

```
schemas/
  ├─ __init__.py       re-exports everything (from schemas import X still works)
  ├─ common.py         Literals, constants, ContactInfo
  ├─ inputs.py         All Create/Update input models
  └─ outputs.py        All output models (~450 lines)
```

## Output Model Patterns

**Simple entity** — just the ORM columns:

```python
class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    case_id: int
    description: str
    due_date: Optional[date] = None
    status: TaskStatus
    urgency: Urgency
    sort_order: int
    ...
```

**Entity with joined relations** — extends the base with fields from joined tables:

```python
class TaskWithRelationsOut(TaskOut):
    """What the API actually returns when tasks include case/event/assignee info."""
    case_name: Optional[str] = None
    short_name: Optional[str] = None
    case_color: Optional[str] = None
    event_description: Optional[str] = None
    event_date: Optional[date] = None
    has_events: bool = False
    assignee: Optional[TaskAssigneeOut] = None
```

This is the tricky part — many `db/` functions return different shapes depending on whether they join related tables. Each `_to_dict` needs to be traced to see which fields it returns, and matched to a `*Out` or `*WithRelationsOut` model.

**Key rule:** Output models describe what the API *actually returns today*. Don't reshape responses — just type what's already there. The frontend TypeScript types are the reference for field names/shapes.

## What Was Done

### Step 1: Package scaffold
- Created `schemas/` with `common.py`, `inputs.py`, `outputs.py`, `__init__.py`
- Deleted `schemas.py`
- Updated Dockerfile COPY line
- All existing imports continue to work via re-exports

### Step 2: Output models
- Added ~30 output models to `schemas/outputs.py`
- Key design decisions:
  - `EventOut` has `@field_serializer('time')` for HH:MM format (not Pydantic's default HH:MM:SS)
  - `CaseDetailOut` types nested entities as `list[dict]` (heterogeneous shapes from separate queries)
  - Sub-models (`UserBriefOut`, `RoleBriefOut`, `CaseStaffUserOut`) shared across multiple parent models

### Step 3: Wired up db modules
All 12 applicable modules now use Pydantic serialization:

| Module | Output model(s) | Status |
|--------|----------------|--------|
| `db/types.py` | ExpertiseTypeOut | Done |
| `db/jurisdictions.py` | JurisdictionOut | Done |
| `db/notes.py` | NoteOut, NoteWithCaseOut | Done |
| `db/roles.py` | RoleOut, RoleWithCountOut | Done |
| `db/webhooks.py` | WebhookOut | Done |
| `db/users.py` | UserOut, UserBriefOut, AttorneyOut | Done |
| `db/activities.py` | ActivityOut, ActivityWithCaseOut | Done |
| `db/proceedings.py` | ProceedingOut | Done |
| `db/judges.py` | JudgeOut, JudgeDetailOut, ProceedingJudgeOut | Done |
| `db/events.py` | EventOut, EventWithCaseOut, EventDetailOut | Done |
| `db/tasks.py` | TaskOut, TaskWithRelationsOut, TaskDetailOut | Done |
| `db/persons.py` | PersonOut, CasePersonOut, RoleAssignmentOut, PersonSearchOut | Done |
| `db/cases.py` | — | Skipped (generic row converter) |

### Step 4: Verification
- E2E tests: 114/121 pass (5 pre-existing failures)
- TypeScript compiles cleanly
- All `from schemas import X` imports verified working
