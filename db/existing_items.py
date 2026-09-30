"""
A case's existing tasks/events, for AI duplicate checks.

Every AI entry point that creates a task or event (the MCP ``manage_task`` /
``manage_event`` tools — used by Claude Desktop and the in-app chat — and the
quick-create dialog) hands the model the case's existing items and lets *it*
decide whether the new one is really an existing item (e.g. a rescheduled
deposition). No string matching happens here: one case's worth of items is
small enough to give the model directly, and it judges "Mediation (continued)"
vs "Mediation with Judge Lee" far better than a fuzzy matcher.

This module only fetches the items and diffs fields once the model has picked
a match.
"""

import datetime

from sqlalchemy import select

from .session import SessionLocal
from models import Event, Task
from lib.tz import today_la


# Past events this recent are still candidates — a hearing that was just
# continued is usually a few days in the past.
EVENT_LOOKBACK_DAYS = 30


def _norm(val):
    """Comparable form of a field value (dates/times as strings, blanks as None)."""
    if isinstance(val, datetime.date):
        return val.isoformat()
    if isinstance(val, datetime.time):
        return val.strftime("%H:%M")
    if isinstance(val, str):
        val = val.strip()
        if len(val) == 8 and val[2] == ":" and val[5] == ":":  # HH:MM:SS
            val = val[:5]
        return val or None
    return val


def existing_events(case_id: int) -> list[dict]:
    """The case's events from EVENT_LOOKBACK_DAYS ago onward, compact."""
    floor = today_la() - datetime.timedelta(days=EVENT_LOOKBACK_DAYS)
    with SessionLocal() as session:
        events = session.scalars(
            select(Event)
            .where(Event.case_id == case_id, Event.date >= floor)
            .order_by(Event.date)
        ).all()
        return [
            {
                "id": e.id,
                "description": e.description,
                "date": _norm(e.date),
                "time": _norm(e.time),
                "location": e.location,
                "end_date": _norm(e.end_date),
                "event_type": e.event_type,
            }
            for e in events
        ]


def existing_tasks(case_id: int | None = None, intake_id: int | None = None) -> list[dict]:
    """The case's (or intake's) open — not Done — tasks, compact."""
    if case_id is None and intake_id is None:
        return []
    with SessionLocal() as session:
        stmt = select(Task).where(Task.status != "Done")
        if case_id is not None:
            stmt = stmt.where(Task.case_id == case_id)
        else:
            stmt = stmt.where(Task.intake_id == intake_id)
        tasks = session.scalars(stmt.order_by(Task.due_date.nulls_last())).all()
        return [
            {
                "id": t.id,
                "description": t.description,
                "due_date": _norm(t.due_date),
                "urgency": t.urgency,
                "assignee_id": t.assignee_id,
                "status": t.status,
            }
            for t in tasks
        ]


def field_differences(existing: dict, new: dict) -> dict:
    """``{field: {"existing", "new"}}`` for fields the caller supplied that differ.

    A field left out (None) is never a difference — "Depo of X" with no time
    does not conflict with the stored 10:00.
    """
    diffs = {}
    for field, new_val in new.items():
        new_val = _norm(new_val)
        if new_val is None:
            continue
        old_val = _norm(existing.get(field))
        if isinstance(new_val, str) and isinstance(old_val, str):
            if new_val.lower() == old_val.lower():
                continue
        elif new_val == old_val:
            continue
        diffs[field] = {"existing": old_val, "new": new_val}
    return diffs


def match_summary(existing: dict, new: dict) -> dict:
    """An existing item the model matched, annotated with what would change."""
    diffs = field_differences(existing, new)
    return {
        **existing,
        "match": "differs" if diffs else "duplicate",
        "differences": diffs,
    }
