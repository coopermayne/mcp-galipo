"""
Routes package for the Galipo intake API.

Route modules:
- auth: Authentication (login, logout, verify, change password)
- users: User admin and staff list
- sse: Server-sent events for live updates
- export: Intake PDF exports
- intakes: Intake CRUD, comments, AI analysis, Google Sheets sync
- tasks: Task CRUD and reordering
- comments: Task comment threads
- chat: AI chat (intake creation, task creation)
- health: Health check
- static: React app and SPA routing
"""

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

# Set up logging to a rotating file so it can never run away again.
# IMPORTANT: keep the root logger at INFO. Setting the root logger to DEBUG
# funnels every third-party library's DEBUG output into this file (a polling
# scheduler once grew it to ~10 GB). Only our own "routes.*" loggers run at DEBUG.
_log_file = Path(__file__).parent.parent / "logs" / "routes_debug.log"
_log_file.parent.mkdir(exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        RotatingFileHandler(_log_file, maxBytes=10 * 1024 * 1024, backupCount=3),
        logging.StreamHandler()
    ]
)

# Quiet known-chatty third-party loggers regardless of root level.
for _noisy in ("googleapiclient",):
    logging.getLogger(_noisy).setLevel(logging.WARNING)

_logger = logging.getLogger("routes")
# Keep our own route logging verbose without dragging in library DEBUG noise.
_logger.setLevel(logging.DEBUG)

from .auth import register_auth_routes
from .users import register_user_routes
from .sse import register_sse_routes
from .export import register_export_routes
from .intakes import register_intake_routes
from .tasks import register_task_routes
from .comments import register_comment_routes
from .chat import register_chat_routes
from .health import register_health_routes
from .static import register_static_routes

# Re-export common utilities
from .common import api_error, DEFAULT_PAGE_SIZE


def register_routes(router):
    """
    Register all HTTP routes on the given RouteCollector.

    Static routes register last: the SPA catch-all in static.py would
    otherwise shadow every /api/v1/* route. Intake exports register before
    intake routes so /api/v1/intakes/export isn't read as an intake id.
    """
    _logger.info("Starting route registration...")

    register_auth_routes(router)
    register_user_routes(router)
    register_sse_routes(router)
    register_export_routes(router)
    register_intake_routes(router)
    register_task_routes(router)
    register_comment_routes(router)
    register_chat_routes(router)
    register_health_routes(router)

    # Register static/SPA routes last (catch-all must be last)
    register_static_routes(router)
    _logger.info("All routes registered successfully!")


__all__ = [
    "register_routes",
    "api_error",
    "DEFAULT_PAGE_SIZE",
]
