"""
Galipo intake system: Starlette app serving the REST API and the React UI.

Uses PostgreSQL for persistent storage.
"""

import asyncio
import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import filelock
from starlette.applications import Starlette
from starlette.routing import Route

import db
from config import settings
from routes import register_routes

logger = logging.getLogger(__name__)


class RouteCollector:
    """Collects routes registered with @router.custom_route(path, methods=[...]).

    Route modules were written against FastMCP's custom_route decorator; this
    keeps that shape so they register onto a plain Starlette app.
    """

    def __init__(self) -> None:
        self.routes: list[Route] = []

    def custom_route(self, path: str, methods: list[str]):
        def decorator(fn):
            self.routes.append(Route(path, fn, methods=methods))
            return fn

        return decorator


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
        if settings.reset_db:
            print("RESET_DB=true: Dropping and recreating all tables...")
            db.drop_all_tables()
            db.init_db()
            db.seed_db()
        else:
            # Ensure all tables exist (safe for production — Alembic handles migrations)
            db.init_db()
            # Seed lookup tables (idempotent - only inserts if empty)
            db.seed_db()

        # Ensure media directory exists
        from pathlib import Path
        Path(settings.media_dir).mkdir(parents=True, exist_ok=True)

        # Mark as initialized
        with open(init_marker, "w") as f:
            f.write("initialized")
        print("Database initialization complete.")


INTAKE_SYNC_INTERVAL = 5 * 60  # 5 minutes


async def _periodic_intake_sync():
    """Background task: sync intakes from Google Sheets every 5 minutes."""
    from routes.sse import broadcast

    while True:
        await asyncio.sleep(INTAKE_SYNC_INTERVAL)
        try:
            from services.google_sheets import fetch_all_rows

            rows = await asyncio.to_thread(fetch_all_rows)
            result = await asyncio.to_thread(db.sync_from_sheet, rows)
            imported = result.get("imported", 0)
            if imported > 0:
                logger.info("Auto-sync: imported %d new intake(s)", imported)
                broadcast({"entity": "intake", "action": "synced", "id": None, "intake_id": None, "user_id": 0})
            else:
                logger.debug("Auto-sync: no new intakes")
        except Exception:
            logger.exception("Auto-sync intake failed")


@asynccontextmanager
async def lifespan(app: Starlette) -> AsyncIterator[None]:
    """Application lifespan handler.

    Initializes database on startup, cleans up on shutdown.
    Safe for multi-worker deployments (uses file lock).
    """
    # Startup
    initialize_database()
    sync_task = asyncio.create_task(_periodic_intake_sync())
    yield
    # Shutdown
    sync_task.cancel()
    try:
        await sync_task
    except asyncio.CancelledError:
        pass


router = RouteCollector()
register_routes(router)

app = Starlette(routes=router.routes, lifespan=lifespan)

# Global exception handlers for clean JSON error responses
from starlette.requests import Request
from starlette.responses import JSONResponse as StarletteJSONResponse
from db.validation import ValidationError


async def _validation_error_handler(request: Request, exc: ValidationError):
    return StarletteJSONResponse(
        {"success": False, "error": {"message": str(exc), "code": "VALIDATION_ERROR"}},
        status_code=422,
    )


async def _value_error_handler(request: Request, exc: ValueError):
    return StarletteJSONResponse(
        {"success": False, "error": {"message": str(exc), "code": "INVALID_PARAM"}},
        status_code=422,
    )


app.add_exception_handler(ValidationError, _validation_error_handler)
app.add_exception_handler(ValueError, _value_error_handler)

# Redirect trailing slashes (e.g., /api/v1/cases/ → /api/v1/cases)
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import RedirectResponse


class TrailingSlashMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        path = request.scope["path"]
        if path != "/" and path.endswith("/"):
            new_path = path.rstrip("/")
            if request.scope["query_string"]:
                new_path += "?" + request.scope["query_string"].decode()
            return RedirectResponse(url=new_path, status_code=307)
        return await call_next(request)


app.add_middleware(TrailingSlashMiddleware)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=settings.port)
