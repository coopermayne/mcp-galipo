# TODO

## Quick Add
- [ ]

---

## Features
- [ ] Person type filtering in autocomplete search
- [ ] Bulk person assignment
- [ ] Person merge functionality
- [ ] Task templates
- [ ] Recurring deadlines
- [ ] Task dependencies
- [ ] Calendar export (iCal)
- [ ] Customizable dashboard widgets
- [ ] Time reports by case/date range

## Fixes
- [ ] Date picker calendar can overflow viewport on small screens
- [ ] Long case names overflow in sidebar
- [ ] SSE connection can drop silently; needs reconnection handling

## Bugs
- [ ] Optimistic updates can show stale data if server returns different values

---

## Plans

### In-App Chat
Natural language chat interface in the app that calls Claude API with MCP tool definitions.

**Why**
- Better context awareness (knows which case user is viewing)
- Lower friction than external MCP clients
- Coworkers don't need MCP client setup

**Architecture**
```
Frontend (ChatPanel) → POST /api/v1/chat (streaming) → Claude API → Existing MCP Tool Functions
```

**Implementation**
- [ ] Backend: `/api/v1/chat` endpoint with Claude API integration
- [ ] Backend: Tool wrapper to call existing tool functions directly
- [ ] Backend: Streaming response (SSE)
- [ ] Frontend: ChatButton (floating action button)
- [ ] Frontend: ChatPanel with message history
- [ ] Frontend: Streaming text display
- [ ] Context: Pass current page/case to backend
- [ ] React Query cache invalidation after mutations
- [ ] Tool execution indicators

---

### Case Page Redesign
Tighten layout, structured people sections, smart person picker.

**Goals**
- Reduce whitespace, more scannable
- Permanent sections for each role category
- Autocomplete person picker with create-new option
- Two-column layout (60% people/info, 40% dates/activity)

**Layout**
- Compact header with status, court, case number inline
- Left column: Clients, Defendants, Legal (Opposing/Co-Counsel), Court (Judge/Magistrate), Experts, Other Contacts
- Right column: Key Dates, Upcoming Tasks, Recent Notes panels

**Implementation**
- [ ] Create compact `CaseHeader` component
- [ ] Refactor to 60/40 two-column grid
- [ ] Create `KeyDatesPanel`, `UpcomingTasksPanel`, `RecentNotesPanel`
- [ ] Create `PersonRow` component (compact single-line)
- [ ] Create `PersonSection` component with header, list, add trigger
- [ ] Create `PersonSectionGroup` for grouping related sections
- [ ] Create `PersonPicker` autocomplete component
- [ ] Replace current sections with new PersonSection components
- [ ] Add empty state styling
- [ ] Responsive adjustments (stack on mobile)

---

### Omni Bar (Command Palette)
Global ⌘K shortcut opens a search bar for quick navigation and actions.

**Phase 1: Case Search**
- Quick jump to any case by name or case number
- Fuzzy search with keyboard navigation
- Recent cases shown by default

**Future Phases**
- Task search: find and mark tasks done/active
- Quick note logging
- Person search
- Global actions (create case, add task, etc.)

**Implementation**
- [ ] Backend: `/api/v1/search` endpoint for unified search
- [ ] Frontend: OmniBar component (modal overlay)
- [ ] Frontend: ⌘K keyboard shortcut handler
- [ ] Frontend: Fuzzy search with highlighting
- [ ] Frontend: Keyboard navigation (↑↓ to select, Enter to go)
- [ ] Frontend: Recent cases section
- [ ] Frontend: Result type icons (case, task, person)

---

### Proceedings Table
Separate court proceedings from case "matters" - a single case can have multiple court filings.

**Problem**: Currently `cases.case_numbers` is a JSONB array, but a matter can span multiple courts (state → federal removal → appeal → separate public records case). Judges are linked at case level, not per-proceeding.

**Solution**: New `proceedings` table with case_number, jurisdiction_id, judge_id per proceeding.

**Schema**
```sql
proceedings (id, case_id, case_number, jurisdiction_id, judge_id, sort_order, is_primary, notes)
```

**Implementation**
- [x] Create proceedings table with migration
- [ ] Migrate existing case_numbers data to proceedings
- [x] Add proceedings CRUD API endpoints
- [x] Update get_case_by_id to include proceedings
- [x] Frontend: ProceedingsSection component (replaces CaseNumbersSection)
- [x] Frontend: Move judges from case-level to per-proceeding
- [ ] Remove old case_numbers column after verification

---

## Technical Debt

**Testing & Quality:**
- [ ] Comprehensive error handling on API endpoints
- [ ] Input validation (Pydantic models)
- [ ] Unit tests for tool functions
- [ ] E2E tests for critical flows
- [ ] Database migrations (Alembic)

---

## Completed
- [x] React 19 frontend with TypeScript
- [x] TanStack Query for server state
- [x] Inline editing with auto-save
- [x] Drag-and-drop task reordering
- [x] Unified person management system
- [x] JSONB attributes for flexible person data
- [x] Urgency scale 1-4
- [x] Bearer token auth
- [x] PostgreSQL backend
- [x] 41 MCP tools
- [x] Docker deployment
- [x] Split database.py into db/ modules
- [x] Split tools.py into tools/ modules
- [x] Split routes.py into routes/ modules
- [x] Split CaseDetail.tsx into components/tabs
- [x] Switch to react-datepicker with year/month dropdowns

---

## Ideas
- Document management / file attachments
- Email integration
- Calendar sync (Google, Outlook)
- Multi-user support with permissions
- Client portal
- Conflict checking
- Statute of limitations tracking
- Settlement tracking
- Billing integration
