# TODO

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
