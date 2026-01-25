"""
Case CRUD operations.
"""

import json
from typing import Optional, List

from .connection import get_cursor, serialize_row, serialize_rows
from .validation import validate_case_status, validate_date_format


def get_all_cases(status_filter: Optional[str] = None, limit: int = None,
                  offset: int = None) -> dict:
    """Get all cases with optional status filter."""
    conditions = []
    params = []

    if status_filter:
        validate_case_status(status_filter)
        conditions.append("c.status = %s")
        params.append(status_filter)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with get_cursor() as cur:
        # Get total count
        cur.execute(f"SELECT COUNT(*) as total FROM cases c {where_clause}", params)
        total = cur.fetchone()["total"]

        # Build query with joins for counts and assigned judge
        query = f"""
            SELECT c.id, c.case_name, c.short_name, c.status, c.print_code,
                   (SELECT p.name FROM case_persons cp
                    JOIN persons p ON cp.person_id = p.id
                    WHERE cp.case_id = c.id AND cp.role = 'Judge'
                    LIMIT 1) as judge,
                   (SELECT COUNT(*) FROM case_persons cp WHERE cp.case_id = c.id AND cp.role = 'Client') as client_count,
                   (SELECT COUNT(*) FROM case_persons cp WHERE cp.case_id = c.id AND cp.role = 'Defendant') as defendant_count,
                   (SELECT COUNT(*) FROM tasks t WHERE t.case_id = c.id AND t.status = 'Pending') as pending_task_count,
                   (SELECT COUNT(*) FROM events e WHERE e.case_id = c.id AND e.date >= CURRENT_DATE) as upcoming_event_count
            FROM cases c
            {where_clause}
            ORDER BY c.case_name
        """

        if limit:
            query += f" LIMIT {limit}"
        if offset:
            query += f" OFFSET {offset}"

        cur.execute(query, params)
        cases = [dict(row) for row in cur.fetchall()]

    return {"cases": cases, "total": total}


def get_case_by_id(case_id: int) -> Optional[dict]:
    """Get full case details by ID with all related data."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT c.*
            FROM cases c
            WHERE c.id = %s
        """, (case_id,))
        case = cur.fetchone()
        if not case:
            return None

        result = serialize_row(dict(case))

        # Parse case_numbers JSONB
        if result.get("case_numbers"):
            case_nums = result["case_numbers"]
            if isinstance(case_nums, str):
                case_nums = json.loads(case_nums)
            result["case_numbers"] = case_nums
        else:
            result["case_numbers"] = []

        # Get persons assigned to this case
        cur.execute("""
            SELECT p.id, p.person_type, p.name, p.phones, p.emails, p.organization,
                   p.attributes, p.notes as person_notes,
                   cp.id as assignment_id, cp.role, cp.side, cp.case_attributes,
                   cp.case_notes, cp.is_primary, cp.contact_via_person_id,
                   cp.assigned_date, cp.created_at as assigned_at,
                   via.name as contact_via_name
            FROM persons p
            JOIN case_persons cp ON p.id = cp.person_id
            LEFT JOIN persons via ON cp.contact_via_person_id = via.id
            WHERE cp.case_id = %s
            ORDER BY
                CASE cp.role
                    WHEN 'Client' THEN 1
                    WHEN 'Defendant' THEN 2
                    ELSE 3
                END,
                p.name
        """, (case_id,))
        result["persons"] = serialize_rows([dict(row) for row in cur.fetchall()])

        # Get activities
        cur.execute("""
            SELECT id, date, description, type, minutes
            FROM activities WHERE case_id = %s ORDER BY date DESC
        """, (case_id,))
        result["activities"] = serialize_rows([dict(row) for row in cur.fetchall()])

        # Get events (calendar events: hearings, depositions, filing deadlines, etc.)
        cur.execute("""
            SELECT id, date, time, location, description, document_link, calculation_note, starred
            FROM events WHERE case_id = %s ORDER BY date
        """, (case_id,))
        result["events"] = serialize_rows([dict(row) for row in cur.fetchall()])

        # Get tasks
        cur.execute("""
            SELECT t.id, t.due_date, t.completion_date, t.description, t.status, t.urgency, t.event_id, t.sort_order,
                   e.description as event_description
            FROM tasks t
            LEFT JOIN events e ON t.event_id = e.id
            WHERE t.case_id = %s ORDER BY t.sort_order ASC
        """, (case_id,))
        result["tasks"] = serialize_rows([dict(row) for row in cur.fetchall()])

        # Get notes
        cur.execute("""
            SELECT id, content, created_at, updated_at
            FROM notes WHERE case_id = %s ORDER BY created_at DESC
        """, (case_id,))
        result["notes"] = serialize_rows([dict(row) for row in cur.fetchall()])

        # Get proceedings
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
                FROM judges pj
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

        result["proceedings"] = serialize_rows(proceedings)

        return result


def get_case_by_name(case_name: str) -> Optional[dict]:
    """Get case by name."""
    with get_cursor() as cur:
        cur.execute("SELECT id FROM cases WHERE case_name = %s", (case_name,))
        case = cur.fetchone()
        if not case:
            return None
        return get_case_by_id(case["id"])


