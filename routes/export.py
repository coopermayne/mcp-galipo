"""
Data export API route.

Provides endpoints to export case data as JSON, PDF, or DOCX.
"""

import json
import asyncio
import traceback
import logging
from collections import defaultdict
from datetime import datetime, date, time
from decimal import Decimal
from uuid import UUID
from fastapi.responses import Response
import auth
from db.connection import get_cursor
from services.pdf_generator import generate_case_list_pdf
from services.docx_generator import generate_case_list_docx

logger = logging.getLogger(__name__)


def json_serializer(obj):
    """Default handler for json.dumps to catch non-serializable types."""
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, time):
        return obj.strftime("%H:%M")
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, UUID):
        return str(obj)
    if isinstance(obj, bytes):
        return obj.decode("utf-8", errors="replace")
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


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


def get_all_cases_with_data(exclude_closed: bool = False, user_id: int = None) -> list:
    """
    Get all cases with their complete related data.

    Optimized to use batch queries instead of N+1 pattern.

    Args:
        exclude_closed: If True, excludes cases with status 'Closed'.
        user_id: If set, only returns cases where this user is assigned as attorney or paralegal.
    """
    with get_cursor() as cur:
        # 1. Get all cases
        conditions = []
        params = []
        if exclude_closed:
            conditions.append("status != 'Closed'")
        if user_id:
            conditions.append("(%s = ANY(attorney_ids) OR %s = ANY(paralegal_ids))")
            params.extend([user_id, user_id])
        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        cur.execute(f"""
            SELECT id, case_name, short_name, status, print_code, case_summary,
                   result, date_of_injury, color, attorney_ids, paralegal_ids,
                   created_at, updated_at
            FROM cases
            {where}
            ORDER BY case_name
        """, params if params else None)
        cases = [dict(row) for row in cur.fetchall()]

        if not cases:
            return []

        case_ids = [c["id"] for c in cases]

        # Collect all user IDs referenced by attorney_ids/paralegal_ids for resolution
        all_user_ids = set()
        for c in cases:
            all_user_ids.update(c.get("attorney_ids") or [])
            all_user_ids.update(c.get("paralegal_ids") or [])

        # 2. Batch fetch all persons for all cases (unified roles schema)
        cur.execute("""
            SELECT pr.case_id,
                   p.id as person_id, p.name, p.phones, p.emails,
                   p.address, p.organization, p.notes as person_notes, p.archived,
                   pr.id as assignment_id, pr.role_id, pr.attributes as role_attributes,
                   pr.notes as role_notes, pr.is_primary, pr.grouped_under_id,
                   pr.assigned_date, pr.created_at as assigned_at,
                   r.name as role_name, r.category as role_category,
                   via.name as grouped_under_name
            FROM persons p
            JOIN person_roles pr ON p.id = pr.person_id
            JOIN roles r ON pr.role_id = r.id
            LEFT JOIN persons via ON pr.grouped_under_id = via.id
            WHERE pr.case_id = ANY(%s)
            ORDER BY pr.case_id, r.category, r.sort_order, p.name
        """, (case_ids,))
        persons_by_case = defaultdict(list)
        for row in cur.fetchall():
            row_dict = dict(row)
            case_id = row_dict.pop("case_id")
            # Nest role as an object (matching db/persons.py pattern)
            row_dict["role"] = {
                "id": row_dict.pop("role_id"),
                "name": row_dict.pop("role_name"),
                "category": row_dict.pop("role_category"),
            }
            persons_by_case[case_id].append(serialize_row(row_dict))

        # 3. Batch fetch all tasks for all cases (with linked event details + assignee)
        cur.execute("""
            SELECT t.case_id, t.id, t.due_date, t.completion_date, t.description,
                   t.status, t.urgency, t.event_id, t.sort_order, t.assignee_id,
                   t.created_at,
                   e.date as linked_event_date, e.time as linked_event_time,
                   e.description as linked_event_description,
                   e.location as linked_event_location,
                   u.first_name as assignee_first_name,
                   u.last_name as assignee_last_name,
                   u.initials as assignee_initials
            FROM tasks t
            LEFT JOIN events e ON t.event_id = e.id
            LEFT JOIN users u ON t.assignee_id = u.id
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
            # Nest assignee details if present
            if row_dict.get("assignee_id"):
                row_dict["assignee"] = {
                    "id": row_dict["assignee_id"],
                    "first_name": row_dict.pop("assignee_first_name"),
                    "last_name": row_dict.pop("assignee_last_name"),
                    "initials": row_dict.pop("assignee_initials"),
                }
            else:
                row_dict.pop("assignee_first_name", None)
                row_dict.pop("assignee_last_name", None)
                row_dict.pop("assignee_initials", None)
            tasks_by_case[case_id].append(serialize_row(row_dict))

        # 4. Batch fetch all events for all cases
        cur.execute("""
            SELECT case_id, id, date, time, location, description, document_link,
                   calculation_note, starred, attendee_ids, created_at
            FROM events
            WHERE case_id = ANY(%s)
            ORDER BY case_id, date
        """, (case_ids,))
        events_by_case = defaultdict(list)
        for row in cur.fetchall():
            row_dict = dict(row)
            case_id = row_dict.pop("case_id")
            # Collect user IDs from attendees
            all_user_ids.update(row_dict.get("attendee_ids") or [])
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
                   p.is_primary, p.notes, p.courtlistener_docket_id, p.pacer_case_id,
                   p.created_at, p.updated_at,
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

        # 8. Batch fetch all judges for all proceedings (new proceeding_judges schema)
        judges_by_proceeding = defaultdict(list)
        if all_proceeding_ids:
            cur.execute("""
                SELECT pj.proceeding_id, pj.judge_id, pj.role, pj.sort_order,
                       pj.created_at,
                       j.name as judge_name, j.jurisdiction_id, j.initials as judge_initials
                FROM proceeding_judges pj
                JOIN judges j ON pj.judge_id = j.id
                WHERE pj.proceeding_id = ANY(%s)
                ORDER BY pj.proceeding_id, pj.sort_order, pj.id
            """, (all_proceeding_ids,))
            for row in cur.fetchall():
                pid = row["proceeding_id"]
                judges_by_proceeding[pid].append(serialize_row({
                    "judge_id": row["judge_id"],
                    "name": row["judge_name"],
                    "initials": row["judge_initials"],
                    "role": row["role"],
                    "sort_order": row["sort_order"],
                    "created_at": row["created_at"]
                }))

        # 9. Batch fetch users referenced by attorney_ids/paralegal_ids/assignee_ids
        users_by_id = {}
        if all_user_ids:
            cur.execute("""
                SELECT id, email, first_name, last_name, initials, position
                FROM users
                WHERE id = ANY(%s)
            """, (list(all_user_ids),))
            for row in cur.fetchall():
                users_by_id[row["id"]] = serialize_row(dict(row))

        # Assemble the results
        result = []
        for case_row in cases:
            case_id = case_row["id"]
            case_data = serialize_row(case_row)

            # Resolve attorney_ids and paralegal_ids to user objects
            case_data["attorneys"] = [
                users_by_id[uid] for uid in (case_data.get("attorney_ids") or [])
                if uid in users_by_id
            ]
            case_data["paralegals"] = [
                users_by_id[uid] for uid in (case_data.get("paralegal_ids") or [])
                if uid in users_by_id
            ]

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


def get_complete_export_data() -> dict:
    """Get full export data including cases and reference data."""
    cases = get_all_cases_with_data()

    with get_cursor() as cur:
        # Reference data: users (excluding password_hash)
        cur.execute("""
            SELECT id, email, first_name, last_name, initials, bar_number,
                   position, is_admin, is_active, paralegal_id, created_at, updated_at
            FROM users
            ORDER BY last_name, first_name
        """)
        users = [serialize_row(dict(row)) for row in cur.fetchall()]

        # Reference data: roles
        cur.execute("""
            SELECT id, name, category, sort_order, description
            FROM roles
            ORDER BY category, sort_order
        """)
        roles = [serialize_row(dict(row)) for row in cur.fetchall()]

        # Reference data: jurisdictions
        cur.execute("""
            SELECT id, name, local_rules_link, notes, created_at
            FROM jurisdictions
            ORDER BY name
        """)
        jurisdictions = [serialize_row(dict(row)) for row in cur.fetchall()]

        # Reference data: judges
        cur.execute("""
            SELECT j.id, j.name, j.phones, j.emails, j.jurisdiction_id,
                   j.chambers, j.courtroom_number, j.appointed_by, j.appointed_date,
                   j.initials, j.status, j.notes, j.created_at, j.updated_at,
                   jur.name as jurisdiction_name
            FROM judges j
            LEFT JOIN jurisdictions jur ON j.jurisdiction_id = jur.id
            ORDER BY j.name
        """)
        judges = [serialize_row(dict(row)) for row in cur.fetchall()]

    return {
        "exported_at": datetime.now().isoformat(),
        "version": "2.0",
        "cases": cases,
        "reference_data": {
            "users": users,
            "roles": roles,
            "jurisdictions": jurisdictions,
            "judges": judges,
        },
    }


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

        elif format_type == "docx":
            user = auth.get_current_user(request)
            attorney_name = "Attorney"
            user_id = None
            if user:
                attorney_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip() or "Attorney"
                user_id = user.get("id")
            cases = await asyncio.to_thread(get_all_cases_with_data, exclude_closed=True, user_id=user_id)
            try:
                docx_buf = await asyncio.to_thread(generate_case_list_docx, cases, attorney_name=attorney_name)
            except Exception as e:
                return Response(
                    content=json.dumps({"error": {"message": f"DOCX generation failed: {e}", "code": "EXPORT_ERROR"}}),
                    status_code=500,
                    media_type="application/json",
                )
            filename = f"galipo_cases_{timestamp}.docx"
            return Response(
                content=docx_buf.getvalue(),
                media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                headers={"Content-Disposition": f'attachment; filename="{filename}"'},
            )

        # Default: JSON export (all cases + reference data)
        try:
            data = await asyncio.to_thread(get_complete_export_data)
        except Exception as e:
            logger.error("JSON export failed:\n%s", traceback.format_exc())
            return Response(
                content=json.dumps({"error": {"message": f"Export failed: {e}", "code": "EXPORT_ERROR"}}),
                status_code=500,
                media_type="application/json",
            )

        filename = f"galipo_export_{timestamp}.json"
        content = json.dumps(data, indent=2, default=json_serializer)
        return Response(
            content=content,
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
