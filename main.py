"""
MCP Server for Legal Case Management (Personal Injury Litigation)

A FastMCP server exposing tools to query and manage legal cases.
Uses PostgreSQL database for persistent storage.
"""

import os
from fastmcp import FastMCP

import database as db
from tools import register_tools
from routes import register_routes

# Initialize the MCP server
mcp = FastMCP("Legal Case Management")

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


if __name__ == "__main__":
    # Run the MCP server with SSE transport for remote access
    port = int(os.environ.get("PORT", 8000))
    mcp.run(transport="sse", host="0.0.0.0", port=port)
