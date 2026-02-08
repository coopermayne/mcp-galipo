# Pydantic Improvements

Recommendations from a review of our Pydantic patterns against current best practices. Ordered by impact.

## 1. Use proper date/time types on input models

**Problem:** Input models in `schemas/inputs.py` use `str` for date fields (`due_date`, `date`, `date_of_injury`, `time`). This means Pydantic does zero format validation — any string is accepted and the db layer has to handle parsing and error cases.

**Fix:** Change to `datetime.date` / `datetime.time`. Pydantic automatically coerces ISO-8601 strings (`"2024-01-15"`) into proper types and rejects garbage like `"next tuesday"` with a clear validation error.

```python
# Before
class CreateEventInput(BaseModel):
    date: str
    time: Optional[str] = None

# After
class CreateEventInput(BaseModel):
    date: datetime.date
    time: Optional[datetime.time] = None
```

**Why it matters:** Free validation at the API boundary. No more manual parsing or silent bad-data bugs downstream.

## 2. Add `extra='forbid'` to input models

**Problem:** Input models silently ignore unknown fields. A typo like `{"descrption": "..."}` is quietly dropped — the field is missing but no error is raised (it defaults to `None`).

**Fix:** Add `model_config = ConfigDict(extra='forbid')` to all Create/Update input models.

```python
class CreateCaseInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    # ... fields
```

**Why it matters:** Catches typos and stale client code sending removed fields. Especially useful since MCP tool callers (LLMs) can easily misspell field names.

## 3. Validate person routes through Pydantic

**Problem:** `routes/persons.py` is the only route file that skips Pydantic input validation entirely. It does raw `data = await request.json()` and accesses fields with `data["name"]`, `data.get("phones")`, etc. Every other route (events, tasks, cases, activities, notes) validates through input models first.

**Fix:** Create `CreatePersonInput` and `UpdatePersonInput` in `schemas/inputs.py` and use them in the person routes, matching the pattern in `routes/events.py`.

**Why it matters:** Consistency across routes. Person creation currently has no type checking, no field name validation, and no structured error responses for bad input.

## 4. Type nested relations in `CaseDetailOut`

**Problem:** `CaseDetailOut` uses `list[dict]` for nested data like `attorneys`, `events`, `tasks`, `persons`, `notes`, `proceedings`. This loses all type safety — anything could be in those dicts.

**Fix:** Use the actual output models:

```python
class CaseDetailOut(BaseModel):
    # ...
    attorneys: list[AttorneyOut] = []
    events: list[EventOut] = []
    tasks: list[TaskOut] = []
    notes: list[NoteOut] = []
    proceedings: list[ProceedingOut] = []
    persons: list[CasePersonOut] = []
```

**Why it matters:** Validates the shape of nested data at serialization time. Catches bugs where the db layer returns unexpected structures. Also improves IDE autocompletion for anyone working with these models.

## 5. Standardize `Optional` syntax

**Problem:** Mixed styles — `config.py` uses `str | None` (Python 3.10+), `schemas/inputs.py` uses `Optional[str]` (older typing style). Both work but the inconsistency looks unintentional.

**Fix:** Pick one and use it everywhere. `str | None` is the modern standard for Python 3.10+ projects.

**Why it matters:** Low priority, purely cosmetic. Worth doing during any larger refactor of these files.
