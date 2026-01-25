# TODO

## Recently Completed

### In-App AI Chat ✅
Natural language chat interface for interacting with case data.
- **Plan**: [docs/CHAT_FEATURE_PLAN.md](docs/CHAT_FEATURE_PLAN.md)
- **Status**: Complete (all 4 phases)
- Streaming responses, tool visualization, keyboard shortcuts (Cmd+K), markdown rendering, mobile responsive

### Judge/Proceedings Refactor ✅
- Renamed `proceeding_judges` → `judges` table
- Blocked judge role assignments on `case_persons` (judges only via proceedings)
- Complete seed data for all schema tables

---

## In Progress

### Smart Case Lookup
Flexible AI-powered case finding - handles typos, person names, vague descriptions ("my LAPD case").
- **Plan**: [docs/SMART_CASE_LOOKUP_PLAN.md](docs/SMART_CASE_LOOKUP_PLAN.md)
- **Status**: Planning complete, ready for development
- **Approach**: Tiered loading (compact index → full details) to balance AI flexibility with token efficiency

### Person Schema Simplification (Future)
Simplify person/case_persons model - role drives UI, type is implicit.
- **Plan**: See "Future Plans" section in [CLAUDE.md](./CLAUDE.md)
- **Status**: Planned, not started

### Universal Fuzzy Association
Fuzzy matching for all entity associations - persons, jurisdictions, etc.
- **Status**: Planning needed
- **Scope**:
  - [ ] Backend: `pg_trgm` fuzzy search for persons (extends Smart Case Lookup Phase 3)
  - [ ] Backend: Fuzzy search for jurisdictions
  - [ ] MCP/Chat: Auto-suggest existing matches when adding associations ("Did you mean Richard Clark?")
  - [ ] Frontend: Sophisticated autocomplete for judges, experts, attorneys, jurisdictions
  - [ ] Frontend: Seamless flow - fuzzy search existing → create new if not found
- **Example**: User types "Mr. Clark expert" → system suggests "Richard Clark" from existing persons

---

## Document Processing
- [ ] Use PyMuPDF and PyMuPDF4LLM to work with documents (medical records, legal filings, etc.)

## Integrations
- [x] ~~Integrate PostgreSQL MCP server for natural language database queries~~
  - Installed: [Postgres MCP Pro](https://github.com/crystaldba/postgres-mcp) (`postgres-mcp` package)
  - Configured in `.mcp.json` with restricted (read-only) mode
  - Note: Official `@modelcontextprotocol/server-postgres` is deprecated and has SQL injection vulnerability
- [ ] Integrate Outlook Calendar MCP for deadline management
  - **Important**: Be very careful with permissions - calendar data cannot be put at risk
  - Consider read-only access initially
  - Audit logging for any calendar operations

## Features
- [ ] Person type filtering in autocomplete search
- [ ] Bulk person assignment
- [ ] Person merge functionality
- [ ] Task templates
- [ ] Recurring deadlines
- [ ] Task dependencies
- [ ] Calendar export (iCal)
- [ ] Time reports by case/date range
- [ ] Date calculator MCP tool for legal deadlines (business days, court rules)

## Bugs / Fixes
- [ ] **Chat slowness** - now sends 49 tools vs 18 before (commit a1e7b67); fix by curating whitelist in `services/chat/tools.py`
- [ ] Optimistic updates can show stale data if server returns different values
- [ ] Date picker calendar can overflow viewport on small screens
- [ ] Long case names overflow in sidebar
- [ ] SSE connection can drop silently; needs reconnection handling

## Cleanup
- [ ] Remove old `case_numbers` column after verification
- [ ] Remove "Court proceedings" label/header (info is self-evident)

## Technical Debt
- [ ] Comprehensive error handling on API endpoints
- [ ] Input validation (Pydantic models)
- [ ] Unit tests for tool functions
- [ ] E2E tests for critical flows
- [ ] Input sanitization for chat messages (length/format validation)
- [ ] Audit logging for tool executions
