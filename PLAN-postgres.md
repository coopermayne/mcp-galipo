# Legal Case Management MCP Server

## Overview

MCP server for personal injury litigation case management. Designed to work with Claude as a paralegal assistant, handling natural language instructions like:
- "Put X Y Z on the Martinez case"
- "Change plaintiff Martinez's phone to 555-1234"
- "Mark case X as settled and remove all pending tasks"
- "Trial in the City case was rescheduled to 4/11/26"

## Architecture Philosophy

- **Claude is the smart layer** — parses natural language, decides which tools to call, handles ambiguity
- **MCP tools are simple but smart** — handle lookups internally, reduce multi-step operations to single calls
- **Search tools bridge the gap** — let Claude find IDs from partial names before doing CRUD

## Current Schema (11 tables)

```
CASES (central entity, includes case_numbers as JSONB)
├── CLIENTS (plaintiffs, via case_clients junction)
├── DEFENDANTS (via case_defendants junction)
├── CONTACTS (opposing counsel, experts, via case_contacts junction with roles)
├── ACTIVITIES (time tracking)
├── DEADLINES (court-imposed)
│   └── linked to TASKS
├── TASKS (internal to-dos)
└── NOTES
```

## MCP Tools (38 total)

### Case Management (6 tools)
- `list_cases(status_filter)` — list all cases
- `get_case(case_id, case_name)` — full details with all related data
- `create_case(...)` — create with nested clients, defendants, contacts, case_numbers
- `update_case(case_id, ...)` — update including case_numbers array
- `delete_case(case_id)` — cascades all related data
- `search_cases(query, defendant, client, contact, status)` — multi-field search

### Client Management (4 tools)
- `add_client_to_case(case_id, name, ...)` — smart find-or-create, links to case
- `update_client(client_id, name, phone, email, address)` — update client info
- `search_clients(name, phone, email)` — search clients with case associations
- `remove_client_from_case(case_id, client_name)` — remove by name

### Contact Management (3 tools)
- `add_contact_to_case(case_id, name, role, ...)` — smart find-or-create, links with role
- `remove_contact_from_case(case_id, contact_name, role)` — remove by name
- `search_contacts(name, firm, role)` — find contacts across system

### Defendant Management (4 tools)
- `add_defendant(case_id, defendant_name)` — find-or-create, links to case
- `update_defendant(defendant_id, name)` — update defendant name
- `search_defendants(name)` — search/list defendants with case associations
- `remove_defendant_from_case(case_id, defendant_name)` — remove by name

### Task Management (6 tools)
- `add_task(case_id, ...)`
- `get_tasks(case_id, status_filter, urgency_filter, due_within_days)`
- `update_task(task_id, description, status, urgency, due_date)`
- `delete_task(task_id)`
- `search_tasks(query, case_id, status, urgency_min)` — flexible search
- `bulk_update_tasks(task_ids, status)` — batch status updates

### Deadline Management (6 tools)
- `add_deadline(case_id, ...)`
- `get_deadlines(case_id, urgency_filter, status_filter, due_within_days)`
- `update_deadline(deadline_id, ...)`
- `delete_deadline(deadline_id)`
- `search_deadlines(query, case_id, status, urgency_min)` — flexible search
- `bulk_update_deadlines(deadline_ids, status)` — batch status updates

### Bulk Operations (1 tool)
- `bulk_update_case_tasks(case_id, status, current_status)` — update all tasks for a case

### Calendar (1 tool)
- `get_calendar(days, include_tasks, include_deadlines, case_id)` — combined view

### Notes (3 tools)
- `add_note(case_id, content)`
- `update_note(note_id, content)` — update note content
- `delete_note(note_id)`

### Activity (3 tools)
- `log_activity(case_id, ...)` — time tracking
- `update_activity(activity_id, date, description, activity_type, minutes)` — update entry
- `delete_activity(activity_id)` — delete entry

### Contact Updates (1 tool)
- `update_contact(contact_id, ...)` — update shared contact info

## Deployment

