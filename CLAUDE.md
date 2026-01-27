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

Logs are written to `/tmp/backend_$BACKEND_PORT.log` and `/tmp/frontend_$VITE_PORT.log` for debugging.

## Multi-Repo Development Setup

For working on multiple branches/features simultaneously, you can run parallel copies of the repo with isolated databases and ports.

### Port Configuration

| Copy | Backend | Frontend | Database |
|------|---------|----------|----------|
| mcp-galipo | 8000 | 5173 | galipo |
| mcp-galipo_2 | 8001 | 5174 | galipo_2 |
| mcp-galipo_3 | 8002 | 5175 | galipo_3 |

### Setup Steps

**1. Create the databases:**

```bash
# Using Postgres.app (creates databases owned by your macOS user)
/Applications/Postgres.app/Contents/Versions/latest/bin/psql postgres -c "CREATE DATABASE galipo_2;"
/Applications/Postgres.app/Contents/Versions/latest/bin/psql postgres -c "CREATE DATABASE galipo_3;"
```

> **Note:** With Postgres.app, databases are owned by your macOS username (e.g., `coopermayne`), so no GRANT commands are needed. If using a different postgres user, grant permissions accordingly.

**2. Copy the repo:**

```bash
cd ~/Code  # or wherever your repos live
cp -r mcp-galipo mcp-galipo_2
cp -r mcp-galipo mcp-galipo_3
```

**3. Update `.env` in each copy:**

Edit the `.env` file in each copy to use unique ports and databases. Only change the values shown below (keep other settings like `AUTH_*` and `ANTHROPIC_API_KEY` the same):

For mcp-galipo_2:
```bash
DATABASE_URL=postgresql://YOUR_USER@localhost:5432/galipo_2
PORT=8001
BACKEND_PORT=8001
VITE_PORT=5174
```

For mcp-galipo_3:
```bash
DATABASE_URL=postgresql://YOUR_USER@localhost:5432/galipo_3
PORT=8002
BACKEND_PORT=8002
VITE_PORT=5175
```

> **Note:** Replace `YOUR_USER` with your postgres username. For Postgres.app, this is typically your macOS username (run `whoami` to check).

**4. Reinstall frontend dependencies** (symlinks break during copy):

```bash
cd mcp-galipo_2/frontend && rm -rf node_modules && npm install
cd mcp-galipo_3/frontend && rm -rf node_modules && npm install
```

**5. Start each environment:**

Run `/dev` in each repo's Claude Code session. The backend will auto-run migrations on first start.

**6. Seed with test data (optional):**

```bash
cd mcp-galipo_2
set -a && source .env && set +a
.venv/bin/python seed_dev_data.py
```

Repeat for mcp-galipo_3.

### Accessing Each Copy

- **mcp-galipo**: http://localhost:5173
- **mcp-galipo_2**: http://localhost:5174
- **mcp-galipo_3**: http://localhost:5175

### How It Works

The `/dev` skill sources the `.env` file and uses the configured ports:
- Backend reads `PORT` for uvicorn
- Frontend reads `VITE_PORT` for the dev server port
- Frontend reads `BACKEND_PORT` to configure the API proxy (so `/api/*` requests go to the right backend)

All three variables should match: if backend runs on 8001, set both `PORT=8001` and `BACKEND_PORT=8001`.

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

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | (none) | PostgreSQL connection string |
| `AUTH_USERNAME` | Yes | (none) | Web dashboard login username |
| `AUTH_PASSWORD` | Yes | (none) | Web dashboard login password |
| `PORT` | No | 8000 | Backend server port (used by uvicorn) |
| `BACKEND_PORT` | No | 8000 | Backend port (used by Vite proxy config) |
| `VITE_PORT` | No | 5173 | Frontend dev server port |
| `ANTHROPIC_API_KEY` | No | (none) | For in-app chat feature |
| `CHAT_MODEL` | No | (none) | Model for in-app chat (e.g., claude-haiku-4-5) |
| `RESET_DB` | No | false | Set to `true` to drop all tables on startup (dev only) |

Example `.env`:
```bash
DATABASE_URL=postgresql://myuser@localhost:5432/galipo
AUTH_USERNAME=admin
AUTH_PASSWORD=yourpassword
PORT=8000
BACKEND_PORT=8000
VITE_PORT=5173
```

## Endpoints

- **Frontend**: http://localhost:5173 (Vite dev server)
- **Backend API**: http://localhost:8000/api/v1/*
- **MCP Server**: http://localhost:8000/sse
- **Legacy frontend**: http://localhost:8000/legacy

## Git Practices

**Never push automatically.** The user will handle `git push` themselves. Only commit when asked, and stop there.

**Development setup**: We use [lazygit](https://github.com/jesseduffield/lazygit) in a separate terminal tab to monitor git activity and handle pushes manually. This works well with Claude Code since you can watch commits come in and review before pushing.

## MCP Tools Usage

Project MCP servers are configured in `.mcp.json`:
- **postgres** - Database queries (read-only mode)
- **context7** - Library documentation lookup
- **sequential-thinking** - Structured step-by-step reasoning

**Note:** Only use the `sequential-thinking` MCP when explicitly requested by the user (e.g., "use sequential thinking to work through this"). Do not use it automatically.

---

## Future Plans

### Person Schema Simplification

> **TODO**: Implement this simplified person/case_persons model

**Overview:** Role drives the UI, not a separate type field. Type is implicit from role + which attributes exist.

**Design Principles:**
1. **No explicit person_type field** — type is implicit from role + attributes
2. **Role determines form fields** — "Expert Witness" → show expert fields
3. **Person-level = inherent/stable** — things that don't change per case
4. **Case-level = engagement-specific** — negotiated terms for THIS case
5. **Rates: defaults + overrides** — standard rates on person, override per case
6. **Custom fields allowed** — at either level

**Person-Level Attributes (`persons.attributes`):**

| Role Context | Attributes |
|--------------|------------|
| Attorneys | `bar_number` |
| Judges | `courtroom`, `department`, `initials` |
| Experts | `specialties[]`, `hourly_rate`, `deposition_rate`, `trial_rate`, `retainer_fee` |
| Mediators | `style`, `half_day_rate`, `full_day_rate` |
| Interpreters | `languages[]`, `hourly_rate` |
| Clients | `date_of_birth`, `preferred_language`, `emergency_contact` |

**Case-Level Attributes (`case_persons.case_attributes`):**

| Context | Attributes |
|---------|------------|
| Rate overrides | Any rate field (wins over person-level) |
| Experts | `specialty` (which one for this case), `testimony_topic` |
| Lien holders | `lien_amount`, `lien_type` |
| Witnesses | `testimony_topic` |
| Any | `notes` (case-specific) |

**Resolution Logic:**
```typescript
const getEffectiveValue = (person, caseAssignment, field) => {
  return caseAssignment.case_attributes?.[field]
    ?? person.attributes?.[field];
};
```

**Migration:**
- Drop person_types table (type is implicit)
- Drop/ignore persons.person_type column
- Keep expertise_types for autocomplete only
- Frontend: role-based form fields, not type-based
