"""
Proceedings management functions.

A proceeding represents a court filing within a case. A single case (matter) can have
multiple proceedings across different courts (e.g., state court -> federal removal -> appeal).

Each proceeding can have multiple judges (for panels, magistrate+judge combos, etc.)
via the proceeding_judges junction table.
"""

from typing import Optional, List

from .connection import get_cursor, serialize_row, serialize_rows, _NOT_PROVIDED


def add_proceeding(case_id: int, case_number: str, jurisdiction_id: int = None,
                   sort_order: int = None, is_primary: bool = False,
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
            INSERT INTO proceedings (case_id, case_number, jurisdiction_id, sort_order, is_primary, notes)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id, case_id, case_number, jurisdiction_id, sort_order, is_primary, notes, created_at, updated_at
        """, (case_id, case_number, jurisdiction_id, sort_order, is_primary, notes))
        row = cur.fetchone()

        # Fetch with joined data
        return get_proceeding_by_id(row["id"])


def get_proceedings(case_id: int) -> List[dict]:
    """Get all proceedings for a case with their judges."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT p.id, p.case_id, p.case_number, p.jurisdiction_id,
                   p.sort_order, p.is_primary, p.notes, p.created_at, p.updated_at,
                   j.name as jurisdiction_name, j.local_rules_link
            FROM proceedings p
            LEFT JOIN jurisdictions j ON p.jurisdiction_id = j.id
            WHERE p.case_id = %s
            ORDER BY p.sort_order, p.id
        """, (case_id,))
        proceedings = [dict(row) for row in cur.fetchall()]

        # Fetch judges for all proceedings in one query
        if proceedings:
            proceeding_ids = [p["id"] for p in proceedings]
            cur.execute("""
                SELECT pj.proceeding_id, pj.person_id, pj.role, pj.sort_order,
                       per.name as judge_name
                FROM proceeding_judges pj
                JOIN persons per ON pj.person_id = per.id
                WHERE pj.proceeding_id = ANY(%s)
                ORDER BY pj.sort_order, pj.id
            """, (proceeding_ids,))

            # Group judges by proceeding_id
            judges_by_proceeding = {}
            for row in cur.fetchall():
                pid = row["proceeding_id"]
                if pid not in judges_by_proceeding:
                    judges_by_proceeding[pid] = []
                judges_by_proceeding[pid].append({
                    "person_id": row["person_id"],
                    "name": row["judge_name"],
                    "role": row["role"],
                    "sort_order": row["sort_order"]
                })

            # Attach judges to proceedings
            for p in proceedings:
                p["judges"] = judges_by_proceeding.get(p["id"], [])
                # For backwards compatibility, set judge_name from first judge
                if p["judges"]:
                    p["judge_name"] = p["judges"][0]["name"]
                    p["judge_id"] = p["judges"][0]["person_id"]
                else:
                    p["judge_name"] = None
                    p["judge_id"] = None

        return serialize_rows(proceedings)


def get_proceeding_by_id(proceeding_id: int) -> Optional[dict]:
    """Get a proceeding by ID with joined jurisdiction and judge data."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT p.id, p.case_id, p.case_number, p.jurisdiction_id,
                   p.sort_order, p.is_primary, p.notes, p.created_at, p.updated_at,
                   j.name as jurisdiction_name, j.local_rules_link
            FROM proceedings p
            LEFT JOIN jurisdictions j ON p.jurisdiction_id = j.id
            WHERE p.id = %s
        """, (proceeding_id,))
        row = cur.fetchone()
        if not row:
            return None

        proceeding = dict(row)

        # Fetch judges for this proceeding
        cur.execute("""
            SELECT pj.person_id, pj.role, pj.sort_order,
                   per.name as judge_name
            FROM proceeding_judges pj
            JOIN persons per ON pj.person_id = per.id
            WHERE pj.proceeding_id = %s
            ORDER BY pj.sort_order, pj.id
        """, (proceeding_id,))

        proceeding["judges"] = [{
            "person_id": r["person_id"],
            "name": r["judge_name"],
            "role": r["role"],
            "sort_order": r["sort_order"]
        } for r in cur.fetchall()]

        # For backwards compatibility
        if proceeding["judges"]:
            proceeding["judge_name"] = proceeding["judges"][0]["name"]
            proceeding["judge_id"] = proceeding["judges"][0]["person_id"]
        else:
            proceeding["judge_name"] = None
            proceeding["judge_id"] = None

        return serialize_row(proceeding)


def update_proceeding(proceeding_id: int, case_number: str = _NOT_PROVIDED,
                      jurisdiction_id: int = _NOT_PROVIDED,
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
    """Delete a proceeding (cascade deletes proceeding_judges)."""
    with get_cursor() as cur:
        cur.execute("DELETE FROM proceedings WHERE id = %s", (proceeding_id,))
        return cur.rowcount > 0


# ============================================================================
# Proceeding Judges Management
# ============================================================================

def add_judge_to_proceeding(proceeding_id: int, person_id: int, role: str = "Judge",
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
            INSERT INTO proceeding_judges (proceeding_id, person_id, role, sort_order)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (proceeding_id, person_id) DO UPDATE SET role = EXCLUDED.role, sort_order = EXCLUDED.sort_order
            RETURNING id, proceeding_id, person_id, role, sort_order, created_at
        """, (proceeding_id, person_id, role, sort_order))
        row = cur.fetchone()

        # Get judge name
        cur.execute("SELECT name FROM persons WHERE id = %s", (person_id,))
        person = cur.fetchone()

        return serialize_row({
            **dict(row),
            "name": person["name"] if person else None
        })


def remove_judge_from_proceeding(proceeding_id: int, person_id: int) -> bool:
    """Remove a judge from a proceeding."""
    with get_cursor() as cur:
        cur.execute("""
            DELETE FROM proceeding_judges
            WHERE proceeding_id = %s AND person_id = %s
        """, (proceeding_id, person_id))
        return cur.rowcount > 0


def get_proceeding_judges(proceeding_id: int) -> List[dict]:
    """Get all judges for a proceeding."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT pj.id, pj.proceeding_id, pj.person_id, pj.role, pj.sort_order, pj.created_at,
                   per.name as judge_name
            FROM proceeding_judges pj
            JOIN persons per ON pj.person_id = per.id
            WHERE pj.proceeding_id = %s
            ORDER BY pj.sort_order, pj.id
        """, (proceeding_id,))
        return serialize_rows([{
            **dict(row),
            "name": row["judge_name"]
        } for row in cur.fetchall()])


def update_proceeding_judge(proceeding_id: int, person_id: int, role: str = _NOT_PROVIDED,
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

    params.extend([proceeding_id, person_id])

    with get_cursor() as cur:
        cur.execute(f"""
            UPDATE proceeding_judges SET {', '.join(updates)}
            WHERE proceeding_id = %s AND person_id = %s
            RETURNING id, proceeding_id, person_id, role, sort_order, created_at
        """, params)
        row = cur.fetchone()
        if not row:
            return None

        # Get judge name
        cur.execute("SELECT name FROM persons WHERE id = %s", (person_id,))
        person = cur.fetchone()

        return serialize_row({
            **dict(row),
            "name": person["name"] if person else None
        })
