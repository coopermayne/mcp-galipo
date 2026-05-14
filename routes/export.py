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
from lib.tz import LA
from decimal import Decimal
from uuid import UUID
from fastapi.responses import Response
from sqlalchemy import text
import auth
import db
from db.session import SessionLocal
from services.pdf_generator import generate_case_list_pdf
from services.intake_pdf_generator import generate_intake_list_pdf, generate_intake_detail_pdf, generate_intake_batch_pdf
from services.docx_generator import generate_case_list_docx
from services.cost_report_generator import generate_cost_report_pdf
from services.case_list_report import generate_case_list_report
from routes.common import api_error

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


def strip_empty(obj):
    """Recursively remove keys whose values are None, empty list, empty dict, or empty string."""
    if isinstance(obj, dict):
        return {k: strip_empty(v) for k, v in obj.items()
                if v is not None and v != [] and v != {} and v != ""}
    if isinstance(obj, list):
        return [strip_empty(item) for item in obj]
    return obj


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
    with SessionLocal() as session:
        # 1. Get all cases
        conditions = []
        params = {}
        if exclude_closed:
            conditions.append("status != 'Closed'")
        if user_id:
            conditions.append("(:user_id = ANY(attorney_ids) OR :user_id = ANY(paralegal_ids))")
            params["user_id"] = user_id
        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        rows = session.execute(text(f"""
            SELECT id, case_name, short_name, status, print_code, case_summary,
                   result, date_of_injury, color, attorney_ids, paralegal_ids,
                   notes, created_at, updated_at
            FROM cases
            {where}
            ORDER BY case_name
        """), params or None).mappings().all()
        cases = [dict(row) for row in rows]

        if not cases:
            return []

        case_ids = [c["id"] for c in cases]

        # Collect all user IDs referenced by attorney_ids/paralegal_ids for resolution
        all_user_ids = set()
        for c in cases:
            all_user_ids.update(c.get("attorney_ids") or [])
            all_user_ids.update(c.get("paralegal_ids") or [])

        # 2. Batch fetch all persons for all cases (unified roles schema)
        rows = session.execute(text("""
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
            WHERE pr.case_id = ANY(:case_ids)
            ORDER BY pr.case_id, r.category, r.sort_order, p.name
        """), {"case_ids": case_ids}).mappings().all()
        persons_by_case = defaultdict(list)
        for row in rows:
            row_dict = dict(row)
            cid = row_dict.pop("case_id")
            # Flatten role info, drop all FK IDs
            row_dict["role"] = row_dict.pop("role_name")
            row_dict["role_category"] = row_dict.pop("role_category")
            row_dict.pop("role_id")
            row_dict.pop("grouped_under_id")
            row_dict.pop("assignment_id")
            # Rename person_id to just name context (keep for identification)
            row_dict["name"] = row_dict.pop("name")
            row_dict.pop("person_id")
            persons_by_case[cid].append(serialize_row(row_dict))

        # 3. Batch fetch all tasks for all cases (with linked event details + assignee)
        rows = session.execute(text("""
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
            WHERE t.case_id = ANY(:case_ids)
            ORDER BY t.case_id, t.sort_order ASC
        """), {"case_ids": case_ids}).mappings().all()
        tasks_by_case = defaultdict(list)
        for row in rows:
            row_dict = dict(row)
            cid = row_dict.pop("case_id")
            # Nest linked event details if present, drop raw event_id
            if row_dict.get("event_id"):
                row_dict["linked_event"] = {
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
            row_dict.pop("event_id")
            # Nest assignee details if present, drop raw assignee_id
            if row_dict.get("assignee_id"):
                row_dict["assignee"] = {
                    "first_name": row_dict.pop("assignee_first_name"),
                    "last_name": row_dict.pop("assignee_last_name"),
                    "initials": row_dict.pop("assignee_initials"),
                }
            else:
                row_dict.pop("assignee_first_name", None)
                row_dict.pop("assignee_last_name", None)
                row_dict.pop("assignee_initials", None)
            row_dict.pop("assignee_id")
            tasks_by_case[cid].append(serialize_row(row_dict))

        # 4. Batch fetch all events for all cases
        rows = session.execute(text("""
            SELECT case_id, id, date, time, location, description, document_link,
                   calculation_note, starred, attendee_ids, created_at
            FROM events
            WHERE case_id = ANY(:case_ids)
            ORDER BY case_id, date
        """), {"case_ids": case_ids}).mappings().all()
        events_by_case = defaultdict(list)
        for row in rows:
            row_dict = dict(row)
            cid = row_dict.pop("case_id")
            # Collect user IDs from attendees (resolved to objects later)
            all_user_ids.update(row_dict.get("attendee_ids") or [])
            events_by_case[cid].append(row_dict)

        # 5. Batch fetch all notes for all cases
        rows = session.execute(text("""
            SELECT case_id, id, content, created_at, updated_at
            FROM notes
            WHERE case_id = ANY(:case_ids)
            ORDER BY case_id, created_at DESC
        """), {"case_ids": case_ids}).mappings().all()
        notes_by_case = defaultdict(list)
        for row in rows:
            row_dict = dict(row)
            cid = row_dict.pop("case_id")
            notes_by_case[cid].append(serialize_row(row_dict))

        # 6. Batch fetch all proceedings for all cases (with full jurisdiction details)
        rows = session.execute(text("""
            SELECT p.case_id, p.id, p.case_number, p.jurisdiction_id, p.sort_order,
                   p.is_primary, p.notes, p.courtlistener_docket_id, p.pacer_case_id,
                   p.created_at, p.updated_at,
                   j.name as jurisdiction_name, j.local_rules_link,
                   j.notes as jurisdiction_notes
            FROM proceedings p
            LEFT JOIN jurisdictions j ON p.jurisdiction_id = j.id
            WHERE p.case_id = ANY(:case_ids)
            ORDER BY p.case_id, p.sort_order, p.id
        """), {"case_ids": case_ids}).mappings().all()
        proceedings_by_case = defaultdict(list)
        all_proceeding_ids = []
        for row in rows:
            row_dict = dict(row)
            cid = row_dict.pop("case_id")
            all_proceeding_ids.append(row_dict["id"])
            # Nest jurisdiction as object, drop raw jurisdiction_id
            row_dict["jurisdiction"] = {
                "name": row_dict.pop("jurisdiction_name"),
                "local_rules_link": row_dict.pop("local_rules_link"),
                "notes": row_dict.pop("jurisdiction_notes"),
            }
            row_dict.pop("jurisdiction_id")
            proceedings_by_case[cid].append(row_dict)

        # 8. Batch fetch all judges for all proceedings (new proceeding_judges schema)
        judges_by_proceeding = defaultdict(list)
        if all_proceeding_ids:
            rows = session.execute(text("""
                SELECT pj.proceeding_id, pj.judge_id, pj.role, pj.sort_order,
                       pj.created_at,
                       j.name as judge_name, j.jurisdiction_id, j.initials as judge_initials
                FROM proceeding_judges pj
                JOIN judges j ON pj.judge_id = j.id
                WHERE pj.proceeding_id = ANY(:proceeding_ids)
                ORDER BY pj.proceeding_id, pj.sort_order, pj.id
            """), {"proceeding_ids": all_proceeding_ids}).mappings().all()
            for row in rows:
                pid = row["proceeding_id"]
                judges_by_proceeding[pid].append(serialize_row({
                    "name": row["judge_name"],
                    "initials": row["judge_initials"],
                    "role": row["role"],
                }))

        # 9. Batch fetch users referenced by attorney_ids/paralegal_ids/attendee_ids
        users_by_id = {}
        if all_user_ids:
            rows = session.execute(text("""
                SELECT id, email, first_name, last_name, initials, position
                FROM users
                WHERE id = ANY(:user_ids)
            """), {"user_ids": list(all_user_ids)}).mappings().all()
            for row in rows:
                user = dict(row)
                uid = user.pop("id")
                users_by_id[uid] = serialize_row(user)

        # Assemble the results
        result = []
        for case_row in cases:
            cid = case_row["id"]
            case_data = serialize_row(case_row)

            # Resolve attorney_ids/paralegal_ids to full user objects, drop raw ID arrays
            case_data["attorneys"] = [
                users_by_id[uid] for uid in (case_data.get("attorney_ids") or [])
                if uid in users_by_id
            ]
            case_data["paralegals"] = [
                users_by_id[uid] for uid in (case_data.get("paralegal_ids") or [])
                if uid in users_by_id
            ]
            case_data.pop("attorney_ids", None)
            case_data.pop("paralegal_ids", None)

            case_data["persons"] = persons_by_case.get(cid, [])
            case_data["tasks"] = tasks_by_case.get(cid, [])

            # Resolve attendee_ids on events to full user objects
            raw_events = events_by_case.get(cid, [])
            for evt in raw_events:
                evt["attendees"] = [
                    users_by_id[uid] for uid in (evt.get("attendee_ids") or [])
                    if uid in users_by_id
                ]
                evt.pop("attendee_ids", None)
            case_data["events"] = [serialize_row(e) for e in raw_events]

            case_data["note_records"] = notes_by_case.get(cid, [])
            # Add judges to proceedings
            proceedings = proceedings_by_case.get(cid, [])
            for p in proceedings:
                p["judges"] = judges_by_proceeding.get(p["id"], [])
            case_data["proceedings"] = [serialize_row(p) for p in proceedings]

            result.append(case_data)

        return result


def get_complete_export_data() -> dict:
    """Get fully denormalized export — all IDs resolved to inline data."""
    cases = get_all_cases_with_data()
    return {
        "exported_at": datetime.now(LA).isoformat(),
        "version": "2.1",
        "total_cases": len(cases),
        "cases": cases,
    }


def register_export_routes(mcp):
    """Register data export routes."""

    @mcp.custom_route("/api/v1/export", methods=["GET"])
    async def api_export_data(request):
        """Export case data as JSON or PDF file."""
        if err := auth.require_auth(request):
            return err

        format_type = request.query_params.get("format", "json").lower()
        timestamp = datetime.now(LA).strftime("%Y%m%d_%H%M%S")

        if format_type == "pdf":
            user = auth.get_current_user(request)
            user_id = user.get("id") if user else None
            cases = await asyncio.to_thread(get_all_cases_with_data, exclude_closed=True, user_id=user_id)
            try:
                pdf_buf = await asyncio.to_thread(generate_case_list_pdf, cases)
            except Exception as e:
                return api_error(f"PDF generation failed: {e}", "EXPORT_ERROR", 500)
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
                return api_error(f"DOCX generation failed: {e}", "EXPORT_ERROR", 500)
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
            return api_error(f"Export failed: {e}", "EXPORT_ERROR", 500)

        filename = f"galipo_export_{timestamp}.json"
        data = strip_empty(data)
        content = json.dumps(data, indent=2, default=json_serializer)
        return Response(
            content=content,
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )

    @mcp.custom_route("/api/v1/cases/export/list-pdf", methods=["GET"])
    async def api_export_case_list_pdf(request):
        """Export active case list as a grouped PDF."""
        if err := auth.require_auth(request):
            return err

        group_by = request.query_params.get("group_by", "alphabetical")
        if group_by not in ("attorney", "status", "alphabetical"):
            return api_error("group_by must be attorney, status, or alphabetical", "INVALID_INPUT", 400)

        from db.cases import get_all_cases

        result = await asyncio.to_thread(get_all_cases, limit=5000)
        all_cases = result.get("cases", [])
        active_cases = [c for c in all_cases if c.get("status") != "Closed"]

        # Resolve attorney/paralegal user IDs to names
        user_ids = set()
        for c in active_cases:
            user_ids.update(c.get("attorney_ids") or [])

        users_map = {}
        if user_ids:
            with SessionLocal() as session:
                rows = session.execute(text(
                    "SELECT id, first_name, last_name, initials FROM users WHERE id = ANY(:ids)"
                ), {"ids": list(user_ids)}).mappings().all()
                for row in rows:
                    users_map[row["id"]] = dict(row)

        try:
            pdf_buf = await asyncio.to_thread(generate_case_list_report, active_cases, users_map, group_by)
        except Exception as e:
            logger.error("Case list PDF failed:\n%s", traceback.format_exc())
            return api_error(f"PDF generation failed: {e}", "EXPORT_ERROR", 500)

        timestamp = datetime.now(LA).strftime("%Y%m%d_%H%M%S")
        filename = f"case_list_{group_by}_{timestamp}.pdf"
        return Response(
            content=pdf_buf.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    @mcp.custom_route("/api/v1/intakes/export", methods=["GET"])
    async def api_export_intakes(request):
        """Export intake list as PDF."""
        if err := auth.require_auth(request):
            return err

        from db.intakes import get_intakes

        status = request.query_params.get("status")
        exclude_archived = status is None
        data = await asyncio.to_thread(
            get_intakes, status=status, limit=5000, exclude_archived=exclude_archived
        )
        intakes = data.get("intakes", [])

        try:
            pdf_buf = await asyncio.to_thread(generate_intake_list_pdf, intakes, status)
        except Exception as e:
            logger.error("Intake PDF generation failed:\n%s", traceback.format_exc())
            return api_error(f"PDF generation failed: {e}", "EXPORT_ERROR", 500)

        timestamp = datetime.now(LA).strftime("%Y%m%d_%H%M%S")
        filename = f"galipo_intakes_{timestamp}.pdf"
        return Response(
            content=pdf_buf.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    @mcp.custom_route("/api/v1/intakes/{intake_id}/export", methods=["GET"])
    async def api_export_intake_detail(request):
        """Export a single intake as PDF."""
        if err := auth.require_auth(request):
            return err

        from db.intakes import get_intake_by_id
        from db.intake_comments import get_intake_comments

        intake_id = int(request.path_params["intake_id"])
        intake = await asyncio.to_thread(get_intake_by_id, intake_id)
        if not intake:
            return api_error("Intake not found", "NOT_FOUND", 404)

        comments = await asyncio.to_thread(get_intake_comments, intake_id)

        try:
            pdf_buf = await asyncio.to_thread(generate_intake_detail_pdf, intake, comments)
        except Exception as e:
            logger.error("Intake detail PDF failed:\n%s", traceback.format_exc())
            return api_error(f"PDF generation failed: {e}", "EXPORT_ERROR", 500)

        name_slug = (intake.get("name") or "intake").replace(" ", "_")[:30]
        timestamp = datetime.now(LA).strftime("%Y%m%d_%H%M%S")
        filename = f"{name_slug}_{timestamp}.pdf"
        return Response(
            content=pdf_buf.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    @mcp.custom_route("/api/v1/intakes/export/batch", methods=["POST"])
    async def api_export_intakes_batch(request):
        """Export multiple intakes as a single PDF, one per page."""
        if err := auth.require_auth(request):
            return err

        from db.intakes import get_intake_by_id
        from db.intake_comments import get_intake_comments

        try:
            body = await request.json()
        except Exception:
            return api_error("Invalid JSON body", "INVALID_INPUT", 400)

        ids = body.get("ids", [])
        if not ids or not isinstance(ids, list):
            return api_error("ids must be a non-empty list", "INVALID_INPUT", 400)

        intakes_with_comments = []
        for intake_id in ids:
            intake = await asyncio.to_thread(get_intake_by_id, int(intake_id))
            if intake:
                comments = await asyncio.to_thread(get_intake_comments, int(intake_id))
                intakes_with_comments.append((intake, comments))

        if not intakes_with_comments:
            return api_error("No intakes found for the given IDs", "NOT_FOUND", 404)

        try:
            pdf_buf = await asyncio.to_thread(generate_intake_batch_pdf, intakes_with_comments)
        except Exception as e:
            logger.error("Batch intake PDF failed:\n%s", traceback.format_exc())
            return api_error(f"PDF generation failed: {e}", "EXPORT_ERROR", 500)

        timestamp = datetime.now(LA).strftime("%Y%m%d_%H%M%S")
        filename = f"galipo_intakes_batch_{timestamp}.pdf"
        return Response(
            content=pdf_buf.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    @mcp.custom_route("/api/v1/cases/{case_id}/costs/export", methods=["GET"])
    async def api_export_case_costs(request):
        """Export a case's cost report as PDF."""
        if err := auth.require_auth(request):
            return err

        case_id = int(request.path_params["case_id"])

        case = await asyncio.to_thread(db.get_case_summary, case_id)
        if not case:
            return api_error("Case not found", "NOT_FOUND", 404)

        result = await asyncio.to_thread(
            db.list_invoices, case_id=case_id, limit=5000
        )
        invoices = result.get("invoices", [])

        cost_summary = await asyncio.to_thread(db.get_cost_summary, case_id)
        cost_sharing = await asyncio.to_thread(db.get_cost_sharing, case_id)

        try:
            pdf_buf = await asyncio.to_thread(
                generate_cost_report_pdf,
                case.get("case_name", "Unknown Case"),
                invoices,
                cost_summary,
                cost_sharing,
            )
        except Exception as e:
            logger.error("Cost report PDF failed:\n%s", traceback.format_exc())
            return api_error(f"PDF generation failed: {e}", "EXPORT_ERROR", 500)

        name_slug = (case.get("case_name") or "case").replace(" ", "_")[:30]
        timestamp = datetime.now(LA).strftime("%Y%m%d_%H%M%S")
        filename = f"{name_slug}_costs_{timestamp}.pdf"
        return Response(
            content=pdf_buf.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
