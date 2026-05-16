# Galipo Codebase Onboarding Guide

Welcome to Galipo. This document is the long-form intro to the codebase for someone who is taking over development of every part of the system. It walks through what each piece is, how the pieces fit together, where to find things, and the conventions and gotchas that aren't obvious from looking at the code.

Every section links to the actual files so you can click through and see the code as you read.

---

## 1. The 60-Second Pitch

Galipo is a **legal case management system for personal injury law firms**. It is two products sharing one Python process and one PostgreSQL database:

1. A **React + shadcn web dashboard** for staff (attorneys, paralegals, admin) to manage cases, tasks, deadlines, contacts, financials, intakes, SMS, and document generation.
2. An **MCP (Model Context Protocol) server** that exposes ~20 high-level tools so Claude (Desktop, claude.ai, or the in-app chat) can read and write the same data on behalf of the user.

Both surfaces hit the same database via the same `db/` layer, validated through the same Pydantic schemas. The MCP server and the REST API are mounted on a single FastMCP/FastAPI ASGI app.

Top-level layout:

```
mcp-galipo/
├── main.py            # ASGI entry — wires FastMCP + FastAPI + lifespan
├── mcp_stdio.py       # Separate entry for Claude Desktop (stdio transport)
├── config.py          # Pydantic BaseSettings — env vars validated at startup
├── models.py          # SQLAlchemy schema (single source of truth)
├── tools.py           # All MCP tools in one file (~20 of them)
├── auth.py            # Web dashboard JWT auth
├── mcp_auth.py        # OAuth provider for MCP (Claude Desktop)
├── alembic/           # DB migrations
├── db/                # Domain DB modules (cases, persons, tasks, ...)
├── routes/            # REST API endpoints for the React UI
├── schemas/           # Pydantic Input/Output models (shared by routes + tools)
├── services/          # AI extractors, document generators, in-app chat
├── lib/               # Shared helpers (tz)
├── frontend/          # React + Vite + shadcn dashboard
├── scripts/           # Backups, seeds, hooks, schema diagram
├── docs/              # Architecture, schema, setup, disaster recovery
├── static/, templates/  # Legacy static + Jinja2 templates for PDFs
├── Dockerfile         # Production container (see CRITICAL note below)
└── CLAUDE.md          # Conventions doc (treat as part of the spec)
```

[`CLAUDE.md`](../CLAUDE.md) at the repo root is the project's living convention document. **Read it carefully before changing anything.** It's the authoritative reference for naming, datetime handling, the Dockerfile COPY hazard, and frontend rules.

---

## 2. Table of Contents

