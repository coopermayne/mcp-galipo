# Plan: Pydantic-Powered MCP Tools (Full Schema Coverage)

## Summary

Replace the current 3-tool MCP interface with 10 well-structured tools covering all database entities. Each domain gets a `manage_X` tool with a Pydantic input model, plus 2 universal tools for search and lookup. The db layer already has all CRUD operations built — we're just wiring up the MCP tool interface with structured schemas.

**Existing tools kept:** `get_current_time`, `list_attorneys`, `import_case` (bulk creation)

## Tool Overview

| # | Tool | Pydantic Model | DB Functions | Purpose |
|---|------|---------------|-------------|---------|
| 1 | `search` | `SearchInput` | `db.search_cases()`, `db.search_persons()`, `db.search_events()`, `db.search_tasks()`, `db.get_case_persons()` | Universal search across all entities |
| 2 | `get_details` | _(plain params)_ | `db.get_case_by_id()`, `db.get_person_by_id()`, `db.get_event_by_id()`, etc. | Get full details for any entity by ID |
| 3 | `manage_case` | `ManageCaseInput` | `db.create_case()`, `db.update_case()`, `db.delete_case()` | Case CRUD (complements `import_case` for updates) |
| 4 | `manage_person` | `ManagePersonInput` | `db.create_person()`, `db.update_person()`, `db.delete_person()` | Person CRUD |
| 5 | `manage_case_role` | `ManageCaseRoleInput` | `db.assign_person_to_case()`, `db.update_case_assignment()`, `db.change_person_role()`, `db.remove_person_from_case()` | Assign/update/change/remove person roles on cases |
| 6 | `manage_event` | `ManageEventInput` | `db.add_event()`, `db.update_event_full()`, `db.delete_event()` | Event CRUD (hearings, deadlines, depositions) |
| 7 | `manage_task` | `ManageTaskInput` | `db.add_task()`, `db.update_task_full()`, `db.delete_task()`, `db.bulk_update_tasks()` | Task CRUD + bulk status updates |
| 8 | `manage_note` | `ManageNoteInput` | `db.add_note()`, `db.update_note()`, `db.delete_note()` | Note CRUD |
| 9 | `manage_proceeding` | `ManageProceedingInput` | `db.add_proceeding()`, `db.update_proceeding()`, `db.delete_proceeding()`, `db.add_judge_to_proceeding()`, `db.remove_judge_from_proceeding()` | Proceeding CRUD + judge assignments |
| 10 | `manage_activity` | `ManageActivityInput` | `db.add_activity()`, `db.update_activity()`, `db.delete_activity()` | Activity/time log CRUD |

**Not included as MCP tools** (managed via web UI only):
- Users (admin operations)
- Lookup tables (expertise_types, person_types, jurisdictions)
- Duplicate detection / merge (complex multi-step workflow better suited to UI)

---

## Pydantic Models

### Shared Sub-Models

```python
class ContactInfo(BaseModel):
    """A phone number or email entry."""
    value: str = Field(..., description="The phone number or email address")
    label: str = Field("", description="Label: 'Mobile', 'Work', 'Home', 'Office', etc.")
    primary: bool = Field(False, description="Whether this is the primary contact method")
```

### 1. SearchInput (universal search)

```python
SearchEntity = Literal["cases", "persons", "events", "tasks"]

class SearchInput(BaseModel):
    entity: SearchEntity = Field(..., description="What to search: cases, persons, events, or tasks")
    query: Optional[str] = Field(None, description="Text search (name, description, case number)")
    case_id: Optional[int] = Field(None, description="Filter to a specific case")
    status: Optional[str] = Field(None, description="Filter by status")
    # Person-specific filters:
    person_type: Optional[str] = Field(None, description="(persons) Filter by type: client, attorney, expert, etc.")
    role: Optional[str] = Field(None, description="(persons) Filter by case role (requires case_id)")
    side: Optional[Literal["plaintiff", "defendant", "neutral"]] = Field(None, description="(persons) Filter by side")
    organization: Optional[str] = Field(None, description="(persons) Filter by org/firm")
    # Task-specific filters:
    urgency: Optional[int] = Field(None, description="(tasks) Filter by urgency 1-4")
    assignee_id: Optional[int] = Field(None, description="(tasks) Filter by assigned user")
    # Event-specific filters:
    user_id: Optional[int] = Field(None, description="(events) Filter by attendee user ID")
    include_past: Optional[bool] = Field(False, description="(events) Include past events")
    # Pagination:
    limit: int = Field(50, description="Max results", ge=1, le=200)
    offset: int = Field(0, description="Pagination offset", ge=0)
```

