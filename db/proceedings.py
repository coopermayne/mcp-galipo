"""
Proceedings management functions.

A proceeding represents a court filing within a case. A single case (matter) can have
multiple proceedings across different courts (e.g., state court -> federal removal -> appeal).
"""

from typing import Optional, List

from .connection import get_cursor, serialize_row, serialize_rows, _NOT_PROVIDED


def add_proceeding(case_id: int, case_number: str, jurisdiction_id: int = None,
                   judge_id: int = None, sort_order: int = None, is_primary: bool = False,
                   notes: str = None) -> dict:
    """Add a proceeding to a case."""
    with get_cursor() as cur:
        # Determine sort_order if not provided
        if sort_order is None:
            cur.execute("""
                SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order
                FROM proceedings WHERE case_id = %s
            """, (case_id,))
            sort_order = cur.fetchone()["next_order"]

        # If this is marked as primary, unmark others
        if is_primary:
            cur.execute("""
                UPDATE proceedings SET is_primary = FALSE WHERE case_id = %s
            """, (case_id,))

        cur.execute("""
            INSERT INTO proceedings (case_id, case_number, jurisdiction_id, judge_id, sort_order, is_primary, notes)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id, case_id, case_number, jurisdiction_id, judge_id, sort_order, is_primary, notes, created_at, updated_at
        """, (case_id, case_number, jurisdiction_id, judge_id, sort_order, is_primary, notes))
        row = cur.fetchone()

        # Fetch with joined data
        return get_proceeding_by_id(row["id"])


def get_proceedings(case_id: int) -> List[dict]:
    """Get all proceedings for a case."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT p.id, p.case_id, p.case_number, p.jurisdiction_id, p.judge_id,
                   p.sort_order, p.is_primary, p.notes, p.created_at, p.updated_at,
                   j.name as jurisdiction_name, j.local_rules_link,
                   per.name as judge_name
            FROM proceedings p
            LEFT JOIN jurisdictions j ON p.jurisdiction_id = j.id
            LEFT JOIN persons per ON p.judge_id = per.id
            WHERE p.case_id = %s
            ORDER BY p.sort_order, p.id
        """, (case_id,))
        return serialize_rows([dict(row) for row in cur.fetchall()])


def get_proceeding_by_id(proceeding_id: int) -> Optional[dict]:
    """Get a proceeding by ID with joined jurisdiction and judge data."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT p.id, p.case_id, p.case_number, p.jurisdiction_id, p.judge_id,
                   p.sort_order, p.is_primary, p.notes, p.created_at, p.updated_at,
                   j.name as jurisdiction_name, j.local_rules_link,
                   per.name as judge_name
            FROM proceedings p
            LEFT JOIN jurisdictions j ON p.jurisdiction_id = j.id
            LEFT JOIN persons per ON p.judge_id = per.id
            WHERE p.id = %s
        """, (proceeding_id,))
        row = cur.fetchone()
        return serialize_row(dict(row)) if row else None


def update_proceeding(proceeding_id: int, case_number: str = _NOT_PROVIDED,
                      jurisdiction_id: int = _NOT_PROVIDED, judge_id: int = _NOT_PROVIDED,
                      sort_order: int = _NOT_PROVIDED, is_primary: bool = _NOT_PROVIDED,
                      notes: str = _NOT_PROVIDED) -> Optional[dict]:
    """Update a proceeding."""
    updates = []
    params = []

    if case_number is not _NOT_PROVIDED:
        updates.append("case_number = %s")
        params.append(case_number)

    if jurisdiction_id is not _NOT_PROVIDED:
        updates.append("jurisdiction_id = %s")
        params.append(jurisdiction_id)

    if judge_id is not _NOT_PROVIDED:
        updates.append("judge_id = %s")
        params.append(judge_id)

    if sort_order is not _NOT_PROVIDED:
        updates.append("sort_order = %s")
        params.append(sort_order)

    if is_primary is not _NOT_PROVIDED:
        updates.append("is_primary = %s")
        params.append(is_primary)

    if notes is not _NOT_PROVIDED:
        updates.append("notes = %s")
        params.append(notes if notes else None)

    if not updates:
        return get_proceeding_by_id(proceeding_id)

    updates.append("updated_at = CURRENT_TIMESTAMP")
    params.append(proceeding_id)

    with get_cursor() as cur:
        # If setting as primary, unmark others first
        if is_primary is not _NOT_PROVIDED and is_primary:
            cur.execute("""
                SELECT case_id FROM proceedings WHERE id = %s
            """, (proceeding_id,))
            row = cur.fetchone()
            if row:
                cur.execute("""
                    UPDATE proceedings SET is_primary = FALSE WHERE case_id = %s AND id != %s
                """, (row["case_id"], proceeding_id))

        cur.execute(f"""
            UPDATE proceedings SET {', '.join(updates)}
            WHERE id = %s
            RETURNING id
        """, params)
        row = cur.fetchone()
        if not row:
            return None

    return get_proceeding_by_id(proceeding_id)


def delete_proceeding(proceeding_id: int) -> bool:
    """Delete a proceeding."""
    with get_cursor() as cur:
        cur.execute("DELETE FROM proceedings WHERE id = %s", (proceeding_id,))
        return cur.rowcount > 0
