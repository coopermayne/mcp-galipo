# Galipo

The intake system for the firm: new matters come in (Google Sheets form sync, pasted emails/voicemails via AI, or manual entry), get triaged through a status pipeline, commented on, and followed up with tasks.

> **This is the pared-down, intake-only build.** The full case-management app (cases, calendar, contacts, financials, trial calendar, templates, MCP server for Claude) is preserved on the `full-app` branch. Both builds use the same database schema (`models.py` and `alembic/` are unchanged), so switching back is a redeploy of that branch against the same database.

## Features

- **Intakes**: list with pipeline counts, detail page, status transitions, comments, notes, interaction log (calls/emails), unread tracking
- **Google Sheets sync**: new form submissions imported every 5 minutes
- **AI**: create an intake from pasted text, per-intake analysis, interaction summaries, rejection letter draft, AI task creation
- **Tasks**: intake follow-up tasks plus a "Your Tasks" list, with comments and assignees
- **PDF export**: single intake, filtered list, or a batch
- **Users**: admin user management

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React 19 + Vite)               │
│  TypeScript, Tailwind CSS, TanStack Query/Table             │
└────────────────────┬────────────────────────────────────────┘
                     │ /api/v1/*
┌────────────────────▼────────────────────────────────────────┐
│              Backend (Starlette, served by gunicorn)        │
│  Python 3.12, SSE live updates, Bearer auth                 │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                    PostgreSQL                               │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

See [SETUP.md](./docs/SETUP.md) for detailed development setup instructions.

```bash
# Clone and install
git clone <repo-url>
cd mcp-galipo

# Backend
pip install -r requirements.txt

# Frontend
cd frontend && npm install && cd ..

# Set environment variables
export DATABASE_URL="postgresql://user:pass@localhost:5432/galipo"
export AUTH_USERNAME="admin"
export AUTH_PASSWORD="your-password"

# Run development servers
# Terminal 1: Backend
uvicorn main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend && npm run dev
```

## Documentation

- [SETUP.md](./docs/SETUP.md) - Development environment setup
- [TODO.md](./docs/todo.md) - Planned features and known issues
- [docs/](./docs/) - Additional planning documents (most describe the full app on the `full-app` branch)

## Development with Claude Code

The team uses [Claude Code](https://claude.ai/code) for development. Project MCP servers are configured in `.mcp.json` to enhance the development experience.

### Available MCP Servers

| Server | Purpose |
|--------|---------|
| `postgres` | Query the database using natural language (read-only) |
| `context7` | Fetch up-to-date library documentation |
| `sequential-thinking` | Structured reasoning for complex problems (use on request) |
| `puppeteer` | Browser automation for UI testing (development only) |

### Setup

1. **Install dependencies:**
   ```bash
   # Postgres MCP Pro
   pip install postgres-mcp
   ```

2. **Set environment variables:**
   ```bash
   export DATABASE_URL="postgresql://user:pass@localhost:5432/galipo"
   export CONTEXT7_API_KEY="your-context7-api-key"  # Get from https://context7.com
   ```

3. **Restart Claude Code** to pick up the MCP servers from `.mcp.json`

The MCP servers will then be available in your Claude Code sessions for this project.

### Puppeteer MCP (Development Only)

The `puppeteer` MCP server enables Claude Code to perform browser automation for testing:
- Navigate to URLs
- Click buttons and links
- Type into input fields
- Take screenshots
- Wait for elements

This is useful for end-to-end testing of the web UI during development. No additional setup required - it runs via npx.

## Deployment

- **Platform**: Coolify (or any Docker host)
- **Database**: PostgreSQL
- **Port**: 8000

The server runs on port 8000. Your reverse proxy (nginx, Caddy, etc.) should:
- Proxy requests to `localhost:8000`
- Support SSE (Server-Sent Events) - ensure no response buffering
- Handle HTTPS termination

## License

Proprietary - All rights reserved
