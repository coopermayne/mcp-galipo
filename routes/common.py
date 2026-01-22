"""
Common utilities for route modules.

Shared constants, error helpers, and path configurations.
"""

from pathlib import Path
from fastapi.responses import JSONResponse

# Static directories for both frontends
STATIC_DIR = Path(__file__).parent.parent / "static"  # Legacy vanilla JS
TEMPLATES_DIR = Path(__file__).parent.parent / "templates"  # Legacy templates
REACT_DIST_DIR = Path(__file__).parent.parent / "frontend" / "dist"  # React build output
REACT_ASSETS_DIR = REACT_DIST_DIR / "assets"

DEFAULT_PAGE_SIZE = 50


def api_error(message: str, code: str, status_code: int = 400):
    """Create a standardized API error response."""
    return JSONResponse(
        {"success": False, "error": {"message": message, "code": code}},
        status_code=status_code
    )
