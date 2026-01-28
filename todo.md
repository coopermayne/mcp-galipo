# TODO

## Recently Completed

- **In-App AI Chat** - Streaming responses, tool visualization, Cmd+K, markdown, mobile responsive ([plan](docs/CHAT_FEATURE_PLAN.md))
- **Judge/Proceedings Refactor** - Renamed `proceeding_judges` → `judges`, blocked judge role on `case_persons`

---

## Bugs (High Priority)

- [ ] **Case tab state not in URL** - Tab selection (Overview/Tasks/Activity/etc.) should be reflected in URL for bookmarking/sharing (e.g., `/cases/123/tasks`)
- [x] **Chat context not passed** - Chat should know current page context (e.g., which case user is viewing) but this isn't working
- [ ] **Chat tool bloat** - Now sends 49 tools vs 18 before (commit a1e7b67). Fix: curate whitelist in `services/chat/tools.py`
- [ ] **SSE connection drops** - Needs reconnection handling for silent disconnects
- [ ] **Optimistic update staleness** - Can show stale data if server returns different values
- [ ] **Date picker overflow** - Calendar can overflow viewport on small screens
- [ ] **Long case names** - Overflow in sidebar

---

## Ready to Build

### Smart Case Lookup
Flexible AI-powered case finding - handles typos, person names, vague descriptions.

**Plan:** [docs/SMART_CASE_LOOKUP_PLAN.md](docs/SMART_CASE_LOOKUP_PLAN.md)

**Phase 1: Compact Case Index** (Small)
- [ ] Add `get_case_index()` in `db/cases.py` - returns compact case list (~100 tokens/case)
- [ ] Add `get_case_index` MCP tool in `tools/cases.py`
- [ ] Include: id, name, short_name, status, summary, clients, defendants, judge, task count, next event
- [ ] Exclude: full task/event lists, person IDs, notes, activity logs

**Phase 2: Tiered Loading** (Small)
- [ ] Update tool descriptions to guide AI: index for finding, get_case for acting
- [ ] Ensure new tool available in chat

**Phase 3: Person Duplicate Detection** (Medium)
- [ ] Migration: enable `pg_trgm` extension
- [ ] Add trigram indexes on `persons.name` and `persons.organization`
- [ ] Add `search_persons_fuzzy()` in `db/persons.py`
- [ ] Add `search_persons` MCP tool for duplicate checking before creates

### List Component Unification
Ground-up rebuild of all list rendering using flexible compound components. Replaces scattered implementations with a unified system.

**Plan:** [docs/LIST_UNIFICATION_PLAN.md](docs/LIST_UNIFICATION_PLAN.md)

**Phase 1: Build New Components** (Medium)
- [ ] Create `components/common/list/` with `List`, `ListRow`, `ListGroup`, `ListDraggable`
- [ ] Create `caseColors.ts` + `CaseBadge.tsx` (eliminates 5+ duplicate arrays)
- [ ] Create `ListContext` for size variants (`compact`, `standard`)

**Phase 2: Replace Page by Page** (Medium)
- [ ] Cases.tsx → Calendar.tsx → Dashboard.tsx → Tasks.tsx → TasksTab.tsx → OverviewTab.tsx → DocketPanel.tsx

**Phase 3: Delete Old Code** (Small)
- [ ] Delete `ListPanel`, `SortableTaskRow`, `DraggableTaskRow`, `UrgencyGroup`, `CaseGroup`, `DateGroup`, `TodayTaskList`, `DroppableTaskGroup`

---

## Features

### AI Chat Improvements
- [ ] After tool execution, show specific message of what was done
- [ ] Include which fields were filled out
- [ ] Provide clickable link to the created/modified item
- [ ] Example: "Created case 'Smith v. Jones' with status 'Discovery'. [Open case →]"

### Omni Bar / Global Search
- [ ] Shift+Cmd+K shortcut for quick switching between cases, tasks, people
- [ ] Fuzzy search across all entities

### Undo Functionality
- [ ] Cmd+Z support for reversing frontend edits
- [ ] Roll back AI-initiated changes

### Activity Log Enhancements
Goal: Single scrollable view of case history. Encourage documenting during calls without polish.
- [ ] **Note cleanup button** - AI-powered cleanup for typos/grammar
- [ ] **Auto-generated summaries** - Descriptive titles for lengthy entries
- [ ] **Task integration** - Show completed tasks in activity log
- [ ] **Status change tracking** - Display task status transitions
- [ ] **Clarify purpose** - Notes = important case info; Activity log = work history

