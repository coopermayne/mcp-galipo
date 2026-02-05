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

IMPORTANT: Call the get_current_time tool at the start of any session to know the current date and time in Pacific Time (Los Angeles). This is essential for creating events, tasks, or deadlines with correct dates.

This server provides tools to manage cases, tasks, events, contacts, and notes.

ROLES SYSTEM (unified person-role management):
Persons are assigned to cases with roles from these categories:
- client: "Client"
- internal_team: "Lead Attorney", "Co-Counsel", "Paralegal", "Case Manager"
- opposing_team: "Defendant", "Defense Counsel", "Defense Paralegal", "Defense Expert"
- third_party: "Plaintiff Expert", "Mediator", "Witness", "Lien Holder", "Court Reporter", "Interpreter", "Process Server"

JUDGES (standalone entities):
Judges are NOT persons - they are standalone entities assigned to proceedings.
- Create judges with create_judge(name, jurisdiction_id, ...)
- Assign to proceedings with add_judge_to_proceeding(proceeding_id, judge_id, role)
- Judge roles: "Judge", "Magistrate Judge", "Presiding", "Panel"

JURISDICTIONS & PROCEEDINGS WORKFLOW:
1. Call list_jurisdictions() to see existing courts
2. If the court exists, note its jurisdiction_id
3. If not, call manage_jurisdiction(name="USDC - Central District") to create it
4. Call add_proceeding(case_id, case_number, jurisdiction_id) to link the case to the court
5. Call add_judge_to_proceeding() to assign judges to the proceeding

DATA ENTRY GUIDELINES:
- Skip vacated, canceled, or stricken events/deadlines - do not add these to the system
- When entering deadlines from docket sheets, use the calculation_note field to store the source (e.g., "Dkt. 47, LR 7-3")
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
