# Galipo TODO

Planned features, improvements, and known issues for the Galipo case management system.

---

## High Priority

### Case Page Redesign
Improve the case detail page layout and person management workflow.

- [ ] Compact header with status, court, and case number inline
- [ ] Two-column layout (60% people/info, 40% dates/activity)
- [ ] Structured person sections (Clients, Defendants, Legal, Court, Experts, Other)
- [ ] Autocomplete person picker with create-new option
- [ ] Reduce whitespace and improve information density
- [ ] Right column: Key Dates, Upcoming Tasks, Recent Notes panels

See [docs/plan-case-page-redesign.md](./docs/plan-case-page-redesign.md) for full details.

### In-App Chat Interface
Add a chat panel for natural language interaction with case data.

- [ ] Backend: `/api/v1/chat` endpoint with Claude API integration
- [ ] Frontend: Floating chat button and slide-out panel
- [ ] Context awareness (current page, selected case)
- [ ] Streaming responses
- [ ] Tool execution indicators
- [ ] React Query cache invalidation after mutations

See [PLAN-in-app-chat.md](./PLAN-in-app-chat.md) for full details.

---

## Features

### Person Management
- [ ] Person type filtering in autocomplete search
- [ ] Bulk person assignment (add multiple people at once)
- [ ] Person merge functionality (combine duplicates)
- [ ] Contact "via" support (contact through another person)
- [ ] Person archive/unarchive with UI

### Tasks & Deadlines
- [ ] Task templates (common task sequences)
- [ ] Recurring deadlines
- [ ] Deadline calculation from trigger dates
- [ ] Task dependencies (blocked by another task)
- [ ] Calendar export (iCal format)

### Dashboard
- [ ] Customizable dashboard widgets
- [ ] Case activity timeline
- [ ] Workload overview (tasks by case)
- [ ] Deadline warnings (approaching/overdue)

### Reporting
- [ ] Time report by case
- [ ] Time report by date range
- [ ] Activity summary export
- [ ] Case status report

### MCP Enhancements
- [ ] Undo support for destructive operations
- [ ] Batch operations for multiple entities
- [ ] Natural language date parsing ("next Tuesday")

---

## UI/UX Improvements

- [ ] Keyboard shortcuts documentation/overlay
- [ ] Mobile responsive improvements
- [ ] Dark mode support
- [ ] Print-friendly case summary view
- [ ] Confirmation dialogs for destructive actions
- [ ] Toast notifications for async operations
- [ ] Loading skeletons for better perceived performance

---

## Technical Debt

### Code Refactoring
Large files that should be split into smaller, focused modules:

**Critical (2000+ lines):**
- [ ] `database.py` (2,363 lines) → Split into `db/cases.py`, `db/persons.py`, `db/tasks.py`, `db/events.py`, `db/activities.py`, `db/notes.py`, `db/types.py`, `db/validation.py`
- [ ] `CaseDetail.tsx` (2,301 lines) → Extract tabs (`OverviewTab.tsx`, `TasksTab.tsx`, `EventsTab.tsx`, `NotesTab.tsx`, `SettingsTab.tsx`) and components (`ContactCard.tsx`, `StarredEvents.tsx`, `CaseNumbersSection.tsx`)
- [ ] `tools.py` (1,450 lines) → Split into `tools/cases.py`, `tools/persons.py`, `tools/tasks.py`, `tools/events.py`, etc.

**High Priority (400-700 lines):**
- [ ] `routes.py` (673 lines) → Split into `routes/cases.py`, `routes/tasks.py`, `routes/persons.py`, `routes/events.py`, etc.
- [ ] `frontend/src/api/client.ts` (403 lines) → Split into domain-specific API modules with barrel export
- [ ] `frontend/src/types/index.ts` (386 lines) → Split into `types/case.ts`, `types/person.ts`, `types/task.ts`, etc.

### Testing & Quality
- [ ] Add comprehensive error handling to all API endpoints
- [ ] Add input validation on backend (Pydantic models)
- [ ] Add API rate limiting
- [ ] Add request logging/audit trail
- [ ] Write unit tests for tool functions
- [ ] Write integration tests for API endpoints
- [ ] Write E2E tests for critical user flows
- [ ] Set up CI/CD pipeline
- [ ] Add database migrations (Alembic)

---

## Known Issues

- [ ] Date picker calendar positioning can overflow viewport on small screens
- [ ] Long case names can overflow in sidebar
- [ ] Optimistic updates can show stale data if server returns different values
- [ ] SSE connection can drop silently; needs reconnection handling

---

## Completed

- [x] React 19 frontend with TypeScript
- [x] TanStack Query for server state management
- [x] Inline editing with auto-save
- [x] Drag-and-drop task reordering
- [x] Task grouping by urgency and by case
- [x] Unified person management system
- [x] Person-to-case assignments with roles
- [x] JSONB attributes for flexible person data
- [x] Case numbers as JSONB array
- [x] Urgency scale standardization (1-4)
- [x] Bearer token authentication
- [x] PostgreSQL database backend
- [x] 41 MCP tools for Claude integration
- [x] Docker deployment support
- [x] Legacy frontend preserved at /legacy

---

## Ideas (Not Yet Planned)

- Document management / file attachments
- Email integration (link emails to cases)
- Calendar sync (Google Calendar, Outlook)
- Multi-user support with permissions
- Client portal for case status
- Conflict checking
- Statute of limitations tracking
- Settlement tracking / offers
- Billing integration
