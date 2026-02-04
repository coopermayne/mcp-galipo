"""
Event/calendar management functions.
"""

from typing import Optional, List

from .connection import get_cursor, serialize_row, serialize_rows, _NOT_PROVIDED
from .validation import validate_date_format, validate_time_format


def add_event(case_id: int, date: str, description: str,
              document_link: str = None, calculation_note: str = None,
              time: str = None, location: str = None, starred: bool = False) -> dict:
    """Add an event to a case (hearing, deposition, filing deadline, etc.)."""
    validate_date_format(date, "date")
    validate_time_format(time, "time")

    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO events (case_id, date, time, location, description, document_link, calculation_note, starred)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, case_id, date, time, location, description, document_link, calculation_note, starred, created_at
        """, (case_id, date, time, location, description, document_link, calculation_note, starred))
        return serialize_row(dict(cur.fetchone()))


def get_upcoming_events(limit: int = None, offset: int = None, include_past: bool = False, past_days: int = 14, case_id: int = None, user_id: int = None, attendee_id: int = None) -> dict:
    """Get events (hearings, depositions, filing deadlines, etc.).

    Args:
        limit: Max number of results
        offset: Pagination offset
        include_past: If True, return past events instead of upcoming
        past_days: When include_past is True, how many days back to include (default 14)
        case_id: Filter to specific case
        user_id: Filter to events in cases where this user is assigned (attorney or paralegal)
        attendee_id: Filter to events where this user is an attendee
    """
    params = []

    if include_past:
        # Past events: from N days ago up to (but not including) today
        conditions = [f"e.date >= CURRENT_DATE - {past_days}", "e.date < CURRENT_DATE"]
        order = "ORDER BY e.date DESC"  # Most recent first
    else:
        # Upcoming events: today and future
        conditions = ["e.date >= CURRENT_DATE"]
        order = "ORDER BY e.date ASC"

    if case_id:
        conditions.append("e.case_id = %s")
        params.append(case_id)

    if user_id:
        conditions.append("(%s = ANY(c.attorney_ids) OR %s = ANY(c.paralegal_ids))")
        params.append(user_id)
        params.append(user_id)

    if attendee_id:
        conditions.append("%s = ANY(e.attendee_ids)")
        params.append(attendee_id)

    where_clause = f"WHERE {' AND '.join(conditions)}"

    # Need cases join for count when filtering by user_id (cases table has attorney_ids/paralegal_ids)
    needs_case_join = bool(user_id)
    count_from = "FROM events e JOIN cases c ON e.case_id = c.id" if needs_case_join else "FROM events e"

    with get_cursor() as cur:
        cur.execute(f"SELECT COUNT(*) as total {count_from} {where_clause}", params)
        total = cur.fetchone()["total"]

        query = f"""
            SELECT e.id, e.case_id, c.case_name, c.short_name, c.color as case_color, e.date, e.time, e.location,
                   e.description, e.document_link, e.calculation_note, e.starred,
                   (SELECT COUNT(*) FROM tasks t WHERE t.event_id = e.id) as task_count
            FROM events e
            JOIN cases c ON e.case_id = c.id
            {where_clause}
            {order}
        """
        if limit:
            query += f" LIMIT {limit}"
        if offset:
            query += f" OFFSET {offset}"

        cur.execute(query, params)
        return {"events": serialize_rows([dict(row) for row in cur.fetchall()]), "total": total}


def get_events(case_id: int = None) -> dict:
    """Get events, optionally filtered by case."""
    conditions = []
    params = []

    if case_id:
        conditions.append("e.case_id = %s")
        params.append(case_id)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with get_cursor() as cur:
        cur.execute(f"SELECT COUNT(*) as total FROM events e {where_clause}", params)
        total = cur.fetchone()["total"]

        cur.execute(f"""
            SELECT e.id, e.case_id, c.case_name, c.short_name, c.color as case_color, e.date, e.time, e.location,
                   e.description, e.document_link, e.calculation_note, e.starred, e.created_at,
                   (SELECT COUNT(*) FROM tasks t WHERE t.event_id = e.id) as task_count
            FROM events e
            JOIN cases c ON e.case_id = c.id
            {where_clause}
            ORDER BY e.date
        """, params)
        return {"events": serialize_rows([dict(row) for row in cur.fetchall()]), "total": total}


def update_event(event_id: int, starred: bool = None) -> Optional[dict]:
    """Update event starred status."""
    updates = []
    params = []

    if starred is not None:
        updates.append("starred = %s")
        params.append(starred)

    if not updates:
        return None

    params.append(event_id)

    with get_cursor() as cur:
        cur.execute(f"""
            UPDATE events SET {', '.join(updates)}
            WHERE id = %s
            RETURNING id, case_id, date, time, location, description, document_link, calculation_note, starred
        """, params)
        row = cur.fetchone()
        return serialize_row(dict(row)) if row else None


def update_event_full(event_id: int, date: str = _NOT_PROVIDED, description: str = _NOT_PROVIDED,
                      document_link: str = _NOT_PROVIDED, calculation_note: str = _NOT_PROVIDED,
                      time: str = _NOT_PROVIDED, location: str = _NOT_PROVIDED,
                      starred: bool = _NOT_PROVIDED) -> Optional[dict]:
    """Update all event fields."""
    updates = []
    params = []

    if date is not _NOT_PROVIDED:
        if date is not None:
            validate_date_format(date, "date")
        updates.append("date = %s")
        params.append(date)

    if time is not _NOT_PROVIDED:
        if time is not None and time != "":
            validate_time_format(time, "time")
        updates.append("time = %s")
        params.append(time if time else None)

    if location is not _NOT_PROVIDED:
        updates.append("location = %s")
        params.append(location if location else None)

    if description is not _NOT_PROVIDED:
        updates.append("description = %s")
        params.append(description)

    if document_link is not _NOT_PROVIDED:
        updates.append("document_link = %s")
        params.append(document_link if document_link else None)

    if calculation_note is not _NOT_PROVIDED:
        updates.append("calculation_note = %s")
        params.append(calculation_note if calculation_note else None)

    if starred is not _NOT_PROVIDED:
        updates.append("starred = %s")
        params.append(starred)

    if not updates:
        return None

    params.append(event_id)

    with get_cursor() as cur:
        cur.execute(f"""
            UPDATE events SET {', '.join(updates)}
            WHERE id = %s
            RETURNING id, case_id, date, time, location, description, document_link, calculation_note, starred
        """, params)
        row = cur.fetchone()
        return serialize_row(dict(row)) if row else None


def get_tasks_for_event(event_id: int) -> List[dict]:
    """Get tasks linked to an event."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT id, description FROM tasks WHERE event_id = %s
        """, (event_id,))
        return [dict(row) for row in cur.fetchall()]


def delete_event(event_id: int) -> bool:
    """Delete an event and its linked tasks."""
    with get_cursor() as cur:
        # Delete linked tasks first
        cur.execute("DELETE FROM tasks WHERE event_id = %s", (event_id,))
        # Then delete the event
        cur.execute("DELETE FROM events WHERE id = %s", (event_id,))
        return cur.rowcount > 0


def search_events(query: str = None, case_id: int = None,
                  limit: int = 50) -> List[dict]:
    """Search events by various criteria."""
    conditions = []
    params = []

    if query:
        conditions.append("e.description ILIKE %s")
        params.append(f"%{query}%")

    if case_id:
        conditions.append("e.case_id = %s")
        params.append(case_id)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with get_cursor() as cur:
        cur.execute(f"""
            SELECT e.id, e.case_id, c.case_name, c.short_name, c.color as case_color, e.date, e.time, e.location,
                   e.description, e.starred
            FROM events e
            JOIN cases c ON e.case_id = c.id
            {where_clause}
            ORDER BY e.date
            LIMIT %s
        """, params + [limit])
        return serialize_rows([dict(row) for row in cur.fetchall()])


def get_calendar_range(date_from: str, date_to: str, user_id: int = None) -> List[dict]:
    """Get events for a date range, optionally filtered by user's cases."""
    params = [date_from, date_to]
    user_condition = ""

    if user_id:
        user_condition = " AND (%s = ANY(c.attorney_ids) OR %s = ANY(c.paralegal_ids))"
        params.extend([user_id, user_id])

    with get_cursor() as cur:
        cur.execute(f"""
            SELECT e.id, e.date, e.time, e.location, e.description,
                   e.case_id, c.case_name, c.short_name, c.color as case_color, 'event' as item_type
            FROM events e
            JOIN cases c ON e.case_id = c.id
            WHERE e.date >= %s AND e.date <= %s{user_condition}
            ORDER BY e.date, e.time NULLS LAST
        """, params)
        return serialize_rows([dict(row) for row in cur.fetchall()])