1. [The 60-Second Pitch](#1-the-60-second-pitch)
2. Table of Contents
3. [Get It Running Locally](#3-get-it-running-locally)
4. [Backend Architecture & Entry Points](#4-backend-architecture--entry-points)
5. [Database Layer](#5-database-layer)
6. [Pydantic Schemas](#6-pydantic-schemas-inputoutput-contracts)
7. [REST API Routes](#7-rest-api-routes)
8. [MCP Tools (Claude AI Integration)](#8-mcp-tools-claude-ai-integration)
9. [Services Layer (AI Extractors, Generators, Chat)](#9-services-layer-ai-extractors-generators-chat)
10. [Frontend (React + shadcn)](#10-frontend-react--shadcn)
11. [Operations: Deploy, Scripts, Docs, Env Vars](#11-operations-deploy-scripts-docs-env-vars)
12. [Conventions & Gotchas Cheat Sheet](#12-conventions--gotchas-cheat-sheet)
13. [Onboarding Checklist / Recommended Reading Order](#13-onboarding-checklist--recommended-reading-order)

---

## 3. Get It Running Locally

Get the app booting on your machine first — everything else will make more sense after you've clicked around.

1. **Clone** and `cd` into the repo.
2. **PostgreSQL** — install locally or run in Docker.
3. **Env** — copy [`.env.example`](../.env.example) to `.env` and fill in at least `DATABASE_URL`, `AUTH_USERNAME`, `AUTH_PASSWORD`. Loading env vars **must** use the `set -a` pattern so child processes see them:
   ```bash
   set -a && source .env && set +a
   ```
   Without `set -a` the variables stay in the shell only — Python will silently connect to the wrong DB.
4. **Python deps:**
   ```bash
   python -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   ```
5. **Frontend deps:**
   ```bash
   cd frontend && npm install && cd ..
   ```
   Node version is pinned in [`.nvmrc`](../.nvmrc) (Node 20). Use `nvm use`.
6. **Migrations:**
   ```bash
   alembic upgrade head
   ```
7. **Seed dev data** (optional but recommended):
   ```bash
   python scripts/seed_dev_users.py
   python scripts/seed_dev_data.py
   python scripts/seed_judges.py
   ```
8. **Run both servers** — backend on `:8000`, frontend on `:5173`:
   ```bash
   # terminal 1
   uvicorn main:app --reload --port 8000
   # terminal 2
   cd frontend && npm run dev
   ```

The frontend Vite dev server proxies `/api/*` to `http://localhost:8000`, so you only ever open `http://localhost:5173` in the browser.

There's a `/dev` slash-command skill (see [`CLAUDE.md`](../CLAUDE.md) — "Local Development") that bundles all of this and restarts both servers cleanly. Use it.

[`docs/SETUP.md`](SETUP.md) has the long-form version with troubleshooting.

---

## 4. Backend Architecture & Entry Points

Galipo runs as a **dual-stack application**: a FastAPI HTTP server for the React dashboard and an integrated MCP server for Claude. Both share the same codebase, database, and lifespan.

### [`main.py`](../main.py) — the ASGI entry point

This is where the app boots:

- Imports `settings` from [`config.py`](../config.py) at module load (`main.py:1–21`).
- Defines `MCP_INSTRUCTIONS` (`main.py:26–69`) — a long string Claude sees on connect describing every tool, valid enum values, role taxonomy, and data-entry guidelines. **If you add or change tools, update this.**
- `initialize_database()` (`main.py:72–109`) runs `alembic upgrade head`, seeds lookup tables, and creates the media directory on startup. Uses a `/tmp/galipo_init.lock` file lock so multi-worker setups don't duplicate work.
- `_periodic_intake_sync()` (`main.py:114–133`) — background task that polls Google Sheets every 5 minutes for new intakes.
- `lifespan()` (`main.py:135–152`) — orchestrates startup/shutdown.
- Builds `FastMCP` with optional OAuth (`main.py:155–161`), registers tools via [`tools.py`](../tools.py)'s `register_tools(mcp)`, registers routes via [`routes/__init__.py`](../routes/__init__.py)'s `register_routes(mcp)`.
- Exports `app = mcp.http_app(transport="streamable-http")` (`main.py:181`). This is what gunicorn/uvicorn serve.

**One ASGI app serves both:** every `/api/v1/*` route is a FastAPI route registered with `@mcp.custom_route()`; every MCP tool call goes through the `/mcp` endpoint.

### [`config.py`](../config.py) — centralized settings

Pydantic `BaseSettings` reads, validates, and types every env var **once at startup**. Every module imports `from config import settings` — no scattered `os.environ`.

- Auto-loads `.env`.
- `normalize_database_url()` (`config.py:64–71`) rewrites `postgres://` → `postgresql://` for SQLAlchemy 2.0+ (Heroku/Coolify-style URLs).
- `JWT_SECRET` fallback logic (`config.py:73–85`) — falls back to `AUTH_PASSWORD`, then to a random hex string in dev. In **production** an empty `JWT_SECRET` raises at startup (otherwise every redeploy logs all users out).
- `is_production` (`config.py:87–97`) auto-detects via `RAILWAY_ENVIRONMENT`, cloud `DATABASE_URL`, or `ENV=production`.

### [`auth.py`](../auth.py) — web dashboard JWT auth

Multi-user JWT auth backed by the `users` and `auth_sessions` tables:

- `authenticate()` checks bcrypt hash in DB first, falls back to legacy `AUTH_USERNAME`/`AUTH_PASSWORD` env vars (deprecated).
- `create_session()` writes a row in `auth_sessions`, returns a JWT with `sid` claim. **Server-side `sid` revocation** is how logout works without rotating `JWT_SECRET`.
- `require_auth(request)` / `require_admin(request)` — call these in route handlers. They also bump `users.last_active_at` (throttled to once/minute).
- `create_file_token()` / `validate_file_token()` — 60-second JWTs scoped to a file path for download URLs.

### [`mcp_auth.py`](../mcp_auth.py) — OAuth 2.1 for MCP clients

When Claude Desktop / claude.ai connects to the hosted MCP server, it does the full OAuth 2.1 dance (Dynamic Client Registration, authorize, code → token exchange, refresh).

- `PasswordOAuthProvider` (`mcp_auth.py:37–281`) — full implementation, all state **in memory**. That's why production runs with `-w 1` (one worker) in the [`Dockerfile`](../Dockerfile) `CMD` — OAuth state would diverge across workers.
- Custom `/mcp/login` HTML form (`mcp_auth.py:297–459`) — password check uses `secrets.compare_digest()` for timing-attack resistance.
- Only enabled when both `MCP_AUTH_PASSWORD` and `MCP_BASE_URL` are set; otherwise the MCP server is open (fine for local dev).

### [`mcp_stdio.py`](../mcp_stdio.py) — separate entry for Claude Desktop

Claude Desktop expects MCP servers to speak stdio, not HTTP. This script loads `.env`, runs migrations, registers the same tools, and calls `mcp.run(transport="stdio")`. Point Claude Desktop's `claude_desktop_config.json` at this file:

```json
{ "galipo": { "command": "python", "args": ["/path/to/mcp_stdio.py"] } }
```

### [`lib/tz.py`](../lib/tz.py) — timezone helpers

```python
UTC = timezone.utc                       # for DB storage
LA = ZoneInfo("America/Los_Angeles")     # for display/documents
utc_now()                                # shorthand for datetime.now(UTC)
```

**Never use `datetime.now()` or `datetime.utcnow()` bare** — both are wrong (one is naive, the other is deprecated). DB always stores UTC (`DateTime(timezone=True)` → `timestamptz`); the React frontend converts to Pacific via [`frontend/src/lib/datetime.ts`](../frontend/src/lib/datetime.ts).

### [`Dockerfile`](../Dockerfile) — **CRITICAL gotcha**

Multi-stage: Node builds the React app, then Python copies the backend. The COPY lines are **explicit, not wildcards**:

```dockerfile
COPY main.py models.py tools.py auth.py mcp_auth.py mcp_stdio.py config.py alembic.ini ./
COPY schemas/ ./schemas/
COPY alembic/ ./alembic/
COPY db/ ./db/
COPY routes/ ./routes/
COPY services/ ./services/
COPY static/ ./static/
COPY templates/ ./templates/
```

**Every time you add a new `.py` file or new package directory at the repo root, you MUST add it here.** This is the #1 cause of production outages — `ModuleNotFoundError` at startup. See the "Dockerfile - CRITICAL" section in [`CLAUDE.md`](../CLAUDE.md).

### [`requirements.txt`](../requirements.txt) — key deps

`fastmcp`, `fastapi`, `uvicorn`, `gunicorn`, `sqlalchemy`, `alembic`, `psycopg2-binary`, `PyJWT`, `bcrypt`, `anthropic`, `weasyprint`, `docxtpl`, `pypdf`, `google-api-python-client`, `twilio`, `filelock`.

### [`.mcp.json`](../.mcp.json) — Claude's tools, not ours

This file configures the MCP servers *Claude Code itself* can talk to while developing (`postgres`, `context7`, `shadcn`, `sequential-thinking`). It is **not** how Galipo's MCP server is configured — that lives in [`main.py`](../main.py).

---

## 5. Database Layer

[`models.py`](../models.py) (~1400 lines) is the **single source of truth** for the schema. SQLAlchemy declarative models generate SQL; Alembic diffs them against the live DB to autogenerate migrations.

### Major tables

| Table | Purpose |
|---|---|
| `cases` | Case root entity; status, dates (DOI, trial, deadlines), summary, result; ARRAY columns for attorney/paralegal IDs |
| `persons` | Unified contact directory (clients, contacts, defendants, experts, etc.). Name, JSONB email/phone arrays, org, notes |
| `roles` | Role catalog (Client, Counsel, Expert, Defendant, Mediator...) with categories |
| `person_roles` | Junction: person × role × optional case. JSONB `attributes`, `cost_share_pct` |
| `judges` | **Separate from persons**. Title, jurisdiction FK, chambers, courtroom, status |
| `proceedings` | Court filing within a case (state, federal removal, appeal can coexist) |
| `proceeding_judges` | Judge × proceeding (N judges per filing) |
| `events` | Calendar deadlines/hearings; date, time, location, ARRAY `attendee_ids` |
| `tasks` | Action items; status, urgency, optional case/event link, assignee, `sort_order` for drag-and-drop |
| `intakes` | Leads from Google Sheets; status, AI rating + summary |
| `invoices` | Cost advanced; amount, status, `phase_id` for multi-phase cost-sharing |
| `liens` | Medical/lien claims; claimed vs. negotiated amounts |
| `case_financials` | Post-resolution summary (gross recovery, costs, lien total, fee arrangement) |
| `case_comments`, `intake_comments` | Threaded comments with JSONB `detail` |
| `auth_sessions` | Server-side JWT `sid` store for revocation |
| `users` | Staff with bcrypt password, position, JSONB `visible_features` |
| `jurisdictions` | Courts; JSONB `aliases` |
| `webhook_logs` | CourtListener / inbound webhook audit trail |

[`docs/SCHEMA.md`](SCHEMA.md) has an auto-generated Mermaid ER diagram — that's the picture-form of all this. Regenerated on commits touching [`models.py`](../models.py) by the pre-commit hook (see §11).

### The unified roles system

The codebase used to have separate tables for clients, defendants, experts, etc. Now it's one `persons` table + a `roles` catalog + a `person_roles` junction. A single person can hold multiple roles, scoped either globally (`case_id IS NULL`) or per-case. **Partial unique indexes** enforce one-of-each-role per scope.

Cost sharing has two modes:
- **Simple**: `person_roles.cost_share_pct` — one percentage.
- **Advanced**: `cases.cost_sharing_config` JSONB — multi-phase, multi-party, with caps. Pure allocation logic in [`db/cost_sharing.py`](../db/cost_sharing.py) (works on dicts, no DB calls — easy to unit-test).

### Judges are not persons

Judges recur across many cases but don't need contact-management features. They live in their own `judges` table and link to `proceedings` (not directly to `cases`) via `proceeding_judges`. This lets you model appellate panels and removed cases naturally. CRUD + fuzzy match in [`db/judges.py`](../db/judges.py).

### JSONB patterns

JSONB is used for:
- `persons.phones`, `persons.emails`, `judges.phones`, `judges.emails` — arrays of `{label, value}` objects, default `[]`
- `person_roles.attributes` — schema-less role-specific fields (bar number, hourly rate, lien category). Indexed.
- `cases.cost_sharing_config` — multi-phase cost split document
- `intake_comments.detail`, `case_comments.detail` — comment metadata
- `users.visible_features` — feature flags per user

Always treat JSONB columns as nullable dicts/lists in Python (`or {}` / `or []`).

### Tasks: `sort_order` & drag-drop

[`db/tasks.py`](../db/tasks.py) implements gap-insertion drag-and-drop: tasks are ordered by an indexed `sort_order` integer, new positions use gaps (e.g. 1000) so a reorder is one UPDATE, not N. See `reorder_task()`.

### Datetime convention

| Context | Use |
|---|---|
| Saving to DB | `datetime.now(UTC)` or `func.now()` |
| Display in UI | Frontend converts to LA in [`frontend/src/lib/datetime.ts`](../frontend/src/lib/datetime.ts) |
| Generated PDFs / DOCX | `datetime.now(LA)` |
| Export filenames | `datetime.now(LA).strftime(...)` |

Full table in [`CLAUDE.md`](../CLAUDE.md) — "Timezone & Datetime Conventions".

### The `db/` module suite

Each file is a domain. They all use `with SessionLocal() as session:` from [`db/session.py`](../db/session.py).

| Module | Purpose |
|---|---|
| [`db/session.py`](../db/session.py) | Engine + `SessionLocal` factory |
| [`db/connection.py`](../db/connection.py) | `init_db()`, `drop_all_tables()`, seeds (admin user, jurisdictions, roles, objections) |
| [`db/cases.py`](../db/cases.py) | Case CRUD, SOL deadline calculation, case color assignment, task/invoice aggregation |
| [`db/persons.py`](../db/persons.py) | Person CRUD, fuzzy search, role assignment |
| [`db/roles.py`](../db/roles.py) | Role lookup and filtering |
| [`db/judges.py`](../db/judges.py) | Judge CRUD, fuzzy search, proceeding linkage |
| [`db/tasks.py`](../db/tasks.py) | Task CRUD + sort_order gap-insertion reorder |
| [`db/events.py`](../db/events.py) | Event CRUD, attendee arrays, trial calendar view |
| [`db/proceedings.py`](../db/proceedings.py) | Proceedings + grouped judge fetch |
| [`db/intakes.py`](../db/intakes.py) | Intake CRUD, Google Sheets sync hooks, AI rating |
| [`db/invoices.py`](../db/invoices.py) | Invoice CRUD, phase bucketing |
| [`db/liens.py`](../db/liens.py) | Lien CRUD, file attachments |
| [`db/financials.py`](../db/financials.py) | Case financial 1:1 (gross recovery, costs, settlement) |
| [`db/cost_sharing.py`](../db/cost_sharing.py) | Pure allocator (phases, parties, caps) |
| [`db/intake_comments.py`](../db/intake_comments.py) | Intake-scoped threaded comments + read tracking |
| [`db/case_comments.py`](../db/case_comments.py) | Case-scoped threaded comments + read tracking |
| [`db/comments.py`](../db/comments.py) | Polymorphic comment ops by entity type |
| [`db/fuzzy_match.py`](../db/fuzzy_match.py) | Name scoring/matching (normalize + Soundex bonus) |
| [`db/contacts.py`](../db/contacts.py) | Unified persons + judges search |
| [`db/users.py`](../db/users.py) | User CRUD, paralegal assignments, feature flags |
| [`db/auth_sessions.py`](../db/auth_sessions.py) | Server-side token revocation |
| [`db/activity.py`](../db/activity.py) | `last_active_at` updates, page view log |
| [`db/jurisdictions.py`](../db/jurisdictions.py) | Court CRUD + alias matching |
| [`db/types.py`](../db/types.py) | Expertise type lookup table |
| [`db/objections.py`](../db/objections.py) | Discovery objection templates |
| [`db/payees.py`](../db/payees.py) | Vendor/expert entities for invoices/liens |
| [`db/import_case.py`](../db/import_case.py) | Atomic bulk case import |
| [`db/trial_calendar.py`](../db/trial_calendar.py) | Trial dates + blocking events view |
| [`db/sms.py`](../db/sms.py) | Twilio SMS conversations + messages |
| [`db/listeners.py`](../db/listeners.py) | SQLAlchemy ORM event listeners (updated_at, etc.) |
| [`db/webhooks.py`](../db/webhooks.py) | Webhook log CRUD |
| [`db/validation.py`](../db/validation.py) | Shared validation helpers and error constants |
| [`db/dev_users.py`](../db/dev_users.py) | Dev seed helper |

### Alembic migration workflow

[`alembic/env.py`](../alembic/env.py) reads `DATABASE_URL` from [`config.py`](../config.py) and uses `Base.metadata` from [`models.py`](../models.py). `include_object()` excludes legacy backup tables.

```bash
# 1. edit models.py
# 2. generate
alembic revision --autogenerate -m "add foo column to cases"
# 3. review the file in alembic/versions/ — autogen misses partial indexes & data migrations
# 4. apply
alembic upgrade head
```

Other useful commands: `alembic current`, `alembic history`, `alembic downgrade -1` (dev only), `alembic check`.

Rules: **never modify an already-deployed migration** (write a new one); migrations are mandatory (the legacy `migrations/` dir is gone); `alembic upgrade head` runs automatically on container startup via [`Dockerfile`](../Dockerfile) `CMD`.

---

## 6. Pydantic Schemas (Input/Output Contracts)

[`schemas/`](../schemas/) is its own package because both the REST routes **and** the MCP tools validate against the same models. It's the canonical place for enums, request bodies, and serialization shapes.

- [`schemas/common.py`](../schemas/common.py) — `Literal` types and constants. This is where every enum lives:
  - `CaseStatus` — "Signing Up", "Prospective", "Pre-Claim", ..., "Closed"
  - `TaskStatus` — "Pending", "Active", "Done", "Partially Done", "Blocked", "Awaiting Atty Review"
  - `IntakeStatus` — "New", "Dave Review", "Needs Follow-Up", ..., "Archived"
  - `Urgency` — "Low", "Medium", "High", "Urgent"
  - `PersonSide` — "plaintiff", "defendant", "neutral"
  - `JudgeRole` — "Presiding", "Magistrate", "Panel", "Other"
  - `ResolutionType` — "settlement", "verdict", "judgment", "arbitration_award"
  - Also: `INTAKE_TRANSITIONS` (valid state machine), list constants derived from each `Literal`, and the shared `ContactInfo` model.
- [`schemas/inputs.py`](../schemas/inputs.py) — ~28 `Create*` / `Update*` request models. Update models have everything optional; Create models require the minimum (e.g. `CreateCaseInput` only requires `case_name`).
- [`schemas/outputs.py`](../schemas/outputs.py) — ~37 response models. All have `model_config = ConfigDict(from_attributes=True)` so you can do `CaseDetailOut.model_validate(orm_case)`.
- [`schemas/__init__.py`](../schemas/__init__.py) — wildcard re-exports. Always import from the top: `from schemas import CaseStatus, CreateCaseInput, CaseDetailOut`.

[`db/validation.py`](../db/validation.py) imports these `Literal` types so server-side validation uses the same source of truth as the API surface.

---

## 7. REST API Routes

[`routes/`](../routes/) holds the REST API for the web dashboard. Each file registers endpoints on the FastMCP app using `@mcp.custom_route()` (FastMCP wraps FastAPI). All routes mount under `/api/v1/*`. `register_routes(mcp)` in [`routes/__init__.py`](../routes/__init__.py) is called once at startup from [`main.py`](../main.py).

Auth: every endpoint except `/api/v1/health` and the CourtListener webhook calls `auth.require_auth(request)` (or `require_admin` for admin-only).

### Module index

| Module | Prefix | What it does |
|---|---|---|
| [`routes/auth.py`](../routes/auth.py) | `/api/v1/auth` | Login (with rate limiter), `verify`, logout, change password |
| [`routes/cases.py`](../routes/cases.py) | `/api/v1/cases` | Case CRUD + status counts |
| [`routes/tasks.py`](../routes/tasks.py) | `/api/v1/tasks` | Task CRUD + drag-and-drop `reorder` |
| [`routes/events.py`](../routes/events.py) | `/api/v1/events` | Event CRUD; `include_past`, `past_days` filters |
| [`routes/notes.py`](../routes/notes.py) | `/api/v1/notes` | Case notes — triggers system comment broadcast on create |
| [`routes/persons.py`](../routes/persons.py) | `/api/v1/persons` | Person CRUD; filter by case/role/category; `include_roles=true` |
| [`routes/roles.py`](../routes/roles.py) | `/api/v1/roles` | Role catalog CRUD |
| [`routes/judges.py`](../routes/judges.py) | `/api/v1/judges` | Judge CRUD + search |
| [`routes/proceedings.py`](../routes/proceedings.py) | `/api/v1/cases/{id}/proceedings` | Court filing CRUD; CourtListener docket linking |
| [`routes/intakes.py`](../routes/intakes.py) | `/api/v1/intakes` | Intake CRUD + counts; auto-sync from Google Sheets via background task |
| [`routes/financials.py`](../routes/financials.py) | `/api/v1/financials` | Case financial summary CRUD |
| [`routes/invoices.py`](../routes/invoices.py) | `/api/v1/invoices` | Invoice CRUD + PDF/image upload + `mark-paid` |
| [`routes/liens.py`](../routes/liens.py) | `/api/v1/liens` | Lien CRUD with file uploads + per-case stats |
| [`routes/payees.py`](../routes/payees.py) | `/api/v1/payees` | Payee CRUD + W9 upload + autocomplete `search` |
| [`routes/objections.py`](../routes/objections.py) | `/api/v1/objections` | Discovery objection templates + reorder |
| [`routes/contacts.py`](../routes/contacts.py) | `/api/v1/contacts` | Unified persons + judges search (min 2 chars) |
| [`routes/comments.py`](../routes/comments.py) | `/api/v1/comments/{entity_type}/{id}` | **Polymorphic** comments (cases, intakes, invoices...); SSE broadcast; unread counts |
| [`routes/activity.py`](../routes/activity.py) | `/api/v1/activity`, `/tracking/pageview` | Page view log + admin-only analytics |
| [`routes/users.py`](../routes/users.py) | `/api/v1/users`, `/api/v1/attorneys` | User CRUD (admin), attorney list (filter dropdowns) |
| [`routes/stats.py`](../routes/stats.py) | `/api/v1/stats`, `/api/v1/constants`, `/api/v1/jurisdictions` | Dashboard stats, enum catalog for frontend, jurisdiction CRUD |
| [`routes/health.py`](../routes/health.py) | `/api/v1/health` | **No auth.** DB status, `alembic_revision`, `git_commit`, `uptime_seconds` |
| [`routes/chat.py`](../routes/chat.py) | `/api/v1/chat` | In-app Claude chat; SSE streaming; in-memory rate limit (20/min/user) |
| [`routes/sse.py`](../routes/sse.py) | `/api/v1/stream` | Server-Sent Events with per-client `asyncio.Queue` (256 buffer), 15s heartbeat. Accepts token via query param |
| [`routes/webhooks.py`](../routes/webhooks.py) | `/api/v1/webhooks` | Log viewer + `/courtlistener/{token}` ingestion (token from `WEBHOOK_SECRET_COURTLISTENER`) |
| [`routes/sms.py`](../routes/sms.py) | `/api/v1/sms` | Twilio SMS conversations + outbound + inbound webhook |
| [`routes/export.py`](../routes/export.py) | `/api/v1/export` | Case list JSON/PDF/DOCX, intakes PDF, costs PDF |
| [`routes/templates.py`](../routes/templates.py) | `/api/v1/templates` | Upload pleading PDF → AI extract → edit → DOCX generate |
| [`routes/rfp.py`](../routes/rfp.py) | `/api/v1/rfp` | Upload RFP PDF → extract requests → AI-suggest objections → generate response DOCX |
| [`routes/trial_calendar.py`](../routes/trial_calendar.py) | `/api/v1/trial-calendar` | Trial data + blocking events + PDF export (list and visual styles) + slot finder |
| [`routes/static.py`](../routes/static.py) | `/`, `/assets/*`, `/static/*`, `/legacy` | Serves the React build + SPA catch-all (registered **last** so it doesn't shadow API routes) |
| [`routes/common.py`](../routes/common.py) | (utilities) | `api_error()`, `pydantic_error()`, `DEFAULT_PAGE_SIZE = 50` |

### Response shapes

Standardized across the API:

- **Success:** `{"success": true, "data": ...}`
- **Error:** `{"success": false, "error": {"message": "...", "code": "ERROR_CODE"}}`
- **Validation (422):** `{"success": false, "error": {"message": "...", "code": "VALIDATION_ERROR", "details": [{"field": "...", "valid_values": [...]}]}}`

Status codes: 401 unauth, 403 forbidden, 404 missing, 429 rate-limited (with `Retry-After`), 500 server error.

### Registration order matters

[`routes/__init__.py`](../routes/__init__.py) registers in dependency order: auth → domain APIs → specialized (chat, export, webhooks, SMS) → **static last**. The static catch-all serves `index.html` for SPA routing and would otherwise intercept everything.

---

## 8. MCP Tools (Claude AI Integration)

The MCP server is what makes Claude useful inside the firm. It's exposed two ways from the same code:

1. **Streamable HTTP** at `/mcp` for claude.ai / hosted clients (auth via OAuth, see [`mcp_auth.py`](../mcp_auth.py)).
2. **stdio** via [`mcp_stdio.py`](../mcp_stdio.py) for Claude Desktop.

Both register the **same tools** through `register_tools(mcp)` in [`tools.py`](../tools.py) — there is no protocol-specific code in the tools themselves.

### Tool shape

Every tool:
- Accepts a `Context` (MCP-provided, used for logging) and a Pydantic input model from [`schemas/inputs.py`](../schemas/inputs.py).
- Returns a plain dict that FastMCP serializes to JSON.
- Returns `{"success": False, "error": {"code": "VALIDATION_ERROR" | "NOT_FOUND" | "QUERY_ERROR", ...}}` on failure (with `valid_values` hints when relevant).
- Calls into [`db/*`](../db/) functions for persistence.

The MCP server is intentionally **higher-level than the REST API**: operations are consolidated to minimize round-trips with Claude. For example, `manage_case_role(action="assign"|"update_role"|"change"|"remove", ...)` is one tool, whereas the React UI uses several discrete endpoints.

### The 20 MCP tools

| # | Tool | Purpose |
|---|---|---|
| 1 | `get_current_time` | Pacific Time at start of session (anchor for relative dates) |
| 2 | `list_staff` | Active attorneys/paralegals/admins for assignment |
| 3 | `import_case` | Atomic bulk import: case + persons + events + tasks + proceedings |
| 4 | `search` | Universal search across `cases / persons / events / tasks / judges` with filters + pagination |
| 5 | `get_details` | Full record for any entity by id |
| 6 | `manage_case` | Create / update / delete / confirm-trial-date |
| 7 | `manage_person` | Create / update / delete contact |
| 8 | `manage_case_role` | Assign / update / change / remove person role on a case |
| 9 | `manage_event` | Create / update / delete calendar event |
| 10 | `manage_task` | Create / update / delete / bulk-update tasks |
| 11 | `manage_note` | Case note CRUD |
| 12 | `manage_proceeding` | Proceeding CRUD + add/remove judges |
| 13 | `manage_judge` | Judge record CRUD |
| 14 | `list_jurisdictions` | All courts |
| 15 | `create_jurisdiction` | Create new court/jurisdiction |
| 16 | `manage_intake` | Create or `preview` intake from contact info |
| 17 | `manage_case_staff` | Assign / remove attorney or paralegal on case |
| 18 | `merge_persons` | Merge duplicates (or suggest duplicates if no target given) |
| 19 | `reschedule_overdue` | Bulk-bump all overdue incomplete tasks to a new date |
| 20 | `recommend_trial_slots` | Find available weeks given estimated trial days |

Defined in [`tools.py`](../tools.py); the dispatch list is in `register_tools()`.

### Conventions

- Dates are `YYYY-MM-DD` strings, interpreted in Pacific time.
- Search supports `limit` (1–200, default 50) and `offset`.
- Tools never raise to the protocol layer — they return error envelopes.
- The `MCP_INSTRUCTIONS` block in [`main.py`](../main.py) tells Claude how to choose statuses, roles, and date strings. **Update it when you add or change tools.**

---

## 9. Services Layer (AI Extractors, Generators, Chat)

[`services/`](../services/) holds business logic that doesn't belong in `db/` (no SQL) and doesn't belong in `routes/` (no HTTP). It's mostly:

1. **AI extractors** — turn PDFs / blobs of text into structured data via Claude tool_use.
2. **Document generators** — turn structured data into DOCX/PDF deliverables.
3. **The in-app chat** — Claude with mode-specific tools.
4. **Integrations** (Google Sheets).

### AI extractors

| File | Model | Job |
|---|---|---|
| [`services/case_extractor.py`](../services/case_extractor.py) | `settings.extraction_model` | Court caption, parties, judge, hearing date/time/location from motions and briefs. Also suggests document filenames. |
| [`services/intake_extractor.py`](../services/intake_extractor.py) | `settings.extraction_model` | Parses inbound emails/notes/referral letters into intake fields (name, phone, DOI, case type, location, referral source). |
| [`services/invoice_extractor.py`](../services/invoice_extractor.py) | `settings.extraction_model` | Extracts vendor, amount, date, category, payable info from invoice text or image; Claude vision fallback for scanned PDFs. |
| [`services/rfp_extractor.py`](../services/rfp_extractor.py) | `settings.extraction_model` | Pulls the case caption and individual numbered requests from a Request for Production. Then runs an analysis pass that suggests applicable objections per request. Logs token usage. |
| [`services/toa_extractor.py`](../services/toa_extractor.py) | `claude-sonnet-4-20250514` (hardcoded) | Table-of-Authorities: extracts cases, statutes, constitutional provisions, secondary sources from a brief. Resolves short forms / `Id.`, flags duplicates and inconsistencies, attributes page numbers via per-page text. |
| [`services/pdf_extractor.py`](../services/pdf_extractor.py) | (utility) | Generic pypdf text dump (first N pages). Raises on image-only PDFs so callers can fall back to vision. |

All extractors use Claude's **tool_use** to enforce schema compliance. System prompts emphasize precision ("extract exactly what appears, no placeholders") and never fabricate.

### Intake AI

[`services/intake_ai.py`](../services/intake_ai.py) is the only AI service that takes intake fields + comments and returns a quality assessment (1–5 stars), injury severity (1–5, separate axis), an `ai_summary` markdown block (Events, Injuries, Claims, Considerations), and short reasoning. Runs async in the background and broadcasts status via SSE.

### Interaction summarizer

[`services/interaction_summarizer.py`](../services/interaction_summarizer.py) — short 1–2 sentence summaries of logged emails / phone calls, focused on what's NEW vs. what's already in case notes. Uses `extraction_model` (Haiku) for cost.

### Document generators

| File | Output | Engine | Job |
|---|---|---|---|
| [`services/pleading_generator.py`](../services/pleading_generator.py) | DOCX | docxtpl (Jinja2 + subdocs) | Legal briefs with modular sections (Notice, Meet & Confer, Memo, TOC, TOA, Certificate of Compliance, Declaration) |
| [`services/rfp_generator.py`](../services/rfp_generator.py) | DOCX | docxtpl | RFP response with objections + boilerplate per request |
| [`services/toa_generator.py`](../services/toa_generator.py) | DOCX | python-docx | Formal Table of Authorities — double-spaced, Times 14pt, hanging indents, dot-leader tabs, collapses page numbers (`passim` for 6+, ranges for consecutive) |
| [`services/docx_generator.py`](../services/docx_generator.py) | DOCX | docxtpl + RichText | Case status report with conditional styling (past events italic + grey, urgent tasks bold, starred events highlighted) |
| [`services/pdf_generator.py`](../services/pdf_generator.py) | PDF | HTML/CSS + WeasyPrint | Case portfolio report (summary table + per-case detail) |
| [`services/intake_pdf_generator.py`](../services/intake_pdf_generator.py) | PDF | WeasyPrint | Intake list + per-intake detail with SOL countdown (6mo/2yr deadlines colored) |
| [`services/cost_report_generator.py`](../services/cost_report_generator.py) | PDF | WeasyPrint | Per-case cost breakdown grouped by Unpaid/Paid; firm-vs-shared split |
| [`services/trial_calendar_pdf.py`](../services/trial_calendar_pdf.py) | PDF | WeasyPrint | Compact trial list (portrait), attorney initials + colors |
| [`services/trial_calendar_visual_pdf.py`](../services/trial_calendar_visual_pdf.py) | PDF | WeasyPrint | Week-row visual layout mirroring the web UI |
| [`services/case_list_report.py`](../services/case_list_report.py) | PDF | WeasyPrint | Grouped case list (by attorney / status / alpha) |

DOCX path uses [docxtpl](https://docxtpl.readthedocs.io/); PDF path uses [WeasyPrint](https://weasyprint.org/). Templates live under [`templates/`](../templates/) (see §11).

### In-app chat — [`services/chat/`](../services/chat/)

The Claude-powered chat that lives in the dashboard. Files:

- [`services/chat/client.py`](../services/chat/client.py) — `AsyncAnthropic` wrapper. Applies ephemeral prompt caching to tool definitions. System prompt enforces batch tool calling. Uses `settings.chat_model`.
- [`services/chat/modes.py`](../services/chat/modes.py) — mode definitions (`tasks`, `events`, `people`, `proceedings`, `overview`). Each mode has an allowlisted tool set and a system prompt addition that steers Claude's behavior.
- [`services/chat/presets.py`](../services/chat/presets.py) — pre-fetches high-priority tasks and upcoming events/deadlines and injects them straight into the system prompt, so Claude doesn't need to spend tool calls on common questions. Filters by `user_id` when given.
- [`services/chat/executor.py`](../services/chat/executor.py) — runs MCP tools from the chat. Truncates large results intelligently (caps at ~12k chars, summarizes overflow).
- [`services/chat/tools.py`](../services/chat/tools.py) — registers the subset of MCP tools available to chat (with a blacklist for sensitive ops).
- [`services/chat/types.py`](../services/chat/types.py) — `ToolCall`, `ToolResult`, `StreamEventType`.
- [`services/chat/debug.py`](../services/chat/debug.py) — debug helpers.

Flow: user message → mode system prompt applies → presets inject context → Claude batches tool calls → executor runs each tool → results truncated → Claude synthesizes reply → SSE-streamed to UI.

### Google Sheets

[`services/google_sheets.py`](../services/google_sheets.py) — service account auth (`GOOGLE_SHEETS_CLIENT_EMAIL`, `GOOGLE_SHEETS_PRIVATE_KEY`, `GOOGLE_SHEETS_SPREADSHEET_ID`). Reads cols A–K from the firm's intake form sheet, maps to intake fields, returns list of dicts with `google_row_number` for upsert dedup. Called by `_periodic_intake_sync()` in [`main.py`](../main.py).

---

## 10. Frontend (React + shadcn)

The dashboard. Located in [`frontend/`](../frontend/). **Do not look at `_frontend_old/`** — it's archived for reference; conventions are different. The new frontend is a clean start.

### Stack

- **React 19** + **React Router v7** (lazy-loaded routes)
- **Vite** (dev server + build)
- **TypeScript**
- **Tailwind CSS v4** — utility-only, no CSS-in-JS
- **shadcn/ui** in `radix-lyra` style, `neutral` base, JetBrains Mono font, **Hugeicons** for icons (not Lucide)
- **TanStack Query** for server state (caching, mutations, invalidation)
- **TanStack Table** for headless table logic (sorting/filtering/pagination)
- **React Hook Form + Zod** for forms
- **Sonner** for toasts

Config: [`frontend/components.json`](../frontend/components.json), [`frontend/vite.config.ts`](../frontend/vite.config.ts), [`frontend/tsconfig.json`](../frontend/tsconfig.json), [`frontend/package.json`](../frontend/package.json).

### Conventions

- **Files:** `kebab-case.tsx` / `kebab-case.ts` (components, hooks, services).
- **Components:** `PascalCase` exports — `export function IntakeForm() { ... }`.
- **Hooks:** `useCamelCase` — `useAuth`, `useDebounce`.
- **Imports:** always `@/` alias, never relative. `@/` → `frontend/src/` (configured in both Vite and TS).
- **Square corners.** The theme uses sharp corners — **no `rounded-*` on containers, cards, tables, toasts, badges, or other UI elements.** Non-negotiable.
- **Semantic status colors.** Use the CSS-variable tokens `--success`, `--warning`, `--info`, `--purple` (+ `-foreground`) defined in [`frontend/src/index.css`](../frontend/src/index.css). Never raw `bg-blue-500/15` etc.
- **Datetime display.** All timestamp formatting goes through [`frontend/src/lib/datetime.ts`](../frontend/src/lib/datetime.ts) — explicit `timeZone: "America/Los_Angeles"`, never browser default. Functions: `formatTimestamp`, `formatTime`, `formatLA`, `formatDateHeader`, `getDateKey`, `timeAgo`. Date-only fields (DOI, due dates) don't need TZ conversion — parse with `"T00:00:00"`.
- **API client.** All calls go through `apiFetch()` in [`frontend/src/lib/api.ts`](../frontend/src/lib/api.ts) — auto-attaches Bearer token from localStorage, redirects to `/login` on 401.
- **Auth.** Auth state lives in `useAuth` (context). Protected routes redirect to `/login` if unauthenticated.

### Three-layer component philosophy

1. **UI layer** — [`frontend/src/components/ui/`](../frontend/src/components/ui/) — shadcn primitives only. Generic, reusable, no feature logic. You may add variants/props; you may not put app logic here.
2. **Common layer** — [`frontend/src/components/common/`](../frontend/src/components/common/) — shared app-level components composed from `ui/`. Used by 2+ pages. Examples: `DataTableColumnHeader`, `DataTablePagination`, `DataTableViewOptions`, `StatusBadge`, `ContactDetailDialog`, `ConfirmDialog`.
3. **Feature layer** — [`frontend/src/pages/*/components/`](../frontend/src/pages/) and [`frontend/src/components/layout/`](../frontend/src/components/layout/) — feature-specific, business logic, validation, data fetching. **If you find yourself copying a feature component into another page, stop and promote it to `common/`.**

### Folder layout

```
frontend/src/
├── main.tsx              # Bootstraps the router
├── index.css             # Tailwind + CSS variables (OKLCH, dark mode)
├── components/
│   ├── ui/               # shadcn primitives only
│   ├── layout/           # app shell: sidebar, header
│   └── common/           # shared cross-page components
├── pages/
│   ├── dashboard/        index.tsx
│   ├── intakes/          index.tsx + detail.tsx + columns.tsx + components/
│   ├── cases/            index.tsx + all.tsx + detail.tsx + costs/ + components/
│   ├── tasks/, events/, trial-calendar/, financials/, invoices/, payees/,
│   ├── contacts/, judges/, templates/, court-listener/, sms/, users/, activity/
│   └── login/
├── hooks/                # useAuth, useTheme, useDebounce, useMobile, useSSE, useChatStream, ...
├── services/             # API clients (one file per backend domain)
├── lib/                  # api.ts, datetime.ts, cn() utils
└── types/                # shared TS types
```

### Routes

Defined in [`frontend/src/main.tsx`](../frontend/src/main.tsx) (around lines 37–65), lazy-loaded.

| Path | Page |
|---|---|
| `/login` | [`pages/login/index.tsx`](../frontend/src/pages/login/) |
| `/` | [`pages/dashboard/index.tsx`](../frontend/src/pages/dashboard/) |
| `/cases` | [`pages/cases/index.tsx`](../frontend/src/pages/cases/) (grouped "My Cases") |
| `/cases/all` | [`pages/cases/all.tsx`](../frontend/src/pages/cases/all.tsx) (table) |
| `/cases/:id` | [`pages/cases/detail.tsx`](../frontend/src/pages/cases/detail.tsx) |
| `/cases/:id/costs` | [`pages/cases/costs/`](../frontend/src/pages/cases/costs/) |
| `/intakes` | [`pages/intakes/index.tsx`](../frontend/src/pages/intakes/) |
| `/intakes/:id` | [`pages/intakes/detail.tsx`](../frontend/src/pages/intakes/detail.tsx) |
| `/tasks` | [`pages/tasks/`](../frontend/src/pages/tasks/) |
| `/events` | [`pages/events/`](../frontend/src/pages/events/) |
| `/trial-calendar` | [`pages/trial-calendar/`](../frontend/src/pages/trial-calendar/) |
| `/financials` | [`pages/financials/`](../frontend/src/pages/financials/) |
| `/invoices` | [`pages/invoices/`](../frontend/src/pages/invoices/) |
| `/payees` | [`pages/payees/`](../frontend/src/pages/payees/) |
| `/contacts/*` | [`pages/contacts/`](../frontend/src/pages/contacts/) |
| `/judges` | [`pages/judges/`](../frontend/src/pages/judges/) |
| `/templates/*` | [`pages/templates/`](../frontend/src/pages/templates/) |
| `/court-listener` | [`pages/court-listener/`](../frontend/src/pages/court-listener/) |
| `/sms`, `/sms/:id` | [`pages/sms/`](../frontend/src/pages/sms/) |
| `/users` | [`pages/users/`](../frontend/src/pages/users/) (admin) |
| `/activity` | [`pages/activity/`](../frontend/src/pages/activity/) |

### Services — frontend → backend API map

[`frontend/src/services/`](../frontend/src/services/) — one file per backend domain. All call `apiFetch()`.

| File | Hits | Notes |
|---|---|---|
| [`services/auth.ts`](../frontend/src/services/auth.ts) | `/api/v1/auth/*` | login / verify / logout / change-password |
| [`services/cases.ts`](../frontend/src/services/cases.ts) | `/api/v1/cases/*` | CRUD + counts + comments + export PDFs |
| [`services/intakes.ts`](../frontend/src/services/intakes.ts) | `/api/v1/intakes/*` | CRUD + counts + bulk archive |
| [`services/tasks.ts`](../frontend/src/services/tasks.ts) | `/api/v1/tasks/*` | CRUD + reorder |
| [`services/events.ts`](../frontend/src/services/events.ts) | `/api/v1/events/*` | |
| [`services/financials.ts`](../frontend/src/services/financials.ts) | `/api/v1/financials/*` | |
| [`services/invoices.ts`](../frontend/src/services/invoices.ts) | `/api/v1/invoices/*` | |
| [`services/sms.ts`](../frontend/src/services/sms.ts) | `/api/v1/sms/*` | |
| [`services/persons.ts`](../frontend/src/services/persons.ts) | `/api/v1/persons/*` | |
| [`services/contacts.ts`](../frontend/src/services/contacts.ts) | `/api/v1/contacts/*` | unified search |
| [`services/judges.ts`](../frontend/src/services/judges.ts) | `/api/v1/judges/*` | |
| [`services/templates.ts`](../frontend/src/services/templates.ts) | `/api/v1/templates/*` and `/rfp/*` | |
| [`services/users.ts`](../frontend/src/services/users.ts) | `/api/v1/users`, `/api/v1/attorneys` | |
| [`services/comments.ts`](../frontend/src/services/comments.ts) | `/api/v1/comments/{entity}/*` | polymorphic comments |
| [`services/activity.ts`](../frontend/src/services/activity.ts) | `/api/v1/activity/*` + tracking | |

### Data tables — the canonical pattern

There is **no shared `<DataTable>` wrapper**. Every table has unique toolbar/filters/state, so each page calls `useReactTable` inline and composes three shared helpers from `components/common/`:

- `DataTableColumnHeader` — sortable header with dropdown
- `DataTablePagination` — pagination controls
- `DataTableViewOptions` — column show/hide

The repeatable order for a new table page: **types → service → `columns.tsx` → feature components → `index.tsx` page**.

### Shared hooks

[`frontend/src/hooks/`](../frontend/src/hooks/): `useAuth`, `useTheme`, `useDebounce`, `useMobile` (breakpoint), `useSSE`, `useChatStream`, `useBreadcrumbLabel`, `usePageTracking`.

### Running it

```bash
cd frontend
npm install
npm run dev         # http://localhost:5173
npm run build       # production
npm run lint
npm run type-check
```

Vite proxies `/api/*` to backend per `PORT` env var. See [`frontend/vite.config.ts`](../frontend/vite.config.ts).

### MCP servers for UI work

[`CLAUDE.md`](../CLAUDE.md) says: when writing new UI, use the **shadcn MCP** to look up component props (don't guess) and use **Context7** for current library docs. Run `npx shadcn@latest add <component>` to install new shadcn components rather than hand-rolling them.

---

## 11. Operations: Deploy, Scripts, Docs, Env Vars

### Deployment

[`Dockerfile`](../Dockerfile) — multi-stage build:

1. Node stage builds the React app into `frontend/dist/`.
2. Python stage installs deps and copies all backend files **explicitly** (no wildcard).

Production `CMD` runs `alembic upgrade head && gunicorn main:app -k uvicorn.workers.UvicornWorker -w 1 -b 0.0.0.0:8000 --timeout 120`.

- `-w 1` — single worker because OAuth state in [`mcp_auth.py`](../mcp_auth.py) is in-memory.
- `--timeout 120` — long enough for PDF generation.

**🚨 The Dockerfile COPY hazard (re-read this).** Add every new root-level `.py` file or package directory to the COPY lines. Missing this = `ModuleNotFoundError` in production. See "Dockerfile - CRITICAL" in [`CLAUDE.md`](../CLAUDE.md).

### Production health check

```bash
curl https://galipo.coopermayne.com/api/v1/health
```

Returns `status`, `db.connected`, `alembic_revision`, `git_commit`, `uptime_seconds`. Compare `alembic_revision` to your local `alembic current` to confirm prod has the latest migrations. Compare `git_commit` to confirm the deployed code version.

### Scripts

| Script | Purpose |
|---|---|
| [`scripts/backup.sh`](../scripts/backup.sh) | Full schema+data backup, gzipped, into `backups/` |
| [`scripts/backup_db.sh`](../scripts/backup_db.sh) | Alternative backup |
| [`scripts/backup-data-only.sh`](../scripts/backup-data-only.sh) | Data only (for schema migrations) |
| [`scripts/restore.sh`](../scripts/restore.sh) | Restore from gzipped backup file |
| [`scripts/restore_db.sh`](../scripts/restore_db.sh) | Alternative restore |
| [`scripts/generate_schema_diagram.py`](../scripts/generate_schema_diagram.py) | Regenerates [`docs/SCHEMA.md`](SCHEMA.md) Mermaid ER diagram via SchemaCrawler (requires Docker) |
| [`scripts/seed_dev_data.py`](../scripts/seed_dev_data.py) | 25+ mock persons, 8 cases, judges, events, tasks |
| [`scripts/seed_dev_users.py`](../scripts/seed_dev_users.py) | Seeds firm users with standard dev password |
| [`scripts/seed_judges.py`](../scripts/seed_judges.py) | California federal district judges (Feb 2026 data) |
| [`scripts/seed_webhook_data.py`](../scripts/seed_webhook_data.py) | Bulk import CourtListener webhook CSV |
| [`scripts/analyze_chat_logs.py`](../scripts/analyze_chat_logs.py) | Cost/token analysis of chat logs |
| [`scripts/install-hooks.sh`](../scripts/install-hooks.sh) | Installs pre-commit and post-checkout hooks |
| [`scripts/setup-worktree.sh`](../scripts/setup-worktree.sh) | Sets up isolated `.env` + ports for a new git worktree |
| [`scripts/rollback_proceedings.sql`](../scripts/rollback_proceedings.sql) | One-shot SQL to drop the proceedings feature if needed |
| [`scripts/hooks/`](../scripts/hooks/) | Git hook source (installed by `install-hooks.sh`) |

### Pre-commit hook

`install-hooks.sh` installs a **pre-commit hook** that, when [`models.py`](../models.py) / `alembic/` / `db/connection.py` change, regenerates the schema diagram into [`docs/SCHEMA.md`](SCHEMA.md) and stages it alongside your migration. Requires Docker (uses the `schemacrawler/schemacrawler` image). This is dev-only — production doesn't need Docker.

A **post-checkout hook** runs `setup-worktree.sh` when switching branches in a git worktree (re-seeds `.env`, picks free ports).

### Docs

| File | Coverage |
|---|---|
| [`README.md`](../README.md) | Feature tour, tech stack, quick start, MCP tool overview, deployment notes |
| [`CLAUDE.md`](../CLAUDE.md) | **Conventions, gotchas, command reference. Treat as part of the spec.** |
| [`docs/SETUP.md`](SETUP.md) | Long-form dev setup + troubleshooting + Docker prod |
| [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) | Mermaid diagrams (high-level + component-level data flow) |
| [`docs/SCHEMA.md`](SCHEMA.md) | Auto-generated Mermaid ER diagram (don't hand-edit — pre-commit regenerates it) |
| [`docs/schema.sql`](schema.sql) | Raw DDL of the schema |
| [`docs/DISASTER-RECOVERY.md`](DISASTER-RECOVERY.md) | Backup strategy, restore procedures, recovery scenarios |
| [`docs/FLOWS.md`](FLOWS.md) | Major user workflows |
| [`docs/worker-prompts.md`](worker-prompts.md) | Prompts used by background AI workers |
| [`docs/ONBOARDING.md`](ONBOARDING.md) | This document. |

### Static & templates

- [`static/`](../static/) — legacy `app.js` / `styles.css` from the older vanilla-JS frontend. Still served by [`routes/static.py`](../routes/static.py) `/static/*` and `/legacy`. New work should not touch these.
- [`templates/`](../templates/) — Jinja2 templates for document generation. Subdirs: `exports/` (PDF reports), `pleadings/` (DOCX briefs), `rfp/` (RFP responses). Used by the [services/](../services/) generators.

### Environment variables

Full list in [`.env.example`](../.env.example) and the table in [`CLAUDE.md`](../CLAUDE.md). The essentials:

| Var | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `AUTH_USERNAME` / `AUTH_PASSWORD` | yes | Legacy single-user web auth (also fallback) |
| `JWT_SECRET` | prod | Stable across deploys or every user gets logged out |
| `PORT` | no (8000) | Backend port |
| `VITE_PORT` | no (5173) | Vite dev port |
| `ANTHROPIC_API_KEY` | for AI | All Claude features |
| `CHAT_MODEL` | no | In-app chat model |
| `EXTRACTION_MODEL` | no (Haiku) | PDF/text extractors |
| `MCP_AUTH_PASSWORD` + `MCP_BASE_URL` | for hosted MCP | Enables OAuth on `/mcp` |
| `WEBHOOK_SECRET_COURTLISTENER` | for CL webhooks | Token in path |
| `MEDIA_DIR` | no | Uploaded SMS media |
| `RESET_DB` | dev only | `true` drops all tables on startup |
| `GOOGLE_SHEETS_*` | for intake sync | Service-account creds + spreadsheet ID |
| `TWILIO_*` | for SMS | Account SID, auth token, phone |

**Always load env vars with `set -a && source .env && set +a`.** Without `set -a` they live in the shell only — Python/Node won't see them and you'll silently hit the wrong DB.

---

## 12. Conventions & Gotchas Cheat Sheet

The ones that bite people most often:

1. **🚨 Dockerfile COPY** — every new root-level `.py` file or package = add a COPY line. Production crashes otherwise.
2. **Env loading** — `set -a && source .env && set +a`, never bare `source .env`.
3. **Datetime** — store UTC, display Pacific. **Never** bare `datetime.now()` or `datetime.utcnow()`. Use [`lib/tz.py`](../lib/tz.py) and the frontend [`lib/datetime.ts`](../frontend/src/lib/datetime.ts).
4. **`models.py` is the schema source of truth.** Edit it, then `alembic revision --autogenerate`, review, `alembic upgrade head`. Never modify a deployed migration.
5. **`schemas/` is the validation source of truth.** All enums live in [`schemas/common.py`](../schemas/common.py) — both REST and MCP use them.
6. **Auth is two systems.** [`auth.py`](../auth.py) for the web dashboard (JWT + DB sessions). [`mcp_auth.py`](../mcp_auth.py) for Claude Desktop / claude.ai (OAuth, in-memory state, hence `-w 1`).
7. **Frontend imports** — always `@/`, never `../../`. PascalCase exports in kebab-case files.
8. **Square corners** — no `rounded-*` on cards/tables/dialogs. Hard rule.
9. **Status colors** — `--success / --warning / --info / --purple`, not raw Tailwind colors.
10. **Reuse first** — check [`components/common/`](../frontend/src/components/common/) before building anything new. Promote feature components to `common/` the moment they're used twice.
11. **Routes register order matters** — static last, or the SPA catch-all eats `/api`.
12. **`_frontend_old/` is archived** — do not copy patterns from it unless told.
13. **`/dev` slash command** — use it to start/restart both servers cleanly during local dev.
14. **Don't `git push` unless explicitly told** — [`CLAUDE.md`](../CLAUDE.md) is firm on this; the team uses lazygit and reviews before pushing.
15. **`MCP_INSTRUCTIONS` in [`main.py`](../main.py)** — update it when you change MCP tools or enums; that's what Claude reads to know what's possible.

---

## 13. Onboarding Checklist / Recommended Reading Order

Work through this in order. Each step builds on the last.

**Day 1 — Get oriented:**

- [ ] Read [`README.md`](../README.md) end to end.
- [ ] Read [`CLAUDE.md`](../CLAUDE.md) end to end. This is the spec for conventions.
- [ ] Read [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) and look at the diagrams.
- [ ] Run the app locally (§3 of this doc). Click around the dashboard.
- [ ] Open [`docs/SCHEMA.md`](SCHEMA.md) and look at the ER diagram.

**Day 2 — Backend foundations:**

- [ ] Read [`main.py`](../main.py) top to bottom.
- [ ] Read [`config.py`](../config.py) — understand how env vars flow.
- [ ] Read [`models.py`](../models.py) — at least skim every model class.
- [ ] Pick one feature (e.g. tasks). Read [`db/tasks.py`](../db/tasks.py), [`routes/tasks.py`](../routes/tasks.py), and the task-related tools in [`tools.py`](../tools.py). Trace one request from the React UI to the DB and back.

**Day 3 — Schemas, auth, MCP:**

- [ ] Read [`schemas/common.py`](../schemas/common.py), then skim [`schemas/inputs.py`](../schemas/inputs.py) and [`schemas/outputs.py`](../schemas/outputs.py).
- [ ] Read [`auth.py`](../auth.py) — understand JWT + sessions.
- [ ] Skim [`mcp_auth.py`](../mcp_auth.py) — the OAuth flow.
- [ ] Skim the `MCP_INSTRUCTIONS` block in [`main.py`](../main.py).
- [ ] Try connecting Claude Desktop to [`mcp_stdio.py`](../mcp_stdio.py) and call a tool.

**Day 4 — Services:**

- [ ] Pick one extractor (e.g. [`services/intake_extractor.py`](../services/intake_extractor.py)) and one generator (e.g. [`services/pdf_generator.py`](../services/pdf_generator.py)). Read each one and follow what they do end-to-end.
- [ ] Read [`services/chat/modes.py`](../services/chat/modes.py) and [`services/chat/executor.py`](../services/chat/executor.py).

**Day 5 — Frontend:**

- [ ] Read [`frontend/src/main.tsx`](../frontend/src/main.tsx) and [`frontend/src/index.css`](../frontend/src/index.css).
- [ ] Skim [`frontend/src/components/common/`](../frontend/src/components/common/).
- [ ] Pick a page (e.g. [`frontend/src/pages/tasks/`](../frontend/src/pages/tasks/)). Read `index.tsx`, `columns.tsx`, and `components/`. Trace the data flow back to its service (`@/services/tasks`) and the API.
- [ ] Read [`frontend/src/lib/datetime.ts`](../frontend/src/lib/datetime.ts) and [`frontend/src/lib/api.ts`](../frontend/src/lib/api.ts).

**Day 6 — Operations:**

- [ ] Read [`Dockerfile`](../Dockerfile) and the "Dockerfile - CRITICAL" section of [`CLAUDE.md`](../CLAUDE.md).
- [ ] Read [`docs/DISASTER-RECOVERY.md`](DISASTER-RECOVERY.md).
- [ ] Run `./scripts/backup.sh` against your local DB and verify it succeeds.
- [ ] Run `./scripts/install-hooks.sh` to install the pre-commit hooks.
- [ ] `curl` the prod `/api/v1/health` and confirm what each field means.

**Week 2+ — Ship something:**

- [ ] Find a small bug or polish task. Add an Alembic migration, a route, a service function, and the matching React component end-to-end.
- [ ] Add an MCP tool variant — say, expand one of the `manage_*` actions — so you've touched [`tools.py`](../tools.py), [`schemas/inputs.py`](../schemas/inputs.py), and the `MCP_INSTRUCTIONS` block.

When something doesn't make sense, the conventions in [`CLAUDE.md`](../CLAUDE.md) almost always have the answer. If they don't, ask before guessing — the gotchas in this codebase are subtle enough that "looks right" is not the same as "is right."

Welcome aboard.
