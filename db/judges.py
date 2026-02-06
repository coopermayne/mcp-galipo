"""
Judges management functions.

Judges are separate from the persons system - they have their own standalone table
and are linked to proceedings (not cases) via the proceeding_judges table.
"""

import json
from typing import Optional, List

from .connection import get_cursor, serialize_row, serialize_rows, _NOT_PROVIDED


def get_judges(search: str = None, jurisdiction_id: int = None,
               status: str = None, limit: int = 50, offset: int = 0) -> dict:
    """Get all judges with optional filtering."""
    conditions = []
    params = []

    if search:
        conditions.append("j.name ILIKE %s")
        params.append(f"%{search}%")

    if jurisdiction_id:
        conditions.append("j.jurisdiction_id = %s")
        params.append(jurisdiction_id)

    if status:
        conditions.append("j.status = %s")
        params.append(status)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with get_cursor() as cur:
        # Get total count
        cur.execute(f"SELECT COUNT(*) as total FROM judges j {where_clause}", params)
        total = cur.fetchone()["total"]

        # Get judges with jurisdiction info
        cur.execute(f"""
            SELECT j.id, j.name, j.phones, j.emails, j.jurisdiction_id,
                   j.chambers, j.courtroom_number, j.appointed_by, j.appointed_date,
                   j.initials, j.status, j.notes, j.created_at, j.updated_at,
                   jur.name as jurisdiction_name
            FROM judges j
            LEFT JOIN jurisdictions jur ON j.jurisdiction_id = jur.id
            {where_clause}
            ORDER BY j.name
            LIMIT %s OFFSET %s
        """, params + [limit, offset])

        judges = serialize_rows([dict(row) for row in cur.fetchall()])

        return {"judges": judges, "total": total}


def get_judge_by_id(judge_id: int) -> Optional[dict]:
    """Get a single judge by ID with jurisdiction info and proceeding count."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT j.id, j.name, j.phones, j.emails, j.jurisdiction_id,
                   j.chambers, j.courtroom_number, j.appointed_by, j.appointed_date,
                   j.initials, j.status, j.notes, j.created_at, j.updated_at,
                   jur.name as jurisdiction_name, jur.local_rules_link
            FROM judges j
            LEFT JOIN jurisdictions jur ON j.jurisdiction_id = jur.id
            WHERE j.id = %s
        """, (judge_id,))
        row = cur.fetchone()
        if not row:
            return None

        result = serialize_row(dict(row))

        # Get proceeding assignments
        cur.execute("""
            SELECT pj.proceeding_id, pj.role, pj.sort_order,
                   p.case_number, p.case_id, c.case_name, c.short_name
            FROM proceeding_judges pj
            JOIN proceedings p ON pj.proceeding_id = p.id
            JOIN cases c ON p.case_id = c.id
            WHERE pj.judge_id = %s
            ORDER BY c.case_name, p.case_number
        """, (judge_id,))
        result["proceedings"] = serialize_rows([dict(r) for r in cur.fetchall()])

        return result


def search_judges(name: str = None, jurisdiction_id: int = None) -> List[dict]:
    """Search judges by name and/or jurisdiction. Returns simple list for autocomplete."""
    conditions = []
    params = []

    if name:
        conditions.append("j.name ILIKE %s")
        params.append(f"%{name}%")

    if jurisdiction_id:
        conditions.append("j.jurisdiction_id = %s")
        params.append(jurisdiction_id)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with get_cursor() as cur:
        cur.execute(f"""
            SELECT j.id, j.name, j.jurisdiction_id, jur.name as jurisdiction_name
            FROM judges j
            LEFT JOIN jurisdictions jur ON j.jurisdiction_id = jur.id
            {where_clause}
            ORDER BY j.name
            LIMIT 20
        """, params)
        return [dict(row) for row in cur.fetchall()]


def create_judge(name: str, phones: List[dict] = None, emails: List[dict] = None,
                 jurisdiction_id: int = None, chambers: str = None,
                 courtroom_number: str = None, appointed_by: str = None,
                 appointed_date: str = None, initials: str = None,
                 status: str = "Active", notes: str = None) -> dict:
    """Create a new judge."""
    phones_json = json.dumps(phones) if phones else '[]'
    emails_json = json.dumps(emails) if emails else '[]'

    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO judges (name, phones, emails, jurisdiction_id, chambers,
                               courtroom_number, appointed_by, appointed_date,
                               initials, status, notes)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (name, phones_json, emails_json, jurisdiction_id, chambers,
              courtroom_number, appointed_by, appointed_date, initials, status, notes))
        judge_id = cur.fetchone()["id"]

    return get_judge_by_id(judge_id)