Routes to the appropriate `db.search_*()` or `db.get_*()` function based on `entity`.

### 2. get_details (no Pydantic needed)

```python
@mcp.tool()
async def get_details(
    context: Context,
    entity: Literal["case", "person", "event", "task", "proceeding"],
    id: int
) -> dict:
```

### 3. ManageCaseInput

```python
CaseAction = Literal["create", "update", "delete"]

class ManageCaseInput(BaseModel):
    action: CaseAction
    case_id: Optional[int] = Field(None, description="Required for update/delete")
    case_name: Optional[str] = Field(None, description="Case name (required for create)")
    short_name: Optional[str] = Field(None, description="Short display name")
    status: Optional[str] = Field(None, description="Case status: Signing Up, Pre-Filing, Discovery, Trial, Closed, etc.")
    print_code: Optional[str] = Field(None, description="Short code for printing/filing")
    case_summary: Optional[str] = Field(None, description="Case summary text")
    result: Optional[str] = Field(None, description="Case result/outcome")
    date_of_injury: Optional[str] = Field(None, description="Date of injury (YYYY-MM-DD)")
```

DB functions: `db.create_case()`, `db.update_case()`, `db.delete_case()`

### 4. ManagePersonInput

```python
PersonAction = Literal["create", "update", "delete"]

class ManagePersonInput(BaseModel):
    action: PersonAction
    person_id: Optional[int] = Field(None, description="Required for update/delete")
    name: Optional[str] = Field(None, description="Full name (required for create)")
    person_type: Optional[str] = Field(None, description="Type (required for create): client, attorney, judge, expert, mediator, defendant, witness, lien_holder, etc.")
    phones: Optional[list[ContactInfo]] = Field(None, description="Phone numbers")
    emails: Optional[list[ContactInfo]] = Field(None, description="Email addresses")
    address: Optional[str] = Field(None, description="Mailing address")
    organization: Optional[str] = Field(None, description="Company, law firm, or organization")
    attributes: Optional[dict] = Field(None, description="Type-specific fields: attorneys {bar_number}, judges {department, courtroom}, experts {specialties, hourly_rate}, clients {date_of_birth}")
    notes: Optional[str] = Field(None, description="Free-text notes")
```

DB functions: `db.create_person()`, `db.update_person()`, `db.delete_person()`

### 5. ManageCaseRoleInput

```python
CaseRoleAction = Literal["assign", "update", "change_role", "remove"]

class ManageCaseRoleInput(BaseModel):
    action: CaseRoleAction
    case_id: int
    person_id: int
    role: str = Field(..., description="Current role (or role to assign). Common: Client, Defendant, Opposing Counsel, Co-Counsel, Plaintiff Expert, Defense Expert, Mediator, Witness, Lien Holder. NOT Judge/Magistrate Judge (use proceedings).")
    # For assign/update:
    side: Optional[Literal["plaintiff", "defendant", "neutral"]] = None
    case_notes: Optional[str] = None
    case_attributes: Optional[dict] = None
    is_primary: Optional[bool] = None
    grouped_under_id: Optional[int] = None
    assigned_date: Optional[str] = Field(None, description="YYYY-MM-DD")
    # For change_role:
    new_role: Optional[str] = Field(None, description="New role (change_role action only)")
```

DB functions: `db.assign_person_to_case()`, `db.update_case_assignment()`, `db.change_person_role()`, `db.remove_person_from_case()`

### 6. ManageEventInput

