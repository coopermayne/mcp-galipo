"""
MCP Server for Legal Case Management (Personal Injury Litigation)

A FastMCP server exposing tools to query and manage legal cases.
Uses PostgreSQL database for persistent storage.
"""

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import filelock
from fastmcp import FastMCP

import database as db
from tools import register_tools
from routes import register_routes
from mcp_auth import get_mcp_auth_provider


MCP_INSTRUCTIONS = """Legal Case Management System for personal injury law firms.

IMPORTANT: Call get_current_time at the start of any session to know the current date/time in Pacific Time.

TOOLS OVERVIEW:
- search(entity, ...) — universal search across cases, persons, events, tasks
- get_details(entity, id) — full details for any entity by ID
- manage_case(action, ...) — create/update/delete cases
- manage_person(action, ...) — create/update/delete persons (contacts)
- manage_case_role(action, ...) — assign/update/change/remove person roles on cases
- manage_event(action, ...) — create/update/delete calendar events
- manage_task(action, ...) — create/update/delete/bulk_update tasks
- manage_note(action, ...) — create/update/delete case notes
- manage_proceeding(action, ...) — create/update/delete proceedings + add/remove judges
- manage_activity(action, ...) — create/update/delete activity log entries
- list_attorneys() — list active attorneys (for case assignment)
- import_case(data) — bulk import a complete case with all related data

VALID VALUES (these are enforced — invalid values return an error with the valid options):
- Case status: "Signing Up", "Prospective", "Pre-Filing", "Pleadings", "Discovery", "Expert Discovery", "Pre-trial", "Trial", "Post-Trial", "Appeal", "Settl. Pend.", "Stayed", "Closed"
- Task status: "Pending", "Active", "Done", "Partially Done", "Blocked", "Awaiting Atty Review"
- Urgency: "Low", "Medium", "High", "Urgent"
- Activity type: "Meeting", "Filing", "Research", "Drafting", "Document Review", "Phone Call", "Email", "Court Appearance", "Deposition", "Other"
- Judge roles: "Judge", "Magistrate Judge", "Presiding", "Panel"

ROLES SYSTEM (unified person-role management):
Persons are assigned to cases via manage_case_role with role names (accepts both snake_case and space-separated):
- client: plaintiff, contact, guardian_ad_litem, decedent
- counsel: co_counsel, referring_attorney, opposing_counsel, criminal_defense_attorney, prosecutor, public_defender
- defendant: municipality_defendant, individual_defendant
- expert: plaintiff_expert, defense_expert
- mediator: mediator
- other: lien_holder, witness, claims_adjuster, special_needs_consultant

JUDGES (standalone entities):
Judges are NOT persons — they are assigned to proceedings, not cases.
- Use manage_proceeding(action="add_judge", proceeding_id=N, judge_id=M, judge_role="Judge")

PROCEEDINGS WORKFLOW:
1. Create proceeding: manage_proceeding(action="create", case_id=N, case_number="24STCV12345", jurisdiction_id=M)
2. Add judges: manage_proceeding(action="add_judge", proceeding_id=N, judge_id=M, judge_role="Judge")

DATA ENTRY GUIDELINES:
- Skip vacated, canceled, or stricken events/deadlines — do not add these
- Use the calculation_note field for deadline sources (e.g., "Dkt. 47, LR 7-3")
- For depositions, include the deponent name in the event description"""


def initialize_database():
    """Initialize database with migrations and seeding.

    Called once per deployment, protected by file lock for multi-worker safety.
    """
    # Use file lock so only one worker initializes the database
    lock = filelock.FileLock("/tmp/galipo_init.lock", timeout=60)

    with lock:
        init_marker = "/tmp/galipo_initialized"

        # Check if already initialized in this deployment
        if os.path.exists(init_marker):
            print("Database already initialized by another worker, skipping.")
            return

        # Initialize database on startup
        # Only drop/recreate tables if RESET_DB=true (for development/testing)
        if os.environ.get("RESET_DB", "").lower() == "true":
            print("RESET_DB=true: Dropping and recreating all tables...")
            db.drop_all_tables()
            db.init_db()
            db.seed_db()
        else:
            # Run migrations first (handles schema upgrades for existing databases)
            db.migrate_db()
            # Then ensure all tables exist (safe for production)
            db.init_db()
            # Seed lookup tables (idempotent - only inserts if empty)
            db.seed_db()

        # Mark as initialized
        with open(init_marker, "w") as f:
            f.write("initialized")
        print("Database initialization complete.")


@asynccontextmanager
async def lifespan(server: FastMCP) -> AsyncIterator[dict]:
    """Application lifespan handler.

    Initializes database on startup, cleans up on shutdown.
    Safe for multi-worker deployments (uses file lock).
    """
    # Startup
    initialize_database()
    yield {}
    # Shutdown - connection pool cleanup is handled by atexit in db/connection.py


# Initialize the MCP server with lifespan and optional auth
auth_provider = get_mcp_auth_provider()
mcp = FastMCP(
    "Legal Case Management",
    instructions=MCP_INSTRUCTIONS,
    auth=auth_provider,
    lifespan=lifespan,
)

# Register MCP tools (for AI/Claude integration)
register_tools(mcp)

# Register HTTP routes (for web UI)
# Routes are organized in the routes/ package with domain-specific modules:
# - routes/auth.py: Authentication endpoints
# - routes/cases.py: Case CRUD operations
# - routes/tasks.py: Task management
# - routes/events.py: Calendar events
# - routes/persons.py: Contact management
# - routes/notes.py: Case notes
# - routes/stats.py: Dashboard stats and constants
# - routes/static.py: Static file serving and SPA routing
register_routes(mcp)

# Export ASGI app for uvicorn/gunicorn
# Streamable HTTP uses regular HTTP POST/GET instead of persistent SSE connections,
# which works reliably through proxies and CDNs without timeout/disconnect issues.
app = mcp.http_app(transport="streamable-http")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    mcp.run(transport="streamable-http", host="0.0.0.0", port=port)
