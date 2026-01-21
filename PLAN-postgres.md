# Legal Case Management MCP Server

## Overview

MCP server for personal injury litigation case management. Designed to work with Claude as a paralegal assistant, handling natural language instructions like:
- "Put X Y Z on the Martinez case"
- "Change plaintiff Martinez's phone to 555-1234"
- "Mark case X as settled and remove all pending tasks"
- "Trial in the City case was rescheduled to 4/11/26"

## Architecture Philosophy

- **Claude is the smart layer** — parses natural language, decides which tools to call, handles ambiguity
- **MCP tools are simple CRUD** — dumb, precise, ID-based operations
- **Search tools bridge the gap** — let Claude find IDs from partial names before doing CRUD

## Current Schema (12 tables)

```
CASES (central entity)
├── CLIENTS (plaintiffs, via case_clients junction)
├── DEFENDANTS (via case_defendants junction)
├── CONTACTS (opposing counsel, experts, via case_contacts junction with roles)
├── CASE_NUMBERS (multiple per case, e.g., state, federal, appeal)
├── ACTIVITIES (time tracking)
├── DEADLINES (court-imposed)
│   └── linked to TASKS
├── TASKS (internal to-dos)
└── NOTES
```

## MCP Tools (40 total)

### Search Tools (for finding IDs)
- [x] `search_clients(name, phone, email)` — returns clients with case associations
- [x] `search_cases(name, case_number)` — returns cases with clients/defendants
- [x] `search_contacts(name, firm)` — returns contacts with case/role associations
- [x] `search_cases_by_defendant(defendant_name)` — find cases by defendant

### Case CRUD
- [x] `list_cases(status_filter)`
- [x] `get_case(case_id, case_name)` — full details with all related data
- [x] `create_case(...)`
- [x] `update_case(case_id, ...)`
- [x] `delete_case(case_id)` — cascades

### Client CRUD
- [x] `add_client(case_id, ...)` — creates and links to case
- [x] `update_client(client_id, ...)`
- [x] `remove_client_from_case(case_id, client_id)`
- [x] `list_clients()`

### Contact CRUD
- [x] `add_contact(...)` — creates contact
- [x] `link_contact(case_id, contact_id, role)` — links to case with role
- [x] `update_contact(contact_id, ...)`
- [x] `remove_contact_from_case(case_id, contact_id, role)`
- [x] `list_contacts()`

### Defendant CRUD
- [x] `add_defendant(case_id, defendant_name)`
- [x] `remove_defendant_from_case(case_id, defendant_id)`

### Task CRUD
- [x] `add_task(case_id, ...)`
- [x] `get_tasks(case_id, status_filter, urgency_filter)`
- [x] `update_task(task_id, status, urgency, due_date)` — NOTE: missing description
- [x] `delete_task(task_id)`

### Deadline CRUD
- [x] `add_deadline(case_id, ...)`
- [x] `get_deadlines(urgency_filter, status_filter)`
- [x] `update_deadline(deadline_id, ...)`
- [x] `delete_deadline(deadline_id)`

### Note CRUD
- [x] `add_note(case_id, content)`
- [x] `update_note(note_id, content)`
- [x] `delete_note(note_id)`

### Activity CRUD
- [x] `log_activity(case_id, ...)`
- [x] `list_activities(case_id)`
- [x] `update_activity(activity_id, ...)`
- [x] `delete_activity(activity_id)`

### Case Number CRUD
- [x] `add_case_number(case_id, case_number, label, is_primary)`
- [x] `delete_case_number(case_number_id)`

## Known Gaps / Future Work

