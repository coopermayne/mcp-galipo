"""SQLAlchemy ORM event listeners for automatic side-effects.

Registers:
- after_insert on Intake: queues new intake IDs for background AI analysis
- after_commit on SessionLocal: spawns daemon threads to run analysis

Import this module from db/__init__.py to activate the listeners.
"""

import logging
import threading

from sqlalchemy import event
from sqlalchemy.orm import Session

from models import Intake
from .session import SessionLocal

logger = logging.getLogger(__name__)


@event.listens_for(Intake, "after_insert")
def _intake_after_insert(mapper, connection, target):
    """Stash the new intake's ID for post-commit analysis."""
    session = Session.object_session(target)
    if session is None:
        return
    pending = session.info.setdefault("_pending_analysis_ids", [])
    pending.append(target.id)


@event.listens_for(SessionLocal, "after_commit")
def _session_after_commit(session):
    """After commit, spawn background analysis for any newly inserted intakes."""
    pending = session.info.pop("_pending_analysis_ids", None)
    if not pending:
        return

    for intake_id in pending:
        logger.info("Auto-triggering AI analysis for new intake %d", intake_id)
        thread = threading.Thread(
            target=_run_analysis_in_thread,
            args=(intake_id,),
            daemon=True,
        )
        thread.start()


def _run_analysis_in_thread(intake_id: int) -> None:
    """Thread target: delegates to the consolidated analysis pipeline."""
    try:
        from services.intake_ai import run_background_analysis
        run_background_analysis(intake_id)
    except Exception:
        logger.exception("Failed to run background analysis for intake %d", intake_id)
