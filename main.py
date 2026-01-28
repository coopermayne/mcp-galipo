"""
MCP Server for Legal Case Management (Personal Injury Litigation)

A FastMCP server exposing tools to query and manage legal cases.
Uses PostgreSQL database for persistent storage.
"""

import os
from contextlib import asynccontextmanager

import filelock
from fastmcp import FastMCP

import database as db
from tools import register_tools
from routes import register_routes


MCP_INSTRUCTIONS = """Legal Case Management System for personal injury law firms.

IMPORTANT: Call the get_current_time tool at the start of any session to know the current date and time in Pacific Time (Los Angeles). This is essential for creating events, tasks, or deadlines with correct dates.

This server provides tools to manage cases, tasks, events, contacts, and notes."""


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
async def lifespan(app):
    """Application lifespan handler.

    Initializes database on startup, cleans up on shutdown.
    Safe for multi-worker deployments (uses file lock).
    """
    # Startup
    initialize_database()
    yield
    # Shutdown - connection pool cleanup is handled by atexit in db/connection.py


# Initialize the MCP server with lifespan
mcp = FastMCP("Legal Case Management", instructions=MCP_INSTRUCTIONS)

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
# Get the FastAPI app and add lifespan
app = mcp.http_app()
app.router.lifespan_context = lifespan

if __name__ == "__main__":
    # Run the MCP server with SSE transport for remote access
    port = int(os.environ.get("PORT", 8000))
    mcp.run(transport="sse", host="0.0.0.0", port=port)
