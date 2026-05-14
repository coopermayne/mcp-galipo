"""
Event/calendar management functions — SQLAlchemy ORM implementation.
"""

import datetime
from typing import Optional, List

from sqlalchemy import select, func, literal_column, text, Integer, cast, or_
from sqlalchemy.dialects.postgresql import ARRAY as SA_ARRAY
from sqlalchemy.orm import joinedload

from .session import SessionLocal
from .connection import _NOT_PROVIDED
from .validation import validate_date_format, validate_time_format
from models import Event, Case, Task, User
from schemas import EventOut


def _serialize_value(val):
    """Convert datetime/date/time objects to JSON-safe strings."""
    if isinstance(val, datetime.datetime):
        return val.isoformat()
    elif isinstance(val, datetime.date):
        return val.isoformat()
    elif isinstance(val, datetime.time):
        return val.strftime("%H:%M")
    return val


def _event_to_dict(event: Event) -> dict:
    """Convert an Event ORM instance to a serializable dict."""
    return EventOut.model_validate(event).model_dump(mode="json")


def _event_with_case_dict(event: Event, case: Case, task_count: int = 0) -> dict:
    """Convert Event + joined Case to a dict with case info and task count."""
    d = _event_to_dict(event)
    d["case_name"] = case.case_name if case else None
    d["short_name"] = case.short_name if case else None
    d["case_color"] = case.color if case else None
    d["task_count"] = task_count
    d["attendee_ids"] = event.attendee_ids or []
    return d


def add_event(case_id: int = None, date: str = "", description: str = "",
              document_link: str = None, calculation_note: str = None,
              time: str = None, location: str = None, starred: bool = False,
              event_type: str = None, end_date: str = None,
              blocks_calendar: bool = None) -> dict:
    """Add an event, optionally associated with a case."""
    validate_date_format(date, "date")
    validate_time_format(time, "time")
    if end_date:
        validate_date_format(end_date, "end_date")

    with SessionLocal() as session:
        event = Event(
            case_id=case_id,
            date=date,
            time=time,
            location=location,
            description=description,
            document_link=document_link,
            calculation_note=calculation_note,
            starred=starred,
            event_type=event_type,
            end_date=end_date,
            blocks_calendar=blocks_calendar if blocks_calendar is not None else False,
        )
        session.add(event)
        session.flush()
        session.refresh(event)
        result = _event_to_dict(event)
        session.commit()
        return result


def get_upcoming_events(limit: int = None, offset: int = None, include_past: bool = False,
                        past_days: int = 14, case_id: int = None, user_id: int = None,
                        attendee_id: int = None) -> dict:
    """Get events (hearings, depositions, filing deadlines, etc.)."""
    today = func.current_date()

    # Task count subquery
    task_count_sq = (
        select(func.count(Task.id))
        .where(Task.event_id == Event.id)
        .correlate(Event)
        .scalar_subquery()
    )

    # Build base query
    stmt = select(Event, Case, task_count_sq.label("task_count")).outerjoin(Case, Event.case_id == Case.id)

    # Date conditions
    if include_past:
        stmt = stmt.where(Event.date >= today - past_days, Event.date < today)
        stmt = stmt.order_by(Event.date.desc())
    else:
        stmt = stmt.where(Event.date >= today)
        stmt = stmt.order_by(Event.date.asc())

    if case_id:
        stmt = stmt.where(Event.case_id == case_id)

    if user_id:
        uid_arr = cast([user_id], SA_ARRAY(Integer()))
        stmt = stmt.where(or_(
            Event.case_id.is_(None),
            Case.attorney_ids.op('@>')(uid_arr),
            Case.paralegal_ids.op('@>')(uid_arr),
        ))

    if attendee_id:
        aid_arr = cast([attendee_id], SA_ARRAY(Integer()))
        stmt = stmt.where(
            Event.attendee_ids.op('@>')(aid_arr)
        )

    with SessionLocal() as session:
        # Count query — same filters
        count_base = select(Event.id).outerjoin(Case, Event.case_id == Case.id)
        if include_past:
            count_base = count_base.where(Event.date >= today - past_days, Event.date < today)
        else:
            count_base = count_base.where(Event.date >= today)
        if case_id:
            count_base = count_base.where(Event.case_id == case_id)
        if user_id:
            uid_arr = cast([user_id], SA_ARRAY(Integer()))
            count_base = count_base.where(or_(
                Event.case_id.is_(None),
                Case.attorney_ids.op('@>')(uid_arr),
                Case.paralegal_ids.op('@>')(uid_arr),
            ))
        if attendee_id:
            aid_arr = cast([attendee_id], SA_ARRAY(Integer()))
            count_base = count_base.where(
                Event.attendee_ids.op('@>')(aid_arr)
            )
        total = session.scalar(select(func.count()).select_from(count_base.subquery()))

        if limit:
            stmt = stmt.limit(limit)
        if offset:
            stmt = stmt.offset(offset)

        rows = session.execute(stmt).all()
        events = [_event_with_case_dict(event, case, tc) for event, case, tc in rows]
        return {"events": events, "total": total}


