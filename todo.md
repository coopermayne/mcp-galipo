# TODO

## In Progress

### In-App AI Chat
Natural language chat interface for interacting with case data.
- **Plan**: [docs/CHAT_FEATURE_PLAN.md](docs/CHAT_FEATURE_PLAN.md)
- **Status**: Complete (all 4 phases)

### Smart Case Lookup
Flexible AI-powered case finding - handles typos, person names, vague descriptions ("my LAPD case").
- **Plan**: [docs/SMART_CASE_LOOKUP_PLAN.md](docs/SMART_CASE_LOOKUP_PLAN.md)
- **Status**: Planning complete, ready for development
- **Approach**: Tiered loading (compact index → full details) to balance AI flexibility with token efficiency

---

## Document Processing
- [ ] Use PyMuPDF and PyMuPDF4LLM to work with documents (medical records, legal filings, etc.)

## Integrations
- [x] ~~Integrate PostgreSQL MCP server for natural language database queries~~
  - Installed: [Postgres MCP Pro](https://github.com/crystaldba/postgres-mcp) (`postgres-mcp` package)
  - Configured in `.mcp.json` with restricted (read-only) mode
  - Note: Official `@modelcontextprotocol/server-postgres` is deprecated and has SQL injection vulnerability
- [ ] Integrate Outlook Calendar MCP for deadline management
  - **Important**: Be very careful with permissions - calendar data cannot be put at risk as it is the primary way the office tracks deadlines
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

## Fixes
- [ ] Date picker calendar can overflow viewport on small screens
- [ ] Long case names overflow in sidebar
- [ ] SSE connection can drop silently; needs reconnection handling

## Bugs
- [ ] Optimistic updates can show stale data if server returns different values
- [ ] AI chatbot hangs on simple requests (add task, update items) - need to debug Anthropic API call latency

## Cleanup (Proceedings Migration)
- [ ] Remove old case_numbers column after verification
- [ ] Remove "Court proceedings" label/header (info is self-evident)

## Technical Debt
- [ ] Comprehensive error handling on API endpoints
- [ ] Input validation (Pydantic models)
- [ ] Unit tests for tool functions
- [ ] E2E tests for critical flows
