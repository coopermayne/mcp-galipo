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


def get_upcoming_events(limit: int = None, offset: int = None) -> dict:
    """Get upcoming events (hearings, depositions, filing deadlines, etc.)."""
    conditions = ["e.date >= CURRENT_DATE"]
    params = []

    where_clause = f"WHERE {' AND '.join(conditions)}"

    with get_cursor() as cur:
        cur.execute(f"SELECT COUNT(*) as total FROM events e {where_clause}", params)
        total = cur.fetchone()["total"]

        query = f"""
            SELECT e.id, e.case_id, c.case_name, c.short_name, e.date, e.time, e.location,
                   e.description, e.document_link, e.calculation_note, e.starred
            FROM events e
            JOIN cases c ON e.case_id = c.id
            {where_clause}
            ORDER BY e.date
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
            SELECT e.id, e.case_id, c.case_name, c.short_name, e.date, e.time, e.location,
                   e.description, e.document_link, e.calculation_note, e.starred, e.created_at
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


def delete_event(event_id: int) -> bool:
    """Delete an event."""
    with get_cursor() as cur:
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
            SELECT e.id, e.case_id, c.case_name, c.short_name, e.date, e.time, e.location,
                   e.description, e.starred
            FROM events e
            JOIN cases c ON e.case_id = c.id
            {where_clause}
            ORDER BY e.date
            LIMIT %s
        """, params + [limit])
        return [dict(row) for row in cur.fetchall()]


def get_calendar(days: int = 30, include_tasks: bool = True,
                 include_events: bool = True) -> List[dict]:
    """Get calendar items for the next N days."""
    items = []

    with get_cursor() as cur:
        if include_events:
            cur.execute("""
                SELECT e.id, e.date, e.time, e.location, e.description,
                       e.case_id, c.case_name, c.short_name, 'event' as item_type
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
                       t.case_id, c.case_name, c.short_name, 'task' as item_type
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
