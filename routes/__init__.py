"""
Routes package for Legal Case Management API.

This module provides a unified entry point for registering all HTTP routes
on a FastMCP instance.

Route modules:
- static: Static file serving (React assets, legacy files, SPA routing)
- auth: Authentication (login, logout, verify)
- stats: Dashboard statistics and system constants
- cases: Case CRUD operations
- tasks: Task CRUD operations and reordering
- events: Event/calendar CRUD operations
- persons: Person/contact management and case assignments
- notes: Note CRUD operations
- activities: Activity/time tracking (placeholder)
"""

from .auth import register_auth_routes
from .stats import register_stats_routes
from .cases import register_case_routes
from .tasks import register_task_routes
from .events import register_event_routes
from .persons import register_person_routes
from .notes import register_note_routes
from .activities import register_activity_routes
from .proceedings import register_proceeding_routes
from .static import register_static_routes

# Re-export common utilities
from .common import api_error, DEFAULT_PAGE_SIZE


def register_routes(mcp):
    """
    Register all HTTP routes on the given FastMCP instance.

    Routes are registered in a specific order:
    1. API routes (auth, stats, domain-specific)
    2. Static file routes (must come after API routes)

    The SPA catch-all route in static.py must be registered last
    to avoid intercepting API requests.
    """
    # Register API routes first (order among these doesn't matter much)
    register_auth_routes(mcp)
    register_stats_routes(mcp)
    register_case_routes(mcp)
    register_task_routes(mcp)
    register_event_routes(mcp)
    register_person_routes(mcp)
    register_note_routes(mcp)
    register_activity_routes(mcp)
    register_proceeding_routes(mcp)

    # Register static/SPA routes last (catch-all must be last)
    register_static_routes(mcp)


__all__ = [
    "register_routes",
    "api_error",
    "DEFAULT_PAGE_SIZE",
    # Individual route registration functions
    "register_auth_routes",
    "register_stats_routes",
    "register_case_routes",
    "register_task_routes",
    "register_event_routes",
    "register_person_routes",
    "register_note_routes",
    "register_activity_routes",
    "register_proceeding_routes",
    "register_static_routes",
]