```python
EventAction = Literal["create", "update", "delete"]

class ManageEventInput(BaseModel):
    action: EventAction
    event_id: Optional[int] = Field(None, description="Required for update/delete")
    case_id: Optional[int] = Field(None, description="Required for create")
    date: Optional[str] = Field(None, description="Event date YYYY-MM-DD (required for create)")
    description: Optional[str] = Field(None, description="Event description (required for create)")
    time: Optional[str] = Field(None, description="Event time HH:MM")
    location: Optional[str] = Field(None, description="Location/courtroom")
    document_link: Optional[str] = Field(None, description="Link to related document")
    calculation_note: Optional[str] = Field(None, description="How the date was calculated (e.g. CCP 2030.260(a), 35 days from service)")
    starred: Optional[bool] = Field(None, description="Star/highlight this event")
```

DB functions: `db.add_event()`, `db.update_event_full()`, `db.delete_event()`

### 7. ManageTaskInput

```python
TaskAction = Literal["create", "update", "delete", "bulk_update"]

class ManageTaskInput(BaseModel):
    action: TaskAction
    task_id: Optional[int] = Field(None, description="Required for update/delete")
    case_id: Optional[int] = Field(None, description="Required for create; for bulk_update, updates all tasks on this case")
    description: Optional[str] = Field(None, description="Task description (required for create)")
    due_date: Optional[str] = Field(None, description="Due date YYYY-MM-DD")
    completion_date: Optional[str] = Field(None, description="Completion date YYYY-MM-DD")
    status: Optional[str] = Field(None, description="Status: Pending, Active, Done, Partially Done, Blocked, Awaiting Atty Review")
    urgency: Optional[int] = Field(None, description="Urgency 1-4 (1=Low, 2=Medium, 3=High, 4=Urgent)")
    event_id: Optional[int] = Field(None, description="Link task to an event")
    assignee_id: Optional[int] = Field(None, description="Assign to a user (staff member ID)")
    # For bulk_update:
    task_ids: Optional[list[int]] = Field(None, description="(bulk_update) List of task IDs to update")
    current_status: Optional[str] = Field(None, description="(bulk_update) Only update tasks with this current status")
```

DB functions: `db.add_task()`, `db.update_task_full()`, `db.delete_task()`, `db.bulk_update_tasks()`, `db.bulk_update_tasks_for_case()`

### 8. ManageNoteInput

```python
NoteAction = Literal["create", "update", "delete"]

class ManageNoteInput(BaseModel):
    action: NoteAction
    note_id: Optional[int] = Field(None, description="Required for update/delete")
    case_id: Optional[int] = Field(None, description="Required for create")
    content: Optional[str] = Field(None, description="Note content (required for create)")
```

DB functions: `db.add_note()`, `db.update_note()`, `db.delete_note()`

### 9. ManageProceedingInput

```python
ProceedingAction = Literal["create", "update", "delete", "add_judge", "remove_judge"]

class ManageProceedingInput(BaseModel):
    action: ProceedingAction
    proceeding_id: Optional[int] = Field(None, description="Required for update/delete/add_judge/remove_judge")
    case_id: Optional[int] = Field(None, description="Required for create")
    case_number: Optional[str] = Field(None, description="Court case number (required for create)")
    jurisdiction_id: Optional[int] = Field(None, description="Jurisdiction ID")
    is_primary: Optional[bool] = Field(None, description="Whether this is the primary proceeding")
    notes: Optional[str] = Field(None, description="Proceeding notes")
    # For add_judge/remove_judge:
    person_id: Optional[int] = Field(None, description="(judge actions) Person ID of the judge")
    judge_role: Optional[str] = Field(None, description="(add_judge) Role: Judge, Magistrate Judge, Presiding, Panel")
```

DB functions: `db.add_proceeding()`, `db.update_proceeding()`, `db.delete_proceeding()`, `db.add_judge_to_proceeding()`, `db.remove_judge_from_proceeding()`

### 10. ManageActivityInput

```python
ActivityAction = Literal["create", "update", "delete"]

class ManageActivityInput(BaseModel):
    action: ActivityAction
    activity_id: Optional[int] = Field(None, description="Required for update/delete")
    case_id: Optional[int] = Field(None, description="Required for create")
    description: Optional[str] = Field(None, description="Activity description (required for create)")
    activity_type: Optional[str] = Field(None, description="Type (required for create): Meeting, Filing, Research, Drafting, Document Review, Phone Call, Email, Court Appearance, Deposition, Other")
    date: Optional[str] = Field(None, description="Activity date YYYY-MM-DD (required for create)")
    minutes: Optional[int] = Field(None, description="Duration in minutes")
```

