"""
Data export API route.

Provides an endpoint to export all case data as JSON.
"""

import json
from datetime import datetime, date, time
from fastapi.responses import Response
import auth
from db.connection import get_cursor


def serialize_value(val):
    """Convert datetime/date/time objects to ISO format strings."""
    if isinstance(val, datetime):
        return val.isoformat()
    elif isinstance(val, date):
        return val.isoformat()
    elif isinstance(val, time):
        return val.strftime("%H:%M")
    return val


def serialize_row(row: dict) -> dict:
    """Serialize a database row, converting datetime objects to strings."""
    if row is None:
        return None
    return {k: serialize_value(v) for k, v in row.items()}


def get_all_cases_with_data() -> list:
    """Get all cases with their complete related data."""
    cases = []

    with get_cursor() as cur:
        # Get all cases
        cur.execute("""
            SELECT id, case_name, short_name, status, print_code, case_summary,
                   result, date_of_injury, case_numbers, created_at, updated_at
            FROM cases
            ORDER BY case_name
        """)
        case_rows = [dict(row) for row in cur.fetchall()]

        for case_row in case_rows:
            case_id = case_row["id"]
            case_data = serialize_row(case_row)

            # Parse case_numbers JSONB if it's a string
            if case_data.get("case_numbers") and isinstance(case_data["case_numbers"], str):
                case_data["case_numbers"] = json.loads(case_data["case_numbers"])

            # Get persons assigned to this case
            cur.execute("""
                SELECT p.id as person_id, p.person_type, p.name, p.phones, p.emails,
                       p.address, p.organization, p.attributes, p.notes as person_notes,
                       p.archived,
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
            case_data["persons"] = [serialize_row(dict(row)) for row in cur.fetchall()]

            # Get tasks
            cur.execute("""
                SELECT id, due_date, completion_date, description, status, urgency,
                       event_id, sort_order, created_at
                FROM tasks
                WHERE case_id = %s
                ORDER BY sort_order ASC
            """, (case_id,))
            case_data["tasks"] = [serialize_row(dict(row)) for row in cur.fetchall()]

            # Get events
            cur.execute("""
                SELECT id, date, time, location, description, document_link,
                       calculation_note, starred, created_at
                FROM events
                WHERE case_id = %s
                ORDER BY date
            """, (case_id,))
            case_data["events"] = [serialize_row(dict(row)) for row in cur.fetchall()]

            # Get notes
            cur.execute("""
                SELECT id, content, created_at, updated_at
                FROM notes
                WHERE case_id = %s
                ORDER BY created_at DESC
            """, (case_id,))
            case_data["notes"] = [serialize_row(dict(row)) for row in cur.fetchall()]

            # Get activities
            cur.execute("""
                SELECT id, date, description, type, minutes, created_at
                FROM activities
                WHERE case_id = %s
                ORDER BY date DESC
            """, (case_id,))
            case_data["activities"] = [serialize_row(dict(row)) for row in cur.fetchall()]

            # Get proceedings with their judges
            cur.execute("""
                SELECT p.id, p.case_number, p.jurisdiction_id, p.sort_order,
                       p.is_primary, p.notes, p.created_at, p.updated_at,
                       j.name as jurisdiction_name, j.local_rules_link
                FROM proceedings p
                LEFT JOIN jurisdictions j ON p.jurisdiction_id = j.id
                WHERE p.case_id = %s
                ORDER BY p.sort_order, p.id
            """, (case_id,))
            proceedings = [dict(row) for row in cur.fetchall()]

            # Fetch judges for all proceedings
            if proceedings:
                proceeding_ids = [p["id"] for p in proceedings]
                cur.execute("""
                    SELECT pj.proceeding_id, pj.person_id, pj.role, pj.sort_order,
                           pj.created_at, per.name as judge_name
                    FROM judges pj
                    JOIN persons per ON pj.person_id = per.id
                    WHERE pj.proceeding_id = ANY(%s)
                    ORDER BY pj.sort_order, pj.id
                """, (proceeding_ids,))

                judges_by_proceeding = {}
                for row in cur.fetchall():
                    pid = row["proceeding_id"]
                    if pid not in judges_by_proceeding:
                        judges_by_proceeding[pid] = []
                    judges_by_proceeding[pid].append(serialize_row({
                        "person_id": row["person_id"],
                        "name": row["judge_name"],
                        "role": row["role"],
                        "sort_order": row["sort_order"],
                        "created_at": row["created_at"]
                    }))

                for p in proceedings:
                    p["judges"] = judges_by_proceeding.get(p["id"], [])

            case_data["proceedings"] = [serialize_row(p) for p in proceedings]

            cases.append(case_data)

    return cases


def register_export_routes(mcp):
    """Register data export routes."""

    @mcp.custom_route("/api/v1/export", methods=["GET"])
    async def api_export_data(request):
        """Export all case data as JSON file."""
        if err := auth.require_auth(request):
            return err

        data = {
            "exported_at": datetime.now().isoformat(),
            "version": "1.0",
            "cases": get_all_cases_with_data(),
        }

        # Generate filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"galipo_export_{timestamp}.json"

        # Return as downloadable JSON file
        content = json.dumps(data, indent=2)
        return Response(
            content=content,
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