def get_calendar(days: int = 30, include_tasks: bool = True,
                 include_events: bool = True) -> List[dict]:
    """Get calendar items for the next N days."""
    items = []

    with get_cursor() as cur:
        if include_events:
            cur.execute("""
                SELECT e.id, e.date, e.time, e.location, e.description,
                       e.case_id, c.case_name, c.short_name, c.color as case_color, 'event' as item_type
                FROM events e
                JOIN cases c ON e.case_id = c.id
                WHERE e.date >= CURRENT_DATE AND e.date <= CURRENT_DATE + %s
                ORDER BY e.date, e.time NULLS LAST
            """, (days,))
            items.extend([dict(row) for row in cur.fetchall()])

        if include_tasks:
            cur.execute("""
                SELECT t.id, t.due_date as date, NULL as time, NULL as location,
                       t.description, t.status, t.urgency,
                       t.case_id, c.case_name, c.short_name, c.color as case_color, 'task' as item_type
                FROM tasks t
                JOIN cases c ON t.case_id = c.id
                WHERE t.due_date IS NOT NULL
                  AND t.due_date >= CURRENT_DATE AND t.due_date <= CURRENT_DATE + %s
                  AND t.status != 'Done'
                ORDER BY t.due_date
            """, (days,))
            items.extend([dict(row) for row in cur.fetchall()])

    # Sort by date
    items.sort(key=lambda x: (str(x.get("date") or "9999-99-99"), str(x.get("time") or "99:99")))
    return items


