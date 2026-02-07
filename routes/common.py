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


def pydantic_error(exc) -> JSONResponse:
    """Create a structured 422 response from a Pydantic ValidationError.

    Returns field names, what was wrong, what was provided, and valid values
    so that both the frontend and AI callers get actionable feedback.
    """
    details = []
    for err in exc.errors():
        field = ".".join(str(loc) for loc in err["loc"])
        detail = {"field": field, "message": err["msg"], "input": err.get("input")}
        if err.get("ctx", {}).get("expected"):
            detail["valid_values"] = err["ctx"]["expected"]
        details.append(detail)
    # Build a single-line summary for quick reading
    summary = "; ".join(f"{d['field']}: {d['message']}" for d in details)
    return JSONResponse(
        {"success": False, "error": {"message": summary, "code": "VALIDATION_ERROR", "details": details}},
        status_code=422,
    )
