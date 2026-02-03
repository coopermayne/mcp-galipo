"""
Data export API route.

Provides endpoints to export case data as JSON or PDF.
"""

import json
import asyncio
from collections import defaultdict
from datetime import datetime, date, time
from fastapi.responses import Response
import auth
from db.connection import get_cursor
from services.pdf_generator import generate_case_list_pdf


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


def get_all_cases_with_data(exclude_closed: bool = False) -> list:
    """
    Get all cases with their complete related data.

    Optimized to use batch queries instead of N+1 pattern.
    Total queries: ~7 regardless of case count.

    Args:
        exclude_closed: If True, excludes cases with status 'Closed'.
    """
    with get_cursor() as cur:
        # 1. Get all cases
        where = "WHERE status != 'Closed'" if exclude_closed else ""
        cur.execute(f"""
            SELECT id, case_name, short_name, status, print_code, case_summary,
                   result, date_of_injury, created_at, updated_at
            FROM cases
            {where}
            ORDER BY case_name
        """)
        cases = [dict(row) for row in cur.fetchall()]

        if not cases:
            return []

        case_ids = [c["id"] for c in cases]

        # 2. Batch fetch all persons for all cases
        cur.execute("""
            SELECT cp.case_id,
                   p.id as person_id, p.person_type, p.name, p.phones, p.emails,
                   p.address, p.organization, p.attributes, p.notes as person_notes,
                   p.archived,
                   cp.id as assignment_id, cp.role, cp.side, cp.case_attributes,
                   cp.case_notes, cp.is_primary, cp.grouped_under_id,
                   cp.assigned_date, cp.created_at as assigned_at,
                   via.name as grouped_under_name
            FROM persons p
            JOIN case_persons cp ON p.id = cp.person_id
            LEFT JOIN persons via ON cp.grouped_under_id = via.id
            WHERE cp.case_id = ANY(%s)
            ORDER BY cp.case_id,
                CASE cp.role
                    WHEN 'Client' THEN 1
                    WHEN 'Defendant' THEN 2
                    ELSE 3
                END,
                p.name
        """, (case_ids,))
        persons_by_case = defaultdict(list)
        for row in cur.fetchall():
            row_dict = dict(row)
            case_id = row_dict.pop("case_id")
            persons_by_case[case_id].append(serialize_row(row_dict))

        # 3. Batch fetch all tasks for all cases (with linked event details)
        cur.execute("""
            SELECT t.case_id, t.id, t.due_date, t.completion_date, t.description,
                   t.status, t.urgency, t.event_id, t.sort_order, t.created_at,
                   e.date as linked_event_date, e.time as linked_event_time,
                   e.description as linked_event_description,
                   e.location as linked_event_location
            FROM tasks t
            LEFT JOIN events e ON t.event_id = e.id
            WHERE t.case_id = ANY(%s)
            ORDER BY t.case_id, t.sort_order ASC
        """, (case_ids,))
        tasks_by_case = defaultdict(list)
        for row in cur.fetchall():
            row_dict = dict(row)
            case_id = row_dict.pop("case_id")
            # Nest linked event details if present
            if row_dict.get("event_id"):
                row_dict["linked_event"] = {
                    "id": row_dict["event_id"],
                    "date": serialize_value(row_dict.pop("linked_event_date")),
                    "time": serialize_value(row_dict.pop("linked_event_time")),
                    "description": row_dict.pop("linked_event_description"),
                    "location": row_dict.pop("linked_event_location"),
                }
            else:
                row_dict.pop("linked_event_date", None)
                row_dict.pop("linked_event_time", None)
                row_dict.pop("linked_event_description", None)
                row_dict.pop("linked_event_location", None)
            tasks_by_case[case_id].append(serialize_row(row_dict))

        # 4. Batch fetch all events for all cases
        cur.execute("""
            SELECT case_id, id, date, time, location, description, document_link,
                   calculation_note, starred, created_at
            FROM events
            WHERE case_id = ANY(%s)
            ORDER BY case_id, date
        """, (case_ids,))
        events_by_case = defaultdict(list)
        for row in cur.fetchall():
            row_dict = dict(row)
            case_id = row_dict.pop("case_id")
            events_by_case[case_id].append(serialize_row(row_dict))

        # 5. Batch fetch all notes for all cases
        cur.execute("""
            SELECT case_id, id, content, created_at, updated_at
            FROM notes
            WHERE case_id = ANY(%s)
            ORDER BY case_id, created_at DESC
        """, (case_ids,))
        notes_by_case = defaultdict(list)
        for row in cur.fetchall():
            row_dict = dict(row)
            case_id = row_dict.pop("case_id")
            notes_by_case[case_id].append(serialize_row(row_dict))

        # 6. Batch fetch all activities for all cases
        cur.execute("""
            SELECT case_id, id, date, description, type, minutes, created_at
            FROM activities
            WHERE case_id = ANY(%s)
            ORDER BY case_id, date DESC
        """, (case_ids,))
        activities_by_case = defaultdict(list)
        for row in cur.fetchall():
            row_dict = dict(row)
            case_id = row_dict.pop("case_id")
            activities_by_case[case_id].append(serialize_row(row_dict))

        # 7. Batch fetch all proceedings for all cases (with full jurisdiction details)
        cur.execute("""
            SELECT p.case_id, p.id, p.case_number, p.jurisdiction_id, p.sort_order,
                   p.is_primary, p.notes, p.created_at, p.updated_at,
                   j.name as jurisdiction_name, j.local_rules_link,
                   j.notes as jurisdiction_notes
            FROM proceedings p
            LEFT JOIN jurisdictions j ON p.jurisdiction_id = j.id
            WHERE p.case_id = ANY(%s)
            ORDER BY p.case_id, p.sort_order, p.id
        """, (case_ids,))
        proceedings_by_case = defaultdict(list)
        all_proceeding_ids = []
        for row in cur.fetchall():
            row_dict = dict(row)
            case_id = row_dict.pop("case_id")
            all_proceeding_ids.append(row_dict["id"])
            proceedings_by_case[case_id].append(row_dict)

        # 8. Batch fetch all judges for all proceedings
        judges_by_proceeding = defaultdict(list)
        if all_proceeding_ids:
            cur.execute("""
                SELECT pj.proceeding_id, pj.person_id, pj.role, pj.sort_order,
                       pj.created_at, per.name as judge_name
                FROM judges pj
                JOIN persons per ON pj.person_id = per.id
                WHERE pj.proceeding_id = ANY(%s)
                ORDER BY pj.proceeding_id, pj.sort_order, pj.id
            """, (all_proceeding_ids,))
            for row in cur.fetchall():
                pid = row["proceeding_id"]
                judges_by_proceeding[pid].append(serialize_row({
                    "person_id": row["person_id"],
                    "name": row["judge_name"],
                    "role": row["role"],
                    "sort_order": row["sort_order"],
                    "created_at": row["created_at"]
                }))

        # Assemble the results
        result = []
        for case_row in cases:
            case_id = case_row["id"]
            case_data = serialize_row(case_row)

            case_data["persons"] = persons_by_case.get(case_id, [])
            case_data["tasks"] = tasks_by_case.get(case_id, [])
            case_data["events"] = events_by_case.get(case_id, [])
            case_data["notes"] = notes_by_case.get(case_id, [])
            case_data["activities"] = activities_by_case.get(case_id, [])

            # Add judges to proceedings
            proceedings = proceedings_by_case.get(case_id, [])
            for p in proceedings:
                p["judges"] = judges_by_proceeding.get(p["id"], [])
            case_data["proceedings"] = [serialize_row(p) for p in proceedings]

            result.append(case_data)

        return result