def update_judge(judge_id: int, name: str = _NOT_PROVIDED,
                 phones: List[dict] = _NOT_PROVIDED, emails: List[dict] = _NOT_PROVIDED,
                 jurisdiction_id: int = _NOT_PROVIDED, chambers: str = _NOT_PROVIDED,
                 courtroom_number: str = _NOT_PROVIDED, appointed_by: str = _NOT_PROVIDED,
                 appointed_date: str = _NOT_PROVIDED, initials: str = _NOT_PROVIDED,
                 status: str = _NOT_PROVIDED, notes: str = _NOT_PROVIDED) -> Optional[dict]:
    """Update a judge."""
    updates = []
    params = []

    if name is not _NOT_PROVIDED:
        updates.append("name = %s")
        params.append(name)

    if phones is not _NOT_PROVIDED:
        updates.append("phones = %s")
        params.append(json.dumps(phones) if phones else '[]')

    if emails is not _NOT_PROVIDED:
        updates.append("emails = %s")
        params.append(json.dumps(emails) if emails else '[]')

    if jurisdiction_id is not _NOT_PROVIDED:
        updates.append("jurisdiction_id = %s")
        params.append(jurisdiction_id)

    if chambers is not _NOT_PROVIDED:
        updates.append("chambers = %s")
        params.append(chambers)

    if courtroom_number is not _NOT_PROVIDED:
        updates.append("courtroom_number = %s")
        params.append(courtroom_number)

    if appointed_by is not _NOT_PROVIDED:
        updates.append("appointed_by = %s")
        params.append(appointed_by)

    if appointed_date is not _NOT_PROVIDED:
        updates.append("appointed_date = %s")
        params.append(appointed_date)

    if initials is not _NOT_PROVIDED:
        updates.append("initials = %s")
        params.append(initials)

    if status is not _NOT_PROVIDED:
        updates.append("status = %s")
        params.append(status)

    if notes is not _NOT_PROVIDED:
        updates.append("notes = %s")
        params.append(notes)

    if not updates:
        return get_judge_by_id(judge_id)

    updates.append("updated_at = CURRENT_TIMESTAMP")
    params.append(judge_id)

    with get_cursor() as cur:
        cur.execute(f"""
            UPDATE judges SET {', '.join(updates)}
            WHERE id = %s
            RETURNING id
        """, params)
        row = cur.fetchone()
        if not row:
            return None

    return get_judge_by_id(judge_id)


def delete_judge(judge_id: int) -> dict:
    """Delete a judge if not assigned to any proceedings.

    Returns dict with 'success' and 'error' keys.
    """
    with get_cursor() as cur:
        # Check if judge is assigned to any proceedings
        cur.execute("SELECT COUNT(*) as count FROM proceeding_judges WHERE judge_id = %s", (judge_id,))
        count = cur.fetchone()["count"]
        if count > 0:
            return {
                "success": False,
                "error": f"Cannot delete judge: assigned to {count} proceeding(s)"
            }

        cur.execute("DELETE FROM judges WHERE id = %s", (judge_id,))
        if cur.rowcount == 0:
            return {"success": False, "error": "Judge not found"}

        return {"success": True}


# ============================================================================
# Proceeding-Judge Junction Table Operations
# ============================================================================

def add_judge_to_proceeding(proceeding_id: int, judge_id: int, role: str = "Judge",
                            sort_order: int = None) -> dict:
    """Add a judge to a proceeding."""
    with get_cursor() as cur:
        # Determine sort_order if not provided
        if sort_order is None:
            cur.execute("""
                SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order
                FROM proceeding_judges WHERE proceeding_id = %s
            """, (proceeding_id,))
            sort_order = cur.fetchone()["next_order"]

        cur.execute("""
            INSERT INTO proceeding_judges (proceeding_id, judge_id, role, sort_order)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (proceeding_id, judge_id) DO UPDATE SET
                role = EXCLUDED.role, sort_order = EXCLUDED.sort_order
            RETURNING id, proceeding_id, judge_id, role, sort_order, created_at
        """, (proceeding_id, judge_id, role, sort_order))
        row = cur.fetchone()

        # Get judge name
        cur.execute("SELECT name FROM judges WHERE id = %s", (judge_id,))
        judge = cur.fetchone()

        return serialize_row({
            **dict(row),
            "name": judge["name"] if judge else None
        })


def remove_judge_from_proceeding(proceeding_id: int, judge_id: int) -> bool:
    """Remove a judge from a proceeding."""
    with get_cursor() as cur:
        cur.execute("""
            DELETE FROM proceeding_judges
            WHERE proceeding_id = %s AND judge_id = %s
        """, (proceeding_id, judge_id))
        return cur.rowcount > 0


def get_proceeding_judges(proceeding_id: int) -> List[dict]:
    """Get all judges for a proceeding."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT pj.id, pj.proceeding_id, pj.judge_id, pj.role, pj.sort_order, pj.created_at,
                   j.name as judge_name, j.jurisdiction_id, jur.name as jurisdiction_name
            FROM proceeding_judges pj
            JOIN judges j ON pj.judge_id = j.id
            LEFT JOIN jurisdictions jur ON j.jurisdiction_id = jur.id
            WHERE pj.proceeding_id = %s
            ORDER BY pj.sort_order, pj.id
        """, (proceeding_id,))
        return serialize_rows([{
            **dict(row),
            "name": row["judge_name"]
        } for row in cur.fetchall()])


def update_proceeding_judge(proceeding_id: int, judge_id: int, role: str = _NOT_PROVIDED,
                            sort_order: int = _NOT_PROVIDED) -> Optional[dict]:
    """Update a judge's role or sort_order on a proceeding."""
    updates = []
    params = []

    if role is not _NOT_PROVIDED:
        updates.append("role = %s")
        params.append(role)

    if sort_order is not _NOT_PROVIDED:
        updates.append("sort_order = %s")
        params.append(sort_order)

    if not updates:
        return None

    params.extend([proceeding_id, judge_id])

    with get_cursor() as cur:
        cur.execute(f"""
            UPDATE proceeding_judges SET {', '.join(updates)}
            WHERE proceeding_id = %s AND judge_id = %s
            RETURNING id, proceeding_id, judge_id, role, sort_order, created_at
        """, params)
        row = cur.fetchone()
        if not row:
            return None

        # Get judge name
        cur.execute("SELECT name FROM judges WHERE id = %s", (judge_id,))
        judge = cur.fetchone()

        return serialize_row({
            **dict(row),
            "name": judge["name"] if judge else None
        })
