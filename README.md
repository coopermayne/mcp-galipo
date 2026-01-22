# Galipo

A legal case management system for personal injury law firms, designed for solo practitioners and small litigation teams.

Galipo operates as both:
- An **MCP (Model Context Protocol) server** with 41+ tools for Claude AI integration
- A **web-based dashboard** built with React for managing cases, tasks, deadlines, and legal team collaboration

**Live URL:** https://mcp-galipo.coopermayne.com

## Features

### Case Management
- Track cases from intake through resolution
- Manage case numbers, court assignments, and case status
- Store case summaries, dates of injury, and outcomes
- Search cases by name, number, person, or status

### Person Management
- Unified person system supporting clients, defendants, attorneys, judges, experts, witnesses, and more
- Flexible attributes for person-type-specific data (e.g., hourly rates for experts, bar numbers for attorneys)
- Assign persons to cases with specific roles and sides (plaintiff/defendant/neutral)
- Track contact information with multiple phones/emails per person

### Task & Deadline Management
- Internal tasks with urgency levels (1-4: Low, Medium, High, Urgent)
- Calendar deadlines for hearings, depositions, filing dates, and other events
- Drag-and-drop task reordering
- Group tasks by urgency or by case
- Link tasks to specific deadlines

### Time Tracking
- Log activities with descriptions and time spent
- Categorize by activity type (Meeting, Filing, Research, Drafting, Document Review)

### MCP Integration
- 41 tools accessible via Claude AI
- Natural language case management ("Add Maria Martinez as a client to the Jones case")
- Query deadlines, tasks, and case information conversationally

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React 19 + Vite)               │
│  TypeScript, Tailwind CSS, TanStack Query/Table             │
└────────────────────┬────────────────────────────────────────┘
                     │ /api/v1/*
┌────────────────────▼────────────────────────────────────────┐
│              Backend (FastAPI + FastMCP)                    │
│  Python 3.12+, SSE transport, Bearer auth                   │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                    PostgreSQL                               │
│  9 core tables + lookup tables, JSONB for flexibility       │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

### Backend
- **FastAPI** - Web framework
- **FastMCP** - MCP server framework
- **PostgreSQL** - Database
- **Uvicorn** - ASGI server

### Frontend
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **TanStack Query** - Server state management
- **TanStack Table** - Data tables
- **@dnd-kit** - Drag-and-drop

## Quick Start

See [SETUP.md](./SETUP.md) for detailed development setup instructions.

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

## Connecting to Claude.ai

1. Go to [Claude.ai](https://claude.ai)
2. Open **Settings** → **Integrations** (or look for MCP settings)
3. Add a new MCP server with URL:
   ```
   https://mcp-galipo.coopermayne.com/sse
   ```
4. Save and start a new conversation

### Example Commands
- "List all my cases"
- "Show me details for Smith v. Johnson"
- "What events are coming up this week?"
- "Add Maria Martinez as a client to the Jones case"
- "Mark the discovery task as done"

## Database Schema

| Table | Purpose |
|-------|---------|
| `jurisdictions` | Courts and venues |
| `cases` | Legal cases (central entity) |
| `persons` | All people (clients, attorneys, judges, experts, etc.) |
| `case_persons` | Person-to-case assignments with roles |
| `events` | Deadlines, hearings, depositions |
| `tasks` | Internal to-do items |
| `activities` | Time tracking entries |
| `notes` | Case notes |
| `person_types` | Lookup table for person categories |
| `expertise_types` | Lookup table for expert specializations |

## MCP Tools

Galipo exposes 41 MCP tools across these categories:

- **Cases** - Create, update, search, and delete cases
- **Persons** - Manage people and their case assignments
- **Tasks** - Add, update, reorder, and bulk-update tasks
- **Deadlines** - Manage calendar events and deadlines
- **Calendar** - Combined view of tasks and deadlines
- **Activities** - Log and manage time entries
- **Notes** - Add and manage case notes
- **Jurisdictions** - Manage courts/venues
- **Lookup Tables** - Manage person types and expertise types

## Documentation

- [SETUP.md](./SETUP.md) - Development environment setup
- [TODO.md](./TODO.md) - Planned features and known issues
- [docs/](./docs/) - Additional planning documents

## Deployment

- **Platform**: Coolify (or any Docker host)
- **Database**: PostgreSQL
- **Transport**: SSE on port 8000

The server runs on port 8000. Your reverse proxy (nginx, Caddy, etc.) should:
- Proxy requests to `localhost:8000`
- Support SSE (Server-Sent Events) - ensure no response buffering
- Handle HTTPS termination

## License

Proprietary - All rights reserved