def get_all_case_names() -> List[str]:
    """Get list of all case names."""
    with get_cursor() as cur:
        cur.execute("SELECT case_name FROM cases ORDER BY case_name")
        return [row["case_name"] for row in cur.fetchall()]


def create_case(case_name: str, status: str = "Signing Up",
                print_code: str = None, case_summary: str = None, result: str = None,
                date_of_injury: str = None, case_numbers: List[dict] = None,
                short_name: str = None) -> dict:
    """Create a new case."""
    validate_case_status(status)
    validate_date_format(date_of_injury, "date_of_injury")
    case_numbers_json = json.dumps(case_numbers) if case_numbers else '[]'

    # Default short_name to first word of case_name
    if short_name is None:
        short_name = case_name.split()[0] if case_name else None

    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO cases (case_name, short_name, status, print_code, case_summary, result, date_of_injury, case_numbers)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (case_name, short_name, status, print_code, case_summary, result, date_of_injury, case_numbers_json))
        case_id = cur.fetchone()["id"]

    return get_case_by_id(case_id)


def update_case(case_id: int, **kwargs) -> Optional[dict]:
    """Update case fields."""
    allowed_fields = [
        "case_name", "short_name", "status", "print_code",
        "case_summary", "result", "date_of_injury", "case_numbers"
    ]

    updates = []
    params = []

    for field, value in kwargs.items():
        if field not in allowed_fields:
            continue
        if value is None:
            continue

        if field == "status":
            validate_case_status(value)
        elif field == "date_of_injury":
            validate_date_format(value, field)
        elif field == "case_numbers":
            value = json.dumps(value) if isinstance(value, list) else value

        updates.append(f"{field} = %s")
        params.append(value)

    if not updates:
        return get_case_by_id(case_id)

    updates.append("updated_at = CURRENT_TIMESTAMP")
    params.append(case_id)

    with get_cursor() as cur:
        cur.execute(f"""
            UPDATE cases SET {', '.join(updates)}
            WHERE id = %s
            RETURNING id
        """, params)
        row = cur.fetchone()
        if not row:
            return None

    return get_case_by_id(case_id)


def delete_case(case_id: int) -> bool:
    """Delete a case and all related data."""
    with get_cursor() as cur:
        cur.execute("DELETE FROM cases WHERE id = %s", (case_id,))
        return cur.rowcount > 0


def search_cases(query: str = None, case_number: str = None, person_name: str = None,
                 status: str = None, limit: int = 50) -> List[dict]:
    """Search cases by various criteria."""
    conditions = []
    params = []

    if query:
        conditions.append("(c.case_name ILIKE %s OR c.case_summary ILIKE %s)")
        params.extend([f"%{query}%", f"%{query}%"])

    if case_number:
        conditions.append("c.case_numbers::text ILIKE %s")
        params.append(f"%{case_number}%")

    if person_name:
        conditions.append("""
            EXISTS (
                SELECT 1 FROM case_persons cp
                JOIN persons p ON cp.person_id = p.id
                WHERE cp.case_id = c.id AND p.name ILIKE %s
            )
        """)
        params.append(f"%{person_name}%")

    if status:
        validate_case_status(status)
        conditions.append("c.status = %s")
        params.append(status)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with get_cursor() as cur:
        cur.execute(f"""
            SELECT c.id, c.case_name, c.short_name, c.status, c.case_summary,
                   c.case_numbers
            FROM cases c
            {where_clause}
            ORDER BY c.case_name
            LIMIT %s
        """, params + [limit])

        results = []
        for row in cur.fetchall():
            r = dict(row)
            if r.get("case_numbers") and isinstance(r["case_numbers"], str):
                r["case_numbers"] = json.loads(r["case_numbers"])
            results.append(r)
        return results


def get_dashboard_stats() -> dict:
    """Get dashboard statistics."""
    with get_cursor() as cur:
        # Total cases
        cur.execute("SELECT COUNT(*) as total FROM cases")
        total_cases = cur.fetchone()["total"]

        # Active cases (not Closed or Settl. Pend.)
        cur.execute("""
            SELECT COUNT(*) as active FROM cases
            WHERE status NOT IN ('Closed', 'Settl. Pend.')
        """)
        active_cases = cur.fetchone()["active"]

        # Pending tasks
        cur.execute("SELECT COUNT(*) as pending FROM tasks WHERE status = 'Pending'")
        pending_tasks = cur.fetchone()["pending"]

        # Upcoming events (next 30 days)
        cur.execute("""
            SELECT COUNT(*) as upcoming FROM events
            WHERE date >= CURRENT_DATE AND date <= CURRENT_DATE + 30
        """)
        upcoming_events = cur.fetchone()["upcoming"]

        # Cases by status
        cur.execute("""
            SELECT status, COUNT(*) as count FROM cases
            GROUP BY status ORDER BY count DESC
        """)
        cases_by_status = {row["status"]: row["count"] for row in cur.fetchall()}

        return {
            "total_cases": total_cases,
            "active_cases": active_cases,
            "pending_tasks": pending_tasks,
            "upcoming_events": upcoming_events,
            "cases_by_status": cases_by_status
        }