DB functions: `db.add_activity()`, `db.update_activity()`, `db.delete_activity()`

---

## Files to Modify

1. **`tools.py`** — primary changes:
   - Add `from pydantic import BaseModel, Field, model_validator` to imports
   - Add Pydantic models section (~150 lines) between Reference Data and Error Helpers
   - Add 10 tool functions (~400 lines) inside `register_tools()` after `import_case`
   - Total file grows from ~393 lines to ~940 lines

2. **`main.py`** — minor: update `MCP_INSTRUCTIONS` string to reference new tools

## Files NOT Changed

- All `db/*.py` files — already complete
- `db/validation.py` — validators already exist
- `database.py` — exports already complete
- `Dockerfile` — no new modules
- `requirements.txt` — pydantic is already a transitive dep of fastmcp
- Frontend — no changes needed

## Token Budget Estimate

~10 tools with Pydantic schemas = approximately 4-6K tokens of tool definitions per API call. Well within comfortable range (problems start at 30+ tools / 50K+ tokens).

## Verification

1. Start dev servers with `/dev`
2. Connect to MCP server and verify all 13 tools appear (3 existing + 10 new)
3. Test representative operations:
   - `search(entity="cases", query="Smith")` — find cases
   - `search(entity="persons", case_id=1)` — get case roster
   - `get_details(entity="person", id=1)` — full person details
   - `manage_case(action="update", case_id=1, status="Discovery")` — update case
   - `manage_person(action="create", name="Test", person_type="client")` — create person
   - `manage_case_role(action="assign", case_id=1, person_id=X, role="Witness")` — assign
   - `manage_event(action="create", case_id=1, date="2026-03-01", description="CMC")` — create event
   - `manage_task(action="create", case_id=1, description="File motion")` — create task
   - `manage_note(action="create", case_id=1, content="Test note")` — create note
   - `manage_proceeding(action="add_judge", proceeding_id=1, person_id=X, judge_role="Judge")` — add judge
   - `manage_activity(action="create", case_id=1, description="Client call", activity_type="Phone Call", date="2026-02-05")` — log activity
4. Run `npm run type-check` in frontend (should be unaffected)

---

## In-App Chat Integration

### How It Already Works

The in-app chat (`services/chat/`) already has a sophisticated tool integration pipeline:

```
tools.py (MCP tools registered with @mcp.tool)
    ↓
services/chat/tools.py (extracts tool schemas from MCP registry, cleans them)
    ↓
services/chat/modes.py (filters tools by chat mode)
    ↓
routes/chat.py (sends filtered tools to Claude API via Anthropic SDK)
    ↓
services/chat/executor.py (executes tool calls, returns results)
    ↓
Loop until Claude stops requesting tools
```

The chat does NOT use HTTP/MCP transport. It creates a local `FastMCP` instance (`_mcp = FastMCP("chat-tools-meta")`), calls `register_tools(_mcp)` to get tool metadata, then calls tools directly via the executor. Same tools, no network round-trip.

### Current Mode System (`services/chat/modes.py`)

Modes filter which tools the AI receives per chat session:

| Mode | Purpose | Current Tools |
|------|---------|--------------|
| `tasks` | Add/manage tasks | get_tasks, add_task, update_task, delete_task, bulk_update_tasks, etc. |
| `events` | Add/manage calendar | get_events, add_event, update_event, delete_event, get_calendar |
| `people` | Add/manage persons | manage_person, get_person, assign_person_to_case, etc. |
| `overview` | Read-only summaries | list_cases, get_case_summary, get_tasks, get_events, search |
| `full` | All tools (empty allowlist = everything) | All registered tools |

Each mode also injects a **mode-specific system prompt** that guides the AI's behavior (e.g., "You are in TASKS mode — help the user add and manage tasks").

### What Changes With the New Tools

Once the 10 Pydantic tools replace the old commented-out tools, the mode mappings need updating:

