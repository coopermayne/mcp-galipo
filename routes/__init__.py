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
- chat: AI chat with Claude integration
"""

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

# Set up logging to a rotating file so it can never run away again.
# IMPORTANT: keep the root logger at INFO. Setting the root logger to DEBUG
# funnels every third-party library's DEBUG output into this file — the
# `docket.worker` scheduler and `fakeredis` poll in tight loops and previously
# grew this file to ~10 GB. Only our own "routes.*" loggers run at DEBUG.
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
for _noisy in ("docket", "fakeredis", "mcp.server", "googleapiclient"):
    logging.getLogger(_noisy).setLevel(logging.WARNING)

_logger = logging.getLogger("routes")
# Keep our own route logging verbose without dragging in library DEBUG noise.
_logger.setLevel(logging.DEBUG)

from .auth import register_auth_routes
from .stats import register_stats_routes
from .cases import register_case_routes
from .tasks import register_task_routes
from .events import register_event_routes
from .persons import register_person_routes
from .roles import register_role_routes
from .judges import register_judge_routes
from .notes import register_note_routes
from .proceedings import register_proceeding_routes
from .chat import register_chat_routes
from .export import register_export_routes
from .webhooks import register_webhook_routes
from .users import register_user_routes
from .templates import register_template_routes
from .objections import register_objection_routes
from .rfp import register_rfp_routes
from .sse import register_sse_routes
from .intakes import register_intake_routes
from .financials import register_financial_routes
from .payees import register_payee_routes
from .invoices import register_invoice_routes
from .liens import register_lien_routes
from .health import register_health_routes
from .activity import register_activity_routes
from .worklog import register_worklog_routes
from .contacts import register_contact_routes
from .comments import register_comment_routes
from .checklist import register_checklist_routes
from .trial_calendar import register_trial_calendar_routes
from .dale import register_dale_routes
from .alerts import register_alert_routes
from .quickcreate import register_quickcreate_routes
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
    _logger.info("Starting route registration...")

    # Register API routes first (order among these doesn't matter much)
    _logger.debug("Registering auth routes...")
    register_auth_routes(mcp)
    _logger.debug("Registering stats routes...")
    register_stats_routes(mcp)
    _logger.debug("Registering case routes...")
    register_case_routes(mcp)
    _logger.debug("Registering task routes...")
    register_task_routes(mcp)
    _logger.debug("Registering event routes...")
    register_event_routes(mcp)
    _logger.debug("Registering person routes...")
    register_person_routes(mcp)
    _logger.debug("Registering role routes...")
    register_role_routes(mcp)
    _logger.debug("Registering judge routes...")
    register_judge_routes(mcp)
    _logger.debug("Registering note routes...")
    register_note_routes(mcp)
    _logger.debug("Registering proceeding routes...")
    register_proceeding_routes(mcp)
    _logger.debug("Registering chat routes...")
    register_chat_routes(mcp)
    _logger.debug("Chat routes registered successfully!")
    _logger.debug("Registering export routes...")
    register_export_routes(mcp)
    _logger.debug("Registering webhook routes...")
    register_webhook_routes(mcp)
    _logger.debug("Registering user routes...")
    register_user_routes(mcp)
    _logger.debug("Registering template routes...")
    register_template_routes(mcp)
    _logger.debug("Registering objection routes...")
    register_objection_routes(mcp)
    _logger.debug("Registering RFP routes...")
    register_rfp_routes(mcp)
    _logger.debug("Registering SSE routes...")
    register_sse_routes(mcp)
    _logger.debug("Registering intake routes...")
    register_intake_routes(mcp)
    _logger.debug("Registering financial routes...")
    register_financial_routes(mcp)
    _logger.debug("Registering payee routes...")
    register_payee_routes(mcp)
    _logger.debug("Registering invoice routes...")
    register_invoice_routes(mcp)
    _logger.debug("Registering lien routes...")
    register_lien_routes(mcp)
    _logger.debug("Registering health routes...")
    register_health_routes(mcp)
    _logger.debug("Registering activity routes...")
    register_activity_routes(mcp)
    _logger.debug("Registering worklog routes...")
    register_worklog_routes(mcp)
    _logger.debug("Registering contact routes...")
    register_contact_routes(mcp)
    _logger.debug("Registering comment routes...")
    register_comment_routes(mcp)
    _logger.debug("Registering checklist routes...")
    register_checklist_routes(mcp)
    _logger.debug("Registering trial calendar routes...")
    register_trial_calendar_routes(mcp)
    _logger.debug("Registering Dale routes...")
    register_dale_routes(mcp)
    _logger.debug("Registering alert routes...")
    register_alert_routes(mcp)
    _logger.debug("Registering quick-create routes...")
    register_quickcreate_routes(mcp)

    # Register static/SPA routes last (catch-all must be last)
    _logger.debug("Registering static routes...")
    register_static_routes(mcp)
    _logger.info("All routes registered successfully!")


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
    "register_proceeding_routes",
    "register_chat_routes",
    "register_export_routes",
    "register_webhook_routes",
    "register_user_routes",
    "register_template_routes",
    "register_objection_routes",
    "register_rfp_routes",
    "register_sse_routes",
    "register_intake_routes",
    "register_financial_routes",
    "register_payee_routes",
    "register_invoice_routes",
    "register_lien_routes",
    "register_activity_routes",
    "register_worklog_routes",
    "register_quickcreate_routes",
    "register_static_routes",
]
