"""Trial calendar data: cases with trial dates + blocking events."""

import datetime
from sqlalchemy import select, literal_column

from models import Case, Event
from .session import SessionLocal


def _add_months(d: datetime.date, months: int) -> datetime.date:
    """Add/subtract months from a date, clamping day to month end."""
    month = d.month - 1 + months
    year = d.year + month // 12
    month = month % 12 + 1
    import calendar
    day = min(d.day, calendar.monthrange(year, month)[1])
    return datetime.date(year, month, day)


def get_trial_calendar(months_ahead: int = 6, months_behind: int = 1) -> dict:
    """Get trial calendar data: trials and blocking events within a date range."""
    today = datetime.date.today()
    range_start = _add_months(today, -months_behind)
    range_end = _add_months(today, months_ahead)

    with SessionLocal() as session:
        jurisdiction_sq = literal_column("""(
            SELECT j.name FROM proceedings p
            JOIN jurisdictions j ON p.jurisdiction_id = j.id
            WHERE p.case_id = cases.id AND p.is_primary = true LIMIT 1
        )""").label("jurisdiction_name")

        trial_stmt = (
            select(
                Case.id.label("case_id"),
                Case.case_name,
                Case.short_name,
                Case.color,
                Case.status,
                Case.trial_date,
                Case.trial_estimated_days,
                Case.trial_likelihood,
                Case.attorney_ids,
                jurisdiction_sq,
            )
            .where(
                Case.trial_date.isnot(None),
                Case.status != "Closed",
                Case.trial_date >= range_start,
                Case.trial_date <= range_end,
            )
            .order_by(Case.trial_date)
        )
        trial_rows = session.execute(trial_stmt).fetchall()

        trials = []
        for r in trial_rows:
            trials.append({
                "case_id": r.case_id,
                "case_name": r.case_name,
                "short_name": r.short_name,
                "color": r.color,
                "status": r.status,
                "trial_date": r.trial_date.isoformat() if r.trial_date else None,
                "trial_estimated_days": r.trial_estimated_days,
                "trial_likelihood": r.trial_likelihood,
                "attorney_ids": r.attorney_ids or [],
                "jurisdiction_name": r.jurisdiction_name,
            })

        event_stmt = (
            select(Event)
            .where(
                Event.event_type.isnot(None),
                Event.date >= range_start,
                Event.date <= range_end,
            )
            .order_by(Event.date)
        )
        events = session.execute(event_stmt).scalars().all()

        blocking_events = []
        for e in events:
            blocking_events.append({
                "id": e.id,
                "event_type": e.event_type,
                "description": e.description,
                "date": e.date.isoformat() if e.date else None,
                "end_date": e.end_date.isoformat() if e.end_date else None,
                "case_id": e.case_id,
            })

    return {
        "trials": trials,
        "blocking_events": blocking_events,
        "range": {
            "start": range_start.isoformat(),
            "end": range_end.isoformat(),
        },
    }