def get_events(case_id: int = None) -> dict:
    """Get events, optionally filtered by case."""
    task_count_sq = (
        select(func.count(Task.id))
        .where(Task.event_id == Event.id)
        .correlate(Event)
        .scalar_subquery()
    )

    stmt = (
        select(Event, Case, task_count_sq.label("task_count"))
        .outerjoin(Case, Event.case_id == Case.id)
        .order_by(Event.date)
    )

    if case_id:
        stmt = stmt.where(Event.case_id == case_id)

    with SessionLocal() as session:
        count_base = select(Event.id)
        if case_id:
            count_base = count_base.where(Event.case_id == case_id)
        total = session.scalar(select(func.count()).select_from(count_base.subquery()))

        rows = session.execute(stmt).all()
        events = []
        for event, case, tc in rows:
            d = _event_with_case_dict(event, case, tc)
            d["created_at"] = _serialize_value(event.created_at)
            events.append(d)
        return {"events": events, "total": total}


def update_event(event_id: int, starred: bool = None) -> Optional[dict]:
    """Update event starred status."""
    if starred is None:
        return None

    with SessionLocal() as session:
        event = session.get(Event, event_id)
        if not event:
            return None

        event.starred = starred
        session.flush()
        session.refresh(event)
        result = _event_to_dict(event)
        session.commit()
        return result


def update_event_full(event_id: int, date: str = _NOT_PROVIDED, description: str = _NOT_PROVIDED,
                      document_link: str = _NOT_PROVIDED, calculation_note: str = _NOT_PROVIDED,
                      time: str = _NOT_PROVIDED, location: str = _NOT_PROVIDED,
                      starred: bool = _NOT_PROVIDED, event_type: str = _NOT_PROVIDED,
                      end_date: str = _NOT_PROVIDED, blocks_calendar: bool = _NOT_PROVIDED) -> Optional[dict]:
    """Update all event fields."""
    fields = [date, description, document_link, calculation_note, time, location, starred, event_type, end_date, blocks_calendar]
    if all(f is _NOT_PROVIDED for f in fields):
        return None

    with SessionLocal() as session:
        event = session.get(Event, event_id)
        if not event:
            return None

        if date is not _NOT_PROVIDED:
            if date is not None:
                validate_date_format(date, "date")
            event.date = date

        if time is not _NOT_PROVIDED:
            if time is not None and time != "":
                validate_time_format(time, "time")
            event.time = time if time else None

        if location is not _NOT_PROVIDED:
            event.location = location if location else None

        if description is not _NOT_PROVIDED:
            event.description = description

        if document_link is not _NOT_PROVIDED:
            event.document_link = document_link if document_link else None

        if calculation_note is not _NOT_PROVIDED:
            event.calculation_note = calculation_note if calculation_note else None

        if starred is not _NOT_PROVIDED:
            event.starred = starred

        if event_type is not _NOT_PROVIDED:
            event.event_type = event_type if event_type else None

        if end_date is not _NOT_PROVIDED:
            if end_date is not None and end_date != "":
                validate_date_format(end_date, "end_date")
            event.end_date = end_date if end_date else None

        if blocks_calendar is not _NOT_PROVIDED:
            event.blocks_calendar = blocks_calendar

        session.flush()
        session.refresh(event)
        result = _event_to_dict(event)
        session.commit()
        return result