# =============================================================================
# Event Attendees
# =============================================================================

def get_event_attendees(event_id: int) -> List[dict]:
    """Get all attendees for an event with user details."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT attendee_ids FROM events WHERE id = %s
        """, (event_id,))
        row = cur.fetchone()
        if not row:
            return []

        attendee_ids = row["attendee_ids"] or []
        if not attendee_ids:
            return []

        cur.execute("""
            SELECT id, email, first_name, last_name, initials, position
            FROM users WHERE id = ANY(%s)
            ORDER BY last_name, first_name
        """, (attendee_ids,))
        return serialize_rows(cur.fetchall())


def add_event_attendee(event_id: int, user_id: int) -> dict:
    """Add an attendee to an event."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT attendee_ids FROM events WHERE id = %s
        """, (event_id,))
        row = cur.fetchone()
        if not row:
            return {"success": False, "error": "Event not found"}

        attendee_ids = list(row["attendee_ids"] or [])
        if user_id not in attendee_ids:
            attendee_ids.append(user_id)
            cur.execute("""
                UPDATE events SET attendee_ids = %s
                WHERE id = %s
            """, (attendee_ids, event_id))

    return {"success": True, "attendees": get_event_attendees(event_id)}


def remove_event_attendee(event_id: int, user_id: int) -> dict:
    """Remove an attendee from an event."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT attendee_ids FROM events WHERE id = %s
        """, (event_id,))
        row = cur.fetchone()
        if not row:
            return {"success": False, "error": "Event not found"}

        attendee_ids = list(row["attendee_ids"] or [])
        if user_id in attendee_ids:
            attendee_ids.remove(user_id)
            cur.execute("""
                UPDATE events SET attendee_ids = %s
                WHERE id = %s
            """, (attendee_ids, event_id))

    return {"success": True, "attendees": get_event_attendees(event_id)}


def get_event_by_id(event_id: int) -> Optional[dict]:
    """Get a single event by ID with attendee details."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT e.id, e.case_id, c.case_name, c.short_name, c.color as case_color,
                   e.date, e.time, e.location, e.description, e.document_link,
                   e.calculation_note, e.starred, e.attendee_ids, e.created_at,
                   (SELECT COUNT(*) FROM tasks t WHERE t.event_id = e.id) as task_count
            FROM events e
            JOIN cases c ON e.case_id = c.id
            WHERE e.id = %s
        """, (event_id,))
        row = cur.fetchone()
        if not row:
            return None

        result = serialize_row(dict(row))

        # Expand attendee_ids to full user objects
        attendee_ids = result.get("attendee_ids") or []
        if attendee_ids:
            cur.execute("""
                SELECT id, email, first_name, last_name, initials, position
                FROM users WHERE id = ANY(%s)
                ORDER BY last_name, first_name
            """, (attendee_ids,))
            result["attendees"] = serialize_rows(cur.fetchall())
        else:
            result["attendees"] = []

        return result