### Should Fix
- [ ] `update_task` — add `description` parameter (database supports it, MCP tool doesn't expose it)
- [ ] Add `link_existing_client_to_case()` — currently `add_client` always creates new; can't link same client to multiple cases
- [ ] Add `update_client_case_link()` — for changing contact preferences (direct vs via guardian)

### Nice to Have
- [ ] `update_defendant` — rename a defendant
- [ ] `update_case_number` — currently must delete and re-add

## Deployment

- **Platform**: Coolify
- **Database**: PostgreSQL (via `DATABASE_URL` env var)
- **Transport**: SSE on port 8000
- **Live URL**: https://mcp-galipo.coopermayne.com

## Web Dashboard

SPA frontend at root path (`/`) with:
- Dashboard view (stats)
- Cases view (list/manage)
- Tasks view
- Deadlines view

Static files served from `/static/`.

---

## Implementation Plan: Interface Simplification

### Problem Statement

The current implementation has 40 MCP tools that expose the relational database structure directly to Claude. This creates unnecessary complexity:

- Claude must understand junction tables, IDs, and linking operations
- Operations like "add Maria Martinez to the Jones case" require multiple tool calls
- The abstraction level is wrong — Claude sees database operations, not case management operations

### Design Principles

1. **Keep relational database** — Cross-case queries (tasks due this week, all cases with Judge X) require relational structure
2. **Simplify MCP interface** — Reduce from ~40 tools to ~15 tools
3. **Hide relational complexity** — Claude shouldn't know about junction tables
4. **Smart tools** — Tools should handle lookups and linking internally

### Schema Changes

#### 1. Merge `case_numbers` into `cases` table

**Current:**
```sql
CREATE TABLE case_numbers (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id),
    case_number VARCHAR(100),
    label VARCHAR(50),
    is_primary BOOLEAN
);
```

**New:**
```sql
-- Add to cases table:
case_numbers JSONB DEFAULT '[]'
-- Format: [{"number": "24STCV12345", "label": "State", "primary": true}, ...]
```

**Migration:**
1. Add `case_numbers` JSONB column to `cases`
2. Migrate existing data from `case_numbers` table
3. Drop `case_numbers` table
4. Remove `add_case_number`, `update_case_number`, `delete_case_number` tools

#### 2. Keep all other tables

These tables serve real relational purposes:

| Table | Why Keep It |
|-------|-------------|
| `clients` | Shared across cases (same client, multiple cases) |
| `contacts` | Shared across cases (same judge/counsel in many cases) |
| `defendants` | Shared across cases (same defendant sued multiple times) |
| `tasks` | Cross-case queries: "tasks due this week" |
| `deadlines` | Cross-case queries: "deadlines next 30 days" |
| `activities` | Cross-case queries: time reporting |
| `notes` | Case-specific, but simple |
| `case_clients` | Junction table (hidden from Claude) |
| `case_contacts` | Junction table (hidden from Claude) |
| `case_defendants` | Junction table (hidden from Claude) |

### New MCP Tool Design (~15 tools)

#### Case Management (6 tools)

```python
# Get case with ALL related data (clients, contacts, tasks, etc.)
get_case(case_id: int = None, case_name: str = None) -> dict

# Create case with optional nested data
create_case(
    case_name: str,
    status: str = "Signing Up",
    # ... basic fields ...
    clients: List[dict] = None,      # [{"name": "...", "phone": "..."}]
    defendants: List[str] = None,    # ["City of LA", "LAPD"]
    case_numbers: List[dict] = None  # [{"number": "...", "label": "..."}]
) -> dict

# Smart update - handles nested data
update_case(
    case_id: int,
    # Basic fields (optional)
    case_name: str = None,
    status: str = None,
    # ... other basic fields ...
    # Nested updates (optional)
    case_numbers: List[dict] = None  # Replaces entire list
) -> dict

delete_case(case_id: int) -> dict

list_cases(status_filter: str = None, limit: int = 50, offset: int = 0) -> dict

search_cases(
    query: str = None,           # Free text search
    defendant: str = None,       # Filter by defendant name
    client: str = None,          # Filter by client name
    contact: str = None,         # Filter by contact name
    status: str = None
) -> dict
```

#### Case Entity Management (5 tools)

These handle adding/removing entities to/from cases. They're smart about finding or creating entities.

```python
# Smart client add - finds existing client by name/phone/email or creates new
add_client_to_case(
    case_id: int,
    name: str,
    phone: str = None,
    email: str = None,
    address: str = None,
    # Contact preferences
    contact_directly: bool = True,
    contact_via: str = None,           # Name of guardian/contact
    contact_via_relationship: str = None,  # "Mother", "Guardian", etc.
    is_primary: bool = False,
    notes: str = None
) -> dict
# Internally: searches for existing client, creates if not found, links to case

remove_client_from_case(case_id: int, client_name: str) -> dict
# Internally: finds client by name, removes link

# Smart contact add - finds existing or creates, links with role
add_contact_to_case(
    case_id: int,
    name: str,
    role: str,                    # "Opposing Counsel", "Judge", etc.
    firm: str = None,
    phone: str = None,
    email: str = None,
    notes: str = None
) -> dict

remove_contact_from_case(case_id: int, contact_name: str, role: str = None) -> dict

# Smart defendant add - finds existing or creates, links
add_defendant_to_case(case_id: int, defendant_name: str) -> dict

remove_defendant_from_case(case_id: int, defendant_name: str) -> dict
```

#### Cross-Case Queries (3 tools)

```python
# Tasks across all cases
get_tasks(
    case_id: int = None,         # Filter to specific case
    status: str = None,          # "Pending", "Active", etc.
    due_within_days: int = None, # Tasks due within N days
    urgency_min: int = None      # Minimum urgency (1-5)
) -> dict

# Deadlines across all cases
get_deadlines(
    case_id: int = None,
    status: str = None,
    due_within_days: int = None,
    urgency_min: int = None
) -> dict

# Combined calendar view
get_calendar(
    days: int = 30,              # Look ahead N days
    include_tasks: bool = True,
    include_deadlines: bool = True
) -> dict
```

#### Task & Deadline Management (4 tools)

```python
add_task(
    case_id: int,
    description: str,
    due_date: str = None,
    urgency: int = 3,
    status: str = "Pending"
) -> dict

update_task(
    task_id: int,
    description: str = None,
    due_date: str = None,
    urgency: int = None,
    status: str = None
) -> dict

add_deadline(
    case_id: int,
    date: str,
    description: str,
    urgency: int = 3,
    status: str = "Pending",
    calculation_note: str = None
) -> dict

update_deadline(
    deadline_id: int,
    date: str = None,
    description: str = None,
    urgency: int = None,
    status: str = None
) -> dict
```

#### Shared Entity Management (2 tools)

For updating contact info that spans multiple cases:

```python
# Update a contact's info (reflects in all cases)
update_contact(
    contact_id: int = None,
    contact_name: str = None,    # Can find by name instead of ID
    name: str = None,
    firm: str = None,
    phone: str = None,
    email: str = None
) -> dict

# Search contacts across system
search_contacts(
    name: str = None,
    firm: str = None,
    role: str = None             # Filter by role type
) -> dict
```

#### Simple Operations (3 tools)

```python
add_note(case_id: int, content: str) -> dict
delete_note(note_id: int) -> dict

log_activity(
    case_id: int,
    description: str,
    activity_type: str,
    minutes: int = None,
    date: str = None
) -> dict
```

### Tools Removed (25 tools → consolidated)

| Removed Tool | Replaced By |
|--------------|-------------|
| `link_existing_client` | `add_client_to_case` (auto-detects existing) |
| `update_client_case_link` | `add_client_to_case` (upserts) |
| `update_client` | Rarely needed; use `update_contact` for shared contacts |
| `list_clients` | `search_cases` with client filter |
| `search_clients` | `add_client_to_case` handles lookup internally |
| `add_contact` | `add_contact_to_case` (creates if needed) |
| `link_contact` | `add_contact_to_case` |
| `list_contacts` | `search_contacts` |
| `update_defendant` | Rarely needed; just remove and re-add |
| `search_cases_by_defendant` | `search_cases(defendant="...")` |
| `add_case_number` | `update_case(case_numbers=[...])` |
| `update_case_number` | `update_case(case_numbers=[...])` |
| `delete_case_number` | `update_case(case_numbers=[...])` |
| `delete_task` | Keep but lower priority |
| `delete_deadline` | Keep but lower priority |
| `update_note` | Rarely needed |
| `list_activities` | Part of `get_case` response |
| `update_activity` | Rarely needed |
| `delete_activity` | Rarely needed |

### Implementation Phases

#### Phase 1: Schema Migration
1. Add `case_numbers` JSONB column to `cases` table
2. Migrate existing case_numbers data
3. Drop `case_numbers` table
4. Update `get_case` to include case_numbers from JSONB

#### Phase 2: Smart Entity Tools
1. Implement `add_client_to_case` with find-or-create logic
2. Implement `add_contact_to_case` with find-or-create logic
3. Implement `remove_*_from_case` tools that accept names (not just IDs)
4. Update `add_defendant_to_case` to accept name-based removal

#### Phase 3: Consolidate Case Tools
1. Update `create_case` to accept nested clients/defendants/contacts
2. Update `update_case` to handle case_numbers array
3. Enhance `search_cases` with multi-field filtering

#### Phase 4: Cross-Case Query Tools
1. Implement `get_calendar` combining tasks and deadlines
2. Add `due_within_days` parameter to `get_tasks` and `get_deadlines`

#### Phase 5: Cleanup
1. Remove deprecated tools
2. Update frontend to use new API structure
3. Update documentation

### Example: Before vs After

**Before (current):**
```
User: "Add Maria Martinez as a client to the Jones case"

Claude must:
1. search_clients(name="Maria Martinez")
2. If found: link_existing_client(case_id=5, client_id=12, ...)
3. If not found: add_client(case_id=5, name="Maria Martinez", ...)
```

**After (new):**
```
User: "Add Maria Martinez as a client to the Jones case"

Claude:
1. add_client_to_case(case_id=5, name="Maria Martinez")
   → Tool internally finds or creates client, links to case
```

**Before:**
```
User: "What's on my calendar this week?"

Claude must:
1. get_tasks(status_filter="Pending")
2. get_deadlines(status_filter="Pending")
3. Manually filter and combine by date
```

**After:**
```
User: "What's on my calendar this week?"

Claude:
1. get_calendar(days=7)
   → Returns combined, sorted list of tasks and deadlines
```

### Success Metrics

- Reduce from ~40 tools to ~15 tools
- Average tool calls per user request: reduce from 2-3 to 1-2
- Claude success rate on common operations: improve
- Code complexity: reduce (fewer tools to maintain)
