"""
Note management functions.
"""

from typing import Optional

from .connection import get_cursor, serialize_row, serialize_rows


def add_note(case_id: int, content: str) -> dict:
    """Add a note to a case."""
    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO notes (case_id, content)
            VALUES (%s, %s)
            RETURNING id, case_id, content, created_at, updated_at
        """, (case_id, content))
        return serialize_row(dict(cur.fetchone()))


def update_note(note_id: int, content: str) -> Optional[dict]:
    """Update a note's content."""
    with get_cursor() as cur:
        cur.execute("""
            UPDATE notes SET content = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING id, case_id, content, created_at, updated_at
        """, (content, note_id))
        row = cur.fetchone()
        return serialize_row(dict(row)) if row else None


def delete_note(note_id: int) -> bool:
    """Delete a note."""
    with get_cursor() as cur:
        cur.execute("DELETE FROM notes WHERE id = %s", (note_id,))
        return cur.rowcount > 0


def get_notes(case_id: int = None) -> dict:
    """Get notes, optionally filtered by case."""
    conditions = []
    params = []

    if case_id:
        conditions.append("n.case_id = %s")
        params.append(case_id)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with get_cursor() as cur:
        cur.execute(f"SELECT COUNT(*) as total FROM notes n {where_clause}", params)
        total = cur.fetchone()["total"]

        cur.execute(f"""
            SELECT n.id, n.case_id, c.case_name, c.short_name, n.content, n.created_at, n.updated_at
            FROM notes n
            JOIN cases c ON n.case_id = c.id
            {where_clause}
            ORDER BY n.created_at DESC
        """, params)
        return {"notes": serialize_rows([dict(row) for row in cur.fetchall()]), "total": total}
