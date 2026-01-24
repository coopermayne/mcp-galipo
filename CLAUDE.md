# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Galipo is a legal case management system for personal injury law firms. It operates as both:
- An **MCP server** with 41+ tools for Claude AI integration (via FastMCP)
- A **React web dashboard** for managing cases, tasks, deadlines, and contacts

## Commands

### Backend (Python/FastAPI)
```bash
# Development server with hot reload
uvicorn main:app --reload --port 8000

# Production server
python main.py

# Run database migrations
python migrations/run_migration.py

# Run specific migration
python migrations/run_migration.py <migration_file.sql>
```

### Frontend (React/Vite)
```bash
cd frontend
npm run dev          # Dev server at http://localhost:5173
npm run build        # Production build
npm run lint         # ESLint
npm run type-check   # TypeScript type checking
```

### Database
```bash
# Connect to database
psql $DATABASE_URL

# Backup/restore
./scripts/backup.sh
./scripts/restore.sh <backup_file>

# Reset database (development only)
RESET_DB=true python main.py
```

## Architecture

```
main.py                    # FastAPI + MCP server entry point
├── database.py           # Re-exports from db/ (backwards compat)
├── db/                   # Database layer
│   ├── connection.py     # PostgreSQL connection, migrations
│   ├── cases.py          # Case queries
│   ├── persons.py        # Person management
│   ├── tasks.py          # Task operations
│   ├── events.py         # Calendar/deadlines
│   └── ...               # Other domain modules
├── tools/                # MCP tools (AI interface)
│   ├── cases.py          # Case MCP tools
│   ├── tasks.py          # Task MCP tools
│   └── ...               # Other tool modules
├── routes/               # REST API endpoints (web UI interface)
│   ├── cases.py          # Case endpoints
│   ├── tasks.py          # Task endpoints
│   └── ...               # Other route modules
└── frontend/src/
    ├── pages/            # Route pages (Dashboard, Cases, CaseDetail/, etc.)
    ├── components/       # UI components by domain (cases/, tasks/, calendar/)
    ├── api/              # API client functions
    ├── types/            # TypeScript interfaces
    └── context/          # Auth & Theme contexts
```

## Key Patterns

### Backend
- **Modular structure**: Each domain (cases, tasks, events, persons) has separate files in `db/`, `tools/`, and `routes/`
- **Context manager for DB**: Use `with get_cursor() as cur:` for all database operations (auto-commits/rollbacks)
- **Validation functions**: `db/validation.py` has validators like `validate_case_status()`, `validate_date_format()`
- **MCP tools** return dicts/lists that FastMCP serializes; **routes** return FastAPI responses

### Frontend
- **TanStack Query** for server state (mutations invalidate related queries)
- **TanStack Table** for data tables with sorting/filtering
- **@dnd-kit** for drag-and-drop task reordering
- **Tailwind CSS** for styling (utility classes)
- API calls go through `frontend/src/api/` functions

### Database
- **JSONB columns** for flexible data (e.g., `persons.attributes` stores type-specific fields like hourly_rate, bar_number)
- **case_persons** junction table links persons to cases with role (Client, Defendant, Judge, etc.) and side (Plaintiff, Defendant, Neutral)
- **tasks.order_index** for drag-and-drop ordering; `db/tasks.py` has `reorder_task()` logic

## Dockerfile - IMPORTANT

**When adding new Python directories/modules**, you MUST update the `Dockerfile` to include them.

The Dockerfile explicitly lists which directories to copy:
```dockerfile
COPY main.py database.py tools.py routes.py auth.py ./
COPY db/ ./db/
COPY tools/ ./tools/
COPY routes/ ./routes/
COPY services/ ./services/
COPY static/ ./static/
COPY templates/ ./templates/
COPY migrations/ ./migrations/
```

If you create a new top-level Python package (e.g., `utils/`, `lib/`, `workers/`), **add a COPY line** for it or production will fail with `ModuleNotFoundError`.

Also ensure any new package has an `__init__.py` file.

## Local Development

**IMPORTANT:** When working locally, always use `/dev` to start or restart all development servers. This skill:
- Checks PostgreSQL is running
- Starts/restarts the backend (FastAPI on port 8000)
- Starts/restarts the frontend (Vite on port 5173)
- Verifies each service is healthy
- Reports status summary

Use `/dev` liberally:
- At the start of any coding session
- After pulling new changes
- When services seem unresponsive
- After changing environment variables or dependencies

Logs are written to `/tmp/backend.log` and `/tmp/frontend.log` for debugging.

## Pre-Commit Verification

**IMPORTANT:** After any changes that affect the database (schema, migrations, db/*.py functions), run `/verify` before pushing.

The `/verify` skill checks:
- Migration safety (idempotent, preserves data, correct FK order)
- Type consistency across all layers (frontend types ↔ backend ↔ database)
- API contract consistency (routes, MCP tools, frontend API)
- Build verification (TypeScript compiles)
- Export completeness (barrel files updated)

This is critical because the **live production database** receives schema changes automatically when the app restarts after deployment. There is no manual migration step - `migrate_db()` runs on startup.

## Environment Variables

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/galipo
AUTH_USERNAME=admin
AUTH_PASSWORD=your_password
PORT=8000  # optional, defaults to 8000
RESET_DB=true  # development only - drops all tables on startup
```

## Endpoints

- **Frontend**: http://localhost:5173 (Vite dev server)
- **Backend API**: http://localhost:8000/api/v1/*
- **MCP Server**: http://localhost:8000/sse
- **Legacy frontend**: http://localhost:8000/legacy

## Git Practices

**Never push automatically.** The user will handle `git push` themselves. Only commit when asked, and stop there.

## MCP Tools Usage

Project MCP servers are configured in `.mcp.json`:
- **postgres** - Database queries (read-only mode)
- **context7** - Library documentation lookup
- **sequential-thinking** - Structured step-by-step reasoning

**Note:** Only use the `sequential-thinking` MCP when explicitly requested by the user (e.g., "use sequential thinking to work through this"). Do not use it automatically.
