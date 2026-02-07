# Pydantic Output Models Plan

## Problem

Pydantic guards the front door (inputs) but the back door (outputs) is 12 different hand-built locks.

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
# ...but even this file falls back to hand-rolled dicts for joined queries
```

84 `_to_dict` calls across 12 files. Each one is an untyped, undocumented API contract.

```
Current flow:
  Request → Pydantic input → db/ function → ORM object → hand-rolled _to_dict() → raw dict → JSON

Target flow:
  Request → Pydantic input → db/ function → ORM object → Pydantic output model → JSON
```

## Scope

Split `schemas.py` into a `schemas/` package and add Pydantic output models for all entities. Then replace the 84 hand-rolled serializers with `model_validate()`. No file moves, no renames, no restructuring beyond this.

## File Structure

```
BEFORE                                 AFTER

schemas.py  (one flat file)            schemas/
  ├─ Literal types                       ├─ __init__.py       re-exports everything
  ├─ List constants                      │                    (from schemas import X still works)
  ├─ ContactInfo                         ├─ common.py         Literals, constants, ContactInfo
  ├─ CreateCaseInput                     ├─ case.py           Create/UpdateCaseInput + CaseOut
  ├─ UpdateCaseInput                     ├─ task.py           Create/UpdateTaskInput + TaskOut
  ├─ CreateTaskInput                     ├─ event.py          Create/UpdateEventInput + EventOut
  ├─ UpdateTaskInput                     ├─ person.py         PersonOut, PersonRoleOut
  ├─ CreateEventInput                    ├─ judge.py          JudgeOut
  ├─ UpdateEventInput                    ├─ proceeding.py     ProceedingOut, ProceedingJudgeOut
  ├─ Create/UpdateActivityInput          ├─ activity.py       Create/UpdateActivityInput, ActivityOut
  ├─ ActivityOut                         ├─ note.py           Create/UpdateNoteInput, NoteOut
  ├─ Create/UpdateNoteInput              ├─ role.py           RoleOut, RoleWithCountOut, ExpertiseTypeOut
  ├─ RoleOut, RoleWithCountOut           ├─ jurisdiction.py   JurisdictionOut
  ├─ ExpertiseTypeOut                    ├─ user.py           UserOut, CaseStaffUserOut          ← NEW
  ├─ JurisdictionOut                     └─ webhook.py        WebhookOut                         ← NEW
  ├─ NoteOut
  ├─ JudgeOut                          schemas.py → deleted
  ├─ ProceedingOut
  ├─ ProceedingJudgeOut
  ├─ PersonOut
  └─ PersonRoleOut
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

## Migration Steps

### Step 1: Create the `schemas/` package scaffold

1. Create `schemas/` directory with `__init__.py` that re-exports everything
2. Move existing content from `schemas.py` into domain files
3. Verify all existing imports still work (`from schemas import CreateTaskInput`)
4. Delete `schemas.py`

Zero behavior change — just reorganization.

### Step 2: Add output models for entities that don't have them yet

5. Simple entities first (already have `*Out` classes, just need to move them): roles, jurisdictions, notes, judges, proceedings, persons
6. New output models for: cases, tasks, events, users, webhooks
7. For each, trace the existing `_to_dict` to see exactly what fields it returns. Use frontend TypeScript types as cross-reference

### Step 3: Wire up output models in `db/` modules

Do one module at a time, starting with the simplest:

8. Replace `_to_dict()` / `_row_to_dict()` / `_sv()` / `_serialize_value()` with `SomeOut.model_validate(obj).model_dump(mode="json")`
9. Delete the hand-rolled serializer functions
10. Run E2E tests after each module to verify responses haven't changed

**Module order** (simplest → most complex):
| Module | `_to_dict` calls | Notes |
|--------|------------------|-------|
| `db/activities.py` | already done | Just fix the joined-query fallback |
| `db/proceedings.py` | 4 | Simple |
| `db/types.py` | 5 | Simple |
| `db/events.py` | 5 | Has joined case info |
| `db/notes.py` | 6 | Simple |
| `db/jurisdictions.py` | 6 | Simple |
| `db/webhooks.py` | 6 | Simple |
| `db/users.py` | 6 | Simple |
| `db/tasks.py` | 6 | Has joined case/event/assignee — needs `TaskWithRelationsOut` |
| `db/roles.py` | 7 | Has count variant |
| `db/judges.py` | 9 | Has joined jurisdiction |
| `db/persons.py` | 10 | Has joined roles/cases — most complex |
| `db/cases.py` | 14 | Has joined staff/events/tasks — most complex |

## What We're NOT Doing

- **Not reshaping API responses** — output models describe current shapes, frontend stays untouched
- **Not moving files** into `app/` package, not renaming `db/` or `routes/`
- **Not splitting `models.py`** — 15 models in one file is fine at this scale
- **Not adding `config.py` or `tests/`** — separate efforts, separate plans