def get_tasks_for_event(event_id: int) -> List[dict]:
    """Get tasks linked to an event."""
    with SessionLocal() as session:
        stmt = select(Task).where(Task.event_id == event_id)
        tasks = session.scalars(stmt).all()
        return [{"id": t.id, "description": t.description} for t in tasks]


def delete_event(event_id: int) -> bool:
    """Delete an event and its linked tasks."""
    with SessionLocal() as session:
        event = session.get(Event, event_id)
        if not event:
            return False

        # Delete linked tasks first
        session.execute(
            Task.__table__.delete().where(Task.event_id == event_id)
        )
        session.delete(event)
        session.commit()
        return True


def search_events(query: str = None, case_id: int = None,
                  limit: int = 50, user_id: int = None,
                  date_before: str = None, date_after: str = None) -> List[dict]:
    """Search events by various criteria."""
    if date_before:
        validate_date_format(date_before, "date_before")
    if date_after:
        validate_date_format(date_after, "date_after")

    stmt = (
        select(Event, Case)
        .outerjoin(Case, Event.case_id == Case.id)
        .order_by(Event.date)
        .limit(limit)
    )

    if query:
        stmt = stmt.where(Event.description.ilike(f"%{query}%"))
    if case_id:
        stmt = stmt.where(Event.case_id == case_id)
    if user_id:
        uid_arr = cast([user_id], SA_ARRAY(Integer()))
        stmt = stmt.where(or_(
            Event.case_id.is_(None),
            Case.attorney_ids.op('@>')(uid_arr),
            Case.paralegal_ids.op('@>')(uid_arr),
        ))
    if date_before:
        stmt = stmt.where(Event.date <= date_before)
    if date_after:
        stmt = stmt.where(Event.date >= date_after)

    with SessionLocal() as session:
        rows = session.execute(stmt).all()
        results = []
        for event, case in rows:
            results.append({
                "id": event.id,
                "case_id": event.case_id,
                "case_name": case.case_name if case else None,
                "short_name": case.short_name if case else None,
                "case_color": case.color if case else None,
                "date": _serialize_value(event.date),
                "time": _serialize_value(event.time),
                "location": event.location,
                "description": event.description,
                "starred": event.starred,
            })
        return results


def get_calendar(days: int = 30, include_tasks: bool = True,
                 include_events: bool = True) -> List[dict]:
    """Get calendar items for the next N days."""
    today = func.current_date()
    items = []

    with SessionLocal() as session:
        if include_events:
            stmt = (
                select(Event, Case)
                .outerjoin(Case, Event.case_id == Case.id)
                .where(Event.date >= today, Event.date <= today + days)
                .order_by(Event.date, Event.time.asc().nulls_last())
            )
            for event, case in session.execute(stmt).all():
                items.append({
                    "id": event.id,
                    "date": _serialize_value(event.date),
                    "time": _serialize_value(event.time),
                    "location": event.location,
                    "description": event.description,
                    "case_id": event.case_id,
                    "case_name": case.case_name if case else None,
                    "short_name": case.short_name if case else None,
                    "case_color": case.color if case else None,
                    "item_type": "event",
                })

        if include_tasks:
            stmt = (
                select(Task, Case)
                .outerjoin(Case, Task.case_id == Case.id)
                .where(
                    Task.due_date.isnot(None),
                    Task.due_date >= today,
                    Task.due_date <= today + days,
                    Task.status != "Done",
                )
                .order_by(Task.due_date)
            )
            for task, case in session.execute(stmt).all():
                items.append({
                    "id": task.id,
                    "date": _serialize_value(task.due_date),
                    "time": None,
                    "location": None,
                    "description": task.description,
                    "status": task.status,
                    "urgency": task.urgency,
                    "case_id": task.case_id,
                    "case_name": case.case_name if case else None,
                    "short_name": case.short_name if case else None,
                    "case_color": case.color if case else None,
                    "item_type": "task",
                })

    # Sort by date, then time
    items.sort(key=lambda x: (str(x.get("date") or "9999-99-99"), str(x.get("time") or "99:99")))
    return items