def register_export_routes(mcp):
    """Register data export routes."""

    @mcp.custom_route("/api/v1/export", methods=["GET"])
    async def api_export_data(request):
        """Export case data as JSON or PDF file."""
        if err := auth.require_auth(request):
            return err

        format_type = request.query_params.get("format", "json").lower()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        if format_type == "pdf":
            cases = await asyncio.to_thread(get_all_cases_with_data, exclude_closed=True)
            try:
                pdf_buf = await asyncio.to_thread(generate_case_list_pdf, cases)
            except Exception as e:
                return Response(
                    content=json.dumps({"error": {"message": f"PDF generation failed: {e}", "code": "EXPORT_ERROR"}}),
                    status_code=500,
                    media_type="application/json",
                )
            filename = f"galipo_cases_{timestamp}.pdf"
            return Response(
                content=pdf_buf.getvalue(),
                media_type="application/pdf",
                headers={"Content-Disposition": f'attachment; filename="{filename}"'},
            )

        # Default: JSON export (all cases)
        cases = await asyncio.to_thread(get_all_cases_with_data)

        data = {
            "exported_at": datetime.now().isoformat(),
            "version": "1.0",
            "cases": cases,
        }

        filename = f"galipo_export_{timestamp}.json"
        content = json.dumps(data, indent=2)
        return Response(
            content=content,
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
