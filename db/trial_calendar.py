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
    range_start = _add_months(today, -months_behind) if months_behind > 0 else today
    range_end = _add_months(today, months_ahead)

    with SessionLocal() as session:
        jurisdiction_sq = literal_column("""(
            SELECT j.name FROM proceedings p
            JOIN jurisdictions j ON p.jurisdiction_id = j.id
            WHERE p.case_id = cases.id AND p.is_primary = true LIMIT 1
        )""").label("jurisdiction_name")

        case_number_sq = literal_column("""(
            SELECT p.case_number FROM proceedings p
            WHERE p.case_id = cases.id AND p.is_primary = true LIMIT 1
        )""").label("case_number")

        judge_names_sq = literal_column("""(
            SELECT string_agg(jg.name, ', ' ORDER BY pj.sort_order)
            FROM proceedings p
            JOIN proceeding_judges pj ON pj.proceeding_id = p.id
            JOIN judges jg ON jg.id = pj.judge_id
            WHERE p.case_id = cases.id AND p.is_primary = true
              AND COALESCE(pj.role, 'Judge') != 'Magistrate Judge'
        )""").label("judge_names")

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
                Case.trial_likelihood_note,
                Case.attorney_ids,
                jurisdiction_sq,
                case_number_sq,
                judge_names_sq,
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
                "trial_likelihood_note": r.trial_likelihood_note,
                "attorney_ids": r.attorney_ids or [],
                "jurisdiction_name": r.jurisdiction_name,
                "case_number": r.case_number,
                "judge_names": r.judge_names,
                "proposed": False,
            })

        proposed_stmt = (
            select(
                Case.id.label("case_id"),
                Case.case_name,
                Case.short_name,
                Case.color,
                Case.status,
                Case.trial_estimated_days,
                Case.trial_likelihood,
                Case.attorney_ids,
                Case.proposed_trial_dates,
                jurisdiction_sq,
                case_number_sq,
                judge_names_sq,
            )
            .where(
                Case.proposed_trial_dates.isnot(None),
                Case.status != "Closed",
            )
        )
        proposed_rows = session.execute(proposed_stmt).fetchall()

        for r in proposed_rows:
            for d in (r.proposed_trial_dates or []):
                if range_start <= d <= range_end:
                    trials.append({
                        "case_id": r.case_id,
                        "case_name": r.case_name,
                        "short_name": r.short_name,
                        "color": r.color,
                        "status": r.status,
                        "trial_date": d.isoformat(),
                        "trial_estimated_days": r.trial_estimated_days,
                        "trial_likelihood": r.trial_likelihood,
                        "attorney_ids": r.attorney_ids or [],
                        "jurisdiction_name": r.jurisdiction_name,
                        "case_number": r.case_number,
                        "judge_names": r.judge_names,
                        "proposed": True,
                    })

        trials.sort(key=lambda t: t["trial_date"] or "")

        event_stmt = (
            select(Event)
            .where(
                Event.blocks_calendar.is_(True),
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


def _add_weekdays(start: datetime.date, weekdays: int) -> datetime.date:
    remaining = weekdays - 1
    current = start
    while remaining > 0:
        current += datetime.timedelta(days=1)
        if current.weekday() < 5:
            remaining -= 1
    return current


def find_available_trial_slots(
    estimated_days: int,
    months_ahead: int = 6,
    earliest_date: str | None = None,
    latest_date: str | None = None,
    max_results: int = 10,
) -> dict:
    """Find available weekday blocks for a trial of the given duration."""
    today = datetime.date.today()
    range_start = (
        max(datetime.date.fromisoformat(earliest_date), today + datetime.timedelta(days=1))
        if earliest_date
        else today + datetime.timedelta(days=1)
    )
    range_end = (
        datetime.date.fromisoformat(latest_date)
        if latest_date
        else _add_months(today, months_ahead)
    )

    cal_data = get_trial_calendar(
        months_ahead=max(months_ahead, 12),
        months_behind=0,
    )

    blocked: set[datetime.date] = set()

    for trial in cal_data["trials"]:
        t_start = datetime.date.fromisoformat(trial["trial_date"])
        t_days = max(trial["trial_estimated_days"] or 1, 1)
        t_end = _add_weekdays(t_start, t_days)
        d = t_start
        while d <= t_end:
            if d.weekday() < 5:
                blocked.add(d)
            d += datetime.timedelta(days=1)

    for evt in cal_data["blocking_events"]:
        e_start = datetime.date.fromisoformat(evt["date"])
        e_end = (
            datetime.date.fromisoformat(evt["end_date"])
            if evt.get("end_date")
            else e_start
        )
        d = e_start
        while d <= e_end:
            if d.weekday() < 5:
                blocked.add(d)
            d += datetime.timedelta(days=1)

    slots: list[dict] = []
    d = range_start
    while d <= range_end and len(slots) < max_results:
        if d.weekday() >= 5 or d in blocked:
            d += datetime.timedelta(days=1)
            continue

        end = _add_weekdays(d, estimated_days)
        if end > range_end:
            break

        span_blocked = False
        check = d
        while check <= end:
            if check.weekday() < 5 and check in blocked:
                span_blocked = True
                break
            check += datetime.timedelta(days=1)

        if not span_blocked:
            slots.append({
                "start_date": d.isoformat(),
                "end_date": end.isoformat(),
                "weekdays": estimated_days,
            })
            d = _add_weekdays(d, 1)
            d += datetime.timedelta(days=1)
        else:
            d += datetime.timedelta(days=1)

    return {
        "slots": slots,
        "search_range": {
            "start": range_start.isoformat(),
            "end": range_end.isoformat(),
        },
        "total_found": len(slots),
    }