# =============================================================================
# Event Attendees
# =============================================================================

def get_event_attendees(event_id: int) -> List[dict]:
    """Get all attendees for an event with user details."""
    with SessionLocal() as session:
        event = session.get(Event, event_id)
        if not event:
            return []

        attendee_ids = event.attendee_ids or []
        if not attendee_ids:
            return []

        stmt = (
            select(User)
            .where(User.id.in_(attendee_ids))
            .order_by(User.last_name, User.first_name)
        )
        users = session.scalars(stmt).all()
        return [
            {
                "id": u.id,
                "email": u.email,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "initials": u.initials,
                "position": u.position,
            }
            for u in users
        ]


def add_event_attendee(event_id: int, user_id: int) -> dict:
    """Add an attendee to an event."""
    with SessionLocal() as session:
        event = session.get(Event, event_id)
        if not event:
            return {"success": False, "error": "Event not found"}

        current = list(event.attendee_ids or [])
        if user_id not in current:
            # Must reassign — SQLAlchemy won't detect in-place mutation
            event.attendee_ids = current + [user_id]
            session.flush()

        session.commit()

    # Fetch attendees outside the session that mutated
    return {"success": True, "attendees": get_event_attendees(event_id)}


def remove_event_attendee(event_id: int, user_id: int) -> dict:
    """Remove an attendee from an event."""
    with SessionLocal() as session:
        event = session.get(Event, event_id)
        if not event:
            return {"success": False, "error": "Event not found"}

        current = list(event.attendee_ids or [])
        if user_id in current:
            # Must reassign — SQLAlchemy won't detect in-place mutation
            event.attendee_ids = [x for x in current if x != user_id]
            session.flush()

        session.commit()

    return {"success": True, "attendees": get_event_attendees(event_id)}


def get_event_by_id(event_id: int) -> Optional[dict]:
    """Get a single event by ID with attendee details."""
    task_count_sq = (
        select(func.count(Task.id))
        .where(Task.event_id == Event.id)
        .correlate(Event)
        .scalar_subquery()
    )

    with SessionLocal() as session:
        stmt = (
            select(Event, Case, task_count_sq.label("task_count"))
            .outerjoin(Case, Event.case_id == Case.id)
            .where(Event.id == event_id)
        )
        row = session.execute(stmt).first()
        if not row:
            return None

        event, case, tc = row
        result = _event_with_case_dict(event, case, tc)
        result["attendee_ids"] = event.attendee_ids or []
        result["created_at"] = _serialize_value(event.created_at)

        # Expand attendee_ids to full user objects
        attendee_ids = event.attendee_ids or []
        if attendee_ids:
            users_stmt = (
                select(User)
                .where(User.id.in_(attendee_ids))
                .order_by(User.last_name, User.first_name)
            )
            users = session.scalars(users_stmt).all()
            result["attendees"] = [
                {
                    "id": u.id,
                    "email": u.email,
                    "first_name": u.first_name,
                    "last_name": u.last_name,
                    "initials": u.initials,
                    "position": u.position,
                }
                for u in users
            ]
        else:
            result["attendees"] = []

        return result