### Universal Fuzzy Association
Fuzzy matching for all entity associations (extends Smart Case Lookup Phase 3).
- [ ] Backend: `pg_trgm` fuzzy search for jurisdictions
- [ ] MCP/Chat: Auto-suggest existing matches ("Did you mean Richard Clark?")
- [ ] Frontend: Sophisticated autocomplete for judges, experts, attorneys, jurisdictions
- [ ] Frontend: Seamless flow - fuzzy search existing → create new if not found

### Document Processing & Generation
Integration with [docx_template](https://github.com/coopermayne/docx_template) for document generation.
- [ ] **Template generation** - Generate documents from case data using docx_template
- [ ] **Drag-to-fill case info** - Drop a filing PDF to auto-extract case number, judge, magistrate, etc.
- [ ] **PDF document analysis** - Use PyMuPDF/PyMuPDF4LLM for medical records, legal filings
- [ ] **Template library** - Store and manage document templates within the app

### Calendar & Deadlines
- [ ] Date calculator MCP tool for legal deadlines (business days, court rules)
- [ ] Outlook Calendar MCP integration (read-only initially, audit logging)
- [ ] Calendar export (iCal)
- [ ] Recurring deadlines

### Modal Detail Views
- [ ] Person detail modal - click to view/edit all info (contact, attributes, case associations)
- [ ] Proceeding detail modal - view/edit proceeding with judge, dates, notes
- [ ] Extend pattern to other entities as needed (events, tasks?)

### Daily Docket / Task Planner
Global task panel (button like chat button, top-right) for planning your day.
- [ ] **Daily Docket button** - Top-right floating button (like chat) opens task planner panel
- [ ] **Today's tasks list** - Drag tasks here to plan what to work on today, reorderable
- [ ] **Drag target zones** - When dragging a task, show drop zones: "Done", "Today", "Back Burner", "Assign to Paralegal"
- [ ] **Back burner section** - Tasks waiting on something, visible reminder to follow up
- [ ] **Quick status changes** - Dropping on zones updates task status/category/assignee

### Polished Report Exports
Generate professional Word/PDF documents for client communication and internal use.
- [ ] **Case summary report** - Polished case overview with parties, status, key dates, proceedings
- [ ] **Task list export** - Filtered task list as Word/PDF (by case, status, date range)
- [ ] **Case status report** - Multi-case summary for portfolio review
- [ ] **Template system** - Customizable report templates with firm branding
- [ ] **Export formats** - Word (.docx) and PDF support

### Costs Tracker
Track case expenses with smart document processing.
- [ ] **Drag-and-drop bills** - Drop invoice/bill, AI extracts payee, amount, date, description
- [ ] **Payment status** - Track paid/unpaid/partial with payment history and who paid
- [ ] **Cost categories** - Filing fees, expert fees, court reporter, medical records, etc.
- [ ] **Case association** - Link costs to specific cases
- [ ] **Batch import (reach)** - Drag entire costs folder, AI processes all with duplicate detection

### Other
- [ ] Person type filtering in autocomplete search
- [ ] Bulk person assignment
- [ ] Person merge functionality
- [ ] Task templates
- [ ] Task dependencies
- [ ] Time reports by case/date range

---

## Technical Debt

### MCP Tool Consolidation
Goal: Reduce context bloat on every AI interaction.
- [ ] Consolidate into general CRUD tools: `manage_task(action="create|update|delete", ...)`
- [ ] Apply same pattern for cases, persons, events
- [ ] Target: reasonable number of tools (15-20?) vs current 49

### Chat Performance
- [ ] Add logging for AI chat context (full prompts sent to Claude)
- [ ] Analyze logs to identify refactoring opportunities
- [ ] Goal: shorter prompts, faster responses

### Testing
- [ ] Unit tests for tool functions
- [ ] Integration tests for chat endpoint
- [ ] E2E tests for critical flows

### Code Quality
- [ ] Comprehensive error handling on API endpoints
- [ ] Input validation (Pydantic models)
- [ ] Input sanitization for chat messages (length/format)
- [ ] Audit logging for tool executions

---

## Cleanup

- [ ] Remove old `case_numbers` column after verification
- [x] Remove "Court proceedings" label/header (info is self-evident)

---

## Future / Someday

### Person Schema Simplification
Simplify person/case_persons model - role drives UI, type is implicit.

**Design:** See "Future Plans" in [CLAUDE.md](./CLAUDE.md)

Key ideas:
- No explicit `person_type` field - type is implicit from role + attributes
- Role determines form fields ("Expert Witness" → show expert fields)
- Person-level = inherent/stable; Case-level = engagement-specific
- Rates: defaults on person, override per case

### Synonym/Alias Table
If fuzzy matching on organization names proves insufficient:
```sql
CREATE TABLE aliases (
    canonical VARCHAR(255),  -- "Los Angeles Police Department"
    alias VARCHAR(255)       -- "LAPD"
);
```
Decision: Start without. AI usually figures it out. Add if needed.
