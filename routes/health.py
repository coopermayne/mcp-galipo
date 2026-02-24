"""
Health check endpoint.

Returns server status including Alembic migration revision, git commit,
database connectivity, and uptime. No authentication required.
"""

import time
from fastapi.responses import JSONResponse
from sqlalchemy import text

from db.session import SessionLocal

_start_time = time.time()


def _get_alembic_revision() -> str | None:
    """Read the current Alembic revision from the database."""
    try:
        with SessionLocal() as session:
            row = session.execute(text("SELECT version_num FROM alembic_version")).fetchone()
            return row[0] if row else None
    except Exception as e:
        return f"error: {e}"


def _get_git_commit() -> str | None:
    """Read the git commit from the GIT_COMMIT env var or .git/HEAD."""
    import os

    # Fly.io / Docker can set this at build time
    commit = os.environ.get("GIT_COMMIT")
    if commit:
        return commit

    # Try reading from .git (works in local dev)
    try:
        head = open(".git/HEAD").read().strip()
        if head.startswith("ref:"):
            ref_path = ".git/" + head.split(" ", 1)[1]
            return open(ref_path).read().strip()[:12]
        return head[:12]
    except Exception:
        return None


def _check_db() -> tuple[bool, str]:
    """Check database connectivity."""
    try:
        with SessionLocal() as session:
            session.execute(text("SELECT 1"))
        return True, "ok"
    except Exception as e:
        return False, str(e)


def register_health_routes(mcp):
    """Register health check routes."""

    @mcp.custom_route("/api/v1/health", methods=["GET"])
    async def api_health(request):
        db_ok, db_msg = _check_db()
        revision = _get_alembic_revision()
        uptime_seconds = int(time.time() - _start_time)

        status = "healthy" if db_ok else "unhealthy"
        code = 200 if db_ok else 503

        return JSONResponse(
            {
                "status": status,
                "db": {"connected": db_ok, "message": db_msg},
                "alembic_revision": revision,
                "git_commit": _get_git_commit(),
                "uptime_seconds": uptime_seconds,
            },
            status_code=code,
        )
