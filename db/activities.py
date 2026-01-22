"""
Activity/time tracking functions.
"""

from typing import Optional, List

from .connection import get_cursor, serialize_row, serialize_rows
from .validation import validate_date_format


def add_activity(case_id: int, description: str, activity_type: str,
                 date: str, minutes: int = None) -> dict:
    """Add an activity to a case."""
    validate_date_format(date, "date")

    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO activities (case_id, description, type, date, minutes)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, case_id, description, type, date, minutes, created_at
        """, (case_id, description, activity_type, date, minutes))
        return serialize_row(dict(cur.fetchone()))


def get_all_activities(case_id: int = None) -> List[dict]:
    """Get all activities, optionally filtered by case."""
    with get_cursor() as cur:
        if case_id:
            cur.execute("""
                SELECT a.id, a.case_id, c.case_name, a.description, a.type, a.date, a.minutes
                FROM activities a
                JOIN cases c ON a.case_id = c.id
                WHERE a.case_id = %s
                ORDER BY a.date DESC
            """, (case_id,))
        else:
            cur.execute("""
                SELECT a.id, a.case_id, c.case_name, a.description, a.type, a.date, a.minutes
                FROM activities a
                JOIN cases c ON a.case_id = c.id
                ORDER BY a.date DESC
            """)
        return [dict(row) for row in cur.fetchall()]


def get_activities(case_id: int = None) -> dict:
    """Get activities with total count, optionally filtered by case."""
    conditions = []
    params = []

    if case_id:
        conditions.append("a.case_id = %s")
        params.append(case_id)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with get_cursor() as cur:
        cur.execute(f"SELECT COUNT(*) as total FROM activities a {where_clause}", params)
        total = cur.fetchone()["total"]

        cur.execute(f"""
            SELECT a.id, a.case_id, c.case_name, c.short_name, a.description, a.type, a.date, a.minutes, a.created_at
            FROM activities a
            JOIN cases c ON a.case_id = c.id
            {where_clause}
            ORDER BY a.date DESC
        """, params)
        return {"activities": serialize_rows([dict(row) for row in cur.fetchall()]), "total": total}


def update_activity(activity_id: int, date: str = None, description: str = None,
                    activity_type: str = None, minutes: int = None) -> Optional[dict]:
    """Update an activity."""
    updates = []
    params = []

    if date is not None:
        validate_date_format(date, "date")
        updates.append("date = %s")
        params.append(date)

    if description is not None:
        updates.append("description = %s")
        params.append(description)

    if activity_type is not None:
        updates.append("type = %s")
        params.append(activity_type)

    if minutes is not None:
        updates.append("minutes = %s")
        params.append(minutes)

    if not updates:
        return None

    params.append(activity_id)

    with get_cursor() as cur:
        cur.execute(f"""
            UPDATE activities SET {', '.join(updates)}
            WHERE id = %s
            RETURNING id, case_id, description, type, date, minutes
        """, params)
        row = cur.fetchone()
        return serialize_row(dict(row)) if row else None


def delete_activity(activity_id: int) -> bool:
    """Delete an activity."""
    with get_cursor() as cur:
        cur.execute("DELETE FROM activities WHERE id = %s", (activity_id,))
        return cur.rowcount > 0