- **Platform**: Coolify
- **Database**: PostgreSQL (via `DATABASE_URL` env var)
- **Transport**: SSE on port 8000
- **Live URL**: https://mcp-galipo.coopermayne.com

## Web Dashboard

Current: Vanilla JS SPA at root path (`/`) with:
- Dashboard view (stats)
- Cases view (list/manage)
- Case Detail view
- Tasks view
- Deadlines view

Static files served from `/static/`.

---

## Backend Simplification — COMPLETE

Reduced MCP interface from 41 tools to 31 tools while adding more functionality.
Later re-added 7 CRUD tools for complete coverage (now 38 tools total).

### Key Changes Made

1. **Schema Migration**: Moved `case_numbers` from separate table to JSONB column in `cases`
2. **Smart Entity Tools**: `add_client_to_case` and `add_contact_to_case` with find-or-create logic
3. **Consolidated Case Tools**: `create_case` accepts nested clients, defendants, contacts; `search_cases` has multi-field filtering
4. **Cross-Case Queries**: `get_calendar` combining tasks/deadlines; `due_within_days` parameter on queries
5. **Bulk Operations**: `bulk_update_tasks`, `bulk_update_deadlines`, `bulk_update_case_tasks`
6. **Search Tools**: `search_tasks`, `search_deadlines` for flexible querying

### Tools Removed (10 tools consolidated)
- `add_case_number`, `update_case_number`, `delete_case_number` → use `update_case(case_numbers=[...])`
- `add_client`, `link_existing_client`, `update_client_case_link` → use `add_client_to_case`
- `add_contact`, `link_contact` → use `add_contact_to_case`
- `search_cases_by_defendant` → use `search_cases(defendant="...")`
- `list_contacts`, `list_activities` → use `search_contacts()` or `get_case()`

### Tools Re-added (7 tools for full CRUD coverage)
- `update_client`, `search_clients` — client management
- `update_defendant`, `search_defendants` — defendant management
- `update_note` — note editing
- `update_activity`, `delete_activity` — activity management

### Example: Before vs After

**Before:**
```
User: "Add Maria Martinez as a client to the Jones case"

Claude must:
1. search_clients(name="Maria Martinez")
2. If found: link_existing_client(case_id=5, client_id=12, ...)
3. If not found: add_client(case_id=5, name="Maria Martinez", ...)
```

**After:**
```
User: "Add Maria Martinez as a client to the Jones case"

Claude:
1. add_client_to_case(case_id=5, name="Maria Martinez")
   → Tool internally finds or creates client, links to case
```

---

## Frontend Redesign — COMPLETE

### What Was Built
- React 18 + TypeScript + Vite
- Tailwind CSS for styling
- TanStack Query for server state management
- TanStack Table for sortable/filterable tables
- Inline editing with auto-save and optimistic updates
- Full CRUD for cases, tasks, deadlines, and notes

### Routes
- `/` — Dashboard (stats, recent tasks, deadlines)
- `/cases` — Cases list with inline status editing
- `/cases/:id` — Case detail with tabbed interface (Overview, Tasks, Deadlines, Notes)
- `/tasks` — Cross-case task list grouped by due date
- `/deadlines` — Cross-case deadline list grouped by due date
- `/legacy` — Access to the original vanilla JS frontend

### Design Goals

- **Framework**: React (with Vite for fast dev/build)
- **Interaction**: Inline editing — click any field to edit, auto-saves
- **Visual style**: Dense/productive (Jira-like) — maximize information density
- **Feel**: App-like, not form-like — immediate feedback, no submit buttons

### Core UX Principles

1. **Click to edit** — Any text field becomes editable on click
2. **Auto-save** — Changes save automatically with debounce (300ms)
3. **Optimistic updates** — UI updates immediately, syncs in background
4. **Visual feedback** — Subtle saving/saved indicators, not blocking
5. **Keyboard navigation** — Tab between fields, Enter to confirm, Escape to cancel
6. **Batch operations** — Select multiple items, bulk actions

