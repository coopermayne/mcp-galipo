"""
REST API Routes for Legal Case Management Frontend

DEPRECATED: This module is a backwards-compatibility shim.
Routes have been refactored into the routes/ package.

New code should import from the routes package directly:
    from routes import register_routes
"""

# Re-export everything from the new routes package for backwards compatibility
from routes import (
    register_routes,
    api_error,
    DEFAULT_PAGE_SIZE,
    register_auth_routes,
    register_stats_routes,
    register_case_routes,
    register_task_routes,
    register_event_routes,
    register_person_routes,
    register_note_routes,
    register_activity_routes,
    register_static_routes,
)

# Also expose path constants for any code that might depend on them
from routes.common import (
    STATIC_DIR,
    TEMPLATES_DIR,
    REACT_DIST_DIR,
    REACT_ASSETS_DIR,
)

__all__ = [
    "register_routes",
    "api_error",
    "DEFAULT_PAGE_SIZE",
    "STATIC_DIR",
    "TEMPLATES_DIR",
    "REACT_DIST_DIR",
    "REACT_ASSETS_DIR",
    "register_auth_routes",
    "register_stats_routes",
    "register_case_routes",
    "register_task_routes",
    "register_event_routes",
    "register_person_routes",
    "register_note_routes",
    "register_activity_routes",
    "register_static_routes",
]