```python
# services/chat/modes.py - UPDATED MAPPINGS
CHAT_MODES = {
    "tasks": {
        "tools": [
            "search",           # search(entity="tasks", ...)
            "get_details",      # get_details(entity="task", id=X)
            "manage_task",      # create/update/delete/bulk_update
        ],
        ...
    },
    "events": {
        "tools": [
            "search",           # search(entity="events", ...)
            "get_details",      # get_details(entity="event", id=X)
            "manage_event",     # create/update/delete
        ],
        ...
    },
    "people": {
        "tools": [
            "search",           # search(entity="persons", ...)
            "get_details",      # get_details(entity="person", id=X)
            "manage_person",    # create/update/delete
            "manage_case_role", # assign/update/change/remove roles
        ],
        ...
    },
    "overview": {
        "tools": [
            "search",           # universal search
            "get_details",      # any entity lookup
        ],
        # Still read-only — no manage_X tools
        ...
    },
    "full": {
        "tools": [],  # Empty = all 10 tools available
        ...
    },
}
```

**Key insight:** Because `search` and `get_details` are universal (entity-based), every mode only needs 2-4 tools total. The AI gets a tiny, focused tool set per mode — fast, cheap, and accurate.

### Beast Mode

"Beast mode" = the existing `full` mode, but surfaced more prominently in the UI.

**How it works today:** The frontend sends `mode: "full"` in the chat request. The backend passes an empty allowlist, so all tools are available. No system prompt restriction is added.

**What to add:**

1. **Frontend:** Add a toggle/button in the chat UI (e.g., a lightning bolt icon) that switches mode to `"full"`
2. **System prompt for beast mode:** Add guidance so the AI knows it has full power:

```python
"full": {
    "tools": [],
    "system_prompt_addition": """You have FULL ACCESS to all tools. You can:
- Search, view, create, update, and delete across all entities
- Manage cases, persons, events, tasks, notes, proceedings, activities
- Assign persons to cases, manage judges on proceedings
- Perform bulk operations

Use the search tool to find entities, get_details for full info,
and manage_X tools for mutations. Always confirm before deleting.""",
},
```

3. **Token cost:** In beast mode, all 10 tools are sent (~4-6K tokens). In focused modes, only 2-4 tools are sent (~1-2K tokens). The mode system provides automatic cost optimization.

### Tool Count Per Mode (After Migration)

| Mode | Tools Sent | Approx Token Cost |
|------|-----------|-------------------|
| Tasks | 3 (search, get_details, manage_task) | ~1.5K |
| Events | 3 (search, get_details, manage_event) | ~1.5K |
| People | 4 (search, get_details, manage_person, manage_case_role) | ~2K |
| Overview | 2 (search, get_details) | ~1K |
| Beast/Full | 10 (all tools) | ~5K |
| Preset queries | 0 (data pre-fetched, no tools) | ~0 |

Compare to the old approach of 30+ individual tools at ~15K+ tokens.

### Files to Update for Chat Integration

1. **`services/chat/modes.py`** — Update tool name lists to match new consolidated tool names
2. **`services/chat/tools.py`** — No changes needed (already dynamically reads from MCP registry)
3. **`services/chat/executor.py`** — No changes needed (already calls tools by name)
4. **Frontend chat components** — Add beast mode toggle button (optional, can be done later)

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                      tools.py                           │
│  Pydantic models + @mcp.tool() registrations            │
│  (10 tools with structured schemas)                     │
└──────────────┬──────────────────────┬───────────────────┘
               │                      │
    ┌──────────▼──────────┐  ┌───────▼────────────────┐
    │   MCP Transport     │  │  In-App Chat            │
    │   (Streamable HTTP) │  │  (Direct Python calls)  │
    │                     │  │                         │
    │   External AI       │  │  services/chat/         │
    │   (Claude Code,     │  │   ├─ tools.py (schema)  │
    │    other clients)   │  │   ├─ modes.py (filter)  │
    │                     │  │   ├─ executor.py (call)  │
    │   Gets ALL tools    │  │   └─ client.py (API)    │
    │   via /mcp endpoint │  │                         │
    └─────────────────────┘  │  Mode → filtered tools  │
                             │  Beast → all tools      │
                             │  Preset → no tools      │
                             └─────────────────────────┘
```

Both paths share the same tool definitions. MCP clients get everything. In-app chat filters by mode for cost/accuracy optimization.