### Technical Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | React 18 | Industry standard, good ecosystem |
| Build | Vite | Fast dev server, good React support |
| State | TanStack Query | Server state, caching, optimistic updates |
| Styling | Tailwind CSS | Utility-first, fast iteration, dense layouts |
| Tables | TanStack Table | Headless, flexible, sorting/filtering built-in |
| Date picker | react-day-picker | Lightweight, accessible |
| Icons | Lucide React | Clean, consistent icon set |

### Component Architecture

```
frontend/
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   ├── EditableText.tsx      # Click-to-edit text field
│   │   │   ├── EditableSelect.tsx    # Click-to-edit dropdown
│   │   │   ├── EditableDate.tsx      # Click-to-edit date picker
│   │   │   ├── Badge.tsx             # Status/urgency badges
│   │   │   ├── DataTable.tsx         # Sortable, filterable table
│   │   │   └── SaveIndicator.tsx     # Saving/saved/error states
│   │   ├── cases/
│   │   │   ├── CaseList.tsx          # Main case list view
│   │   │   ├── CaseRow.tsx           # Inline-editable case row
│   │   │   ├── CaseDetail.tsx        # Full case view
│   │   │   ├── ClientList.tsx        # Editable client list
│   │   │   ├── ContactList.tsx       # Editable contacts with roles
│   │   │   └── DefendantList.tsx     # Editable defendant chips
│   │   ├── tasks/
│   │   │   ├── TaskList.tsx          # Cross-case task view
│   │   │   ├── TaskRow.tsx           # Inline-editable task
│   │   │   └── TaskQuickAdd.tsx      # Quick add input at top
│   │   ├── deadlines/
│   │   │   ├── DeadlineList.tsx
│   │   │   └── DeadlineRow.tsx
│   │   ├── calendar/
│   │   │   └── CalendarView.tsx      # Combined tasks + deadlines
│   │   └── layout/
│   │       ├── Sidebar.tsx
│   │       ├── Header.tsx
│   │       └── Layout.tsx
│   ├── hooks/
│   │   ├── useAutoSave.ts            # Debounced auto-save logic
│   │   ├── useOptimistic.ts          # Optimistic update pattern
│   │   └── useKeyboard.ts            # Keyboard shortcuts
│   ├── api/
│   │   └── client.ts                 # API client with error handling
│   └── pages/
│       ├── Dashboard.tsx
│       ├── Cases.tsx
│       ├── CaseDetail.tsx
│       ├── Tasks.tsx
│       └── Deadlines.tsx
```

### Implementation Phases

#### Phase 1: Setup & Core Components
1. Set up Vite + React + Tailwind
2. Build `EditableText`, `EditableSelect`, `EditableDate`
3. Build `SaveIndicator`, `Badge`
4. Set up TanStack Query with API client

#### Phase 2: Cases List
1. Build `DataTable` with sorting/filtering
2. Build `CaseRow` with inline editing
3. Build `CaseList` view
4. Add quick-add case functionality

#### Phase 3: Case Detail
1. Build case header with editable fields
2. Build `ClientList`, `ContactList`, `DefendantList`
3. Build tabbed content (Tasks, Deadlines, Notes)
4. Wire up all inline editing

#### Phase 4: Tasks & Deadlines
1. Build cross-case `TaskList` view
2. Build cross-case `DeadlineList` view
3. Add grouping by date (Today, Tomorrow, This Week)
4. Add quick-add functionality

#### Phase 5: Dashboard & Polish
1. Build dashboard with stats cards
2. Add "Due This Week" combined view
3. Add keyboard shortcuts
4. Add bulk actions
5. Polish animations and transitions

### Migration Strategy — COMPLETE

1. ~~Build new React frontend in `/frontend` directory~~ DONE
2. ~~Keep existing vanilla JS frontend working during development~~ DONE (available at `/legacy`)
3. ~~Serve React app from `/app` route initially for testing~~ DONE (served at root `/`)
4. ~~Once stable, replace root route with React app~~ DONE
5. Legacy frontend kept at `/legacy` for backward compatibility
