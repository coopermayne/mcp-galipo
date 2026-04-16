"""
Case API routes.

Handles case CRUD operations.
"""

import asyncio
from fastapi.responses import JSONResponse
from pydantic import ValidationError
import db
import auth
from schemas import CreateCaseInput, UpdateCaseInput, CreateCaseCommentInput
from .common import api_error, pydantic_error, DEFAULT_PAGE_SIZE


def register_case_routes(mcp):
    """Register case management routes."""

    @mcp.custom_route("/api/v1/cases", methods=["GET"])
    async def api_list_cases(request):
        """List all cases with optional filtering and pagination."""
        if err := auth.require_auth(request):
            return err
        status = request.query_params.get("status")
        limit = request.query_params.get("limit")
        offset = request.query_params.get("offset", "0")
        limit = int(limit) if limit else DEFAULT_PAGE_SIZE
        offset = int(offset)

        # Attorney filter params
        attorney_ids_param = request.query_params.get("attorney_ids")
        attorney_ids = [int(x) for x in attorney_ids_param.split(",")] if attorney_ids_param else None
        unassigned = request.query_params.get("unassigned", "false").lower() == "true"

        result = await asyncio.to_thread(
            db.get_all_cases, status, limit=limit, offset=offset,
            attorney_ids=attorney_ids, unassigned=unassigned
        )
        return JSONResponse({
            "cases": result["cases"],
            "total": result["total"]
        })

    @mcp.custom_route("/api/v1/cases/counts", methods=["GET"])
    async def api_case_counts(request):
        """Get case counts grouped by status."""
        if err := auth.require_auth(request):
            return err
        attorney_ids_param = request.query_params.get("attorney_ids")
        attorney_ids = [int(x) for x in attorney_ids_param.split(",")] if attorney_ids_param else None
        counts = await asyncio.to_thread(db.get_case_status_counts, attorney_ids)
        return JSONResponse(counts)

    @mcp.custom_route("/api/v1/cases/{case_id}", methods=["GET"])
    async def api_get_case(request):
        """Get a specific case by ID."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        case = await asyncio.to_thread(db.get_case_by_id, case_id)
        if not case:
            return api_error("Case not found", "NOT_FOUND", 404)
        return JSONResponse(case)

    @mcp.custom_route("/api/v1/cases", methods=["POST"])
    async def api_create_case(request):
        """Create a new case."""
        if err := auth.require_auth(request):
            return err
        try:
            data = CreateCaseInput(**(await request.json()))
        except ValidationError as e:
            return pydantic_error(e)
        result = await asyncio.to_thread(
            db.create_case,
            data.case_name,
            data.status,
            print_code=data.print_code,
            case_summary=data.case_summary,
            result=data.result,
            date_of_injury=data.date_of_injury,
            short_name=data.short_name,
            trial_date=data.trial_date,
            claim_deadline=data.claim_deadline,
            complaint_deadline=data.complaint_deadline,
        )
        return JSONResponse({"success": True, "case": result})

    @mcp.custom_route("/api/v1/cases/{case_id}", methods=["PUT"])
    async def api_update_case(request):
        """Update an existing case."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        try:
            data = UpdateCaseInput(**(await request.json()))
        except ValidationError as e:
            return pydantic_error(e)

        # Capture old status before update for system comment
        old_status = None
        if data.status is not None:
            old_case = await asyncio.to_thread(db.get_case_by_id, case_id)
            if old_case:
                old_status = old_case.get("status")

        updates = data.model_dump(exclude_none=True)
        result = await asyncio.to_thread(db.update_case, case_id, **updates)
        if not result:
            return api_error("Case not found", "NOT_FOUND", 404)

        # Log status change as system comment
        if old_status and data.status and old_status != data.status:
            user = auth.get_current_user(request)
            name = f"{user['firstName']} {user['lastName']}" if user else "System"
            await asyncio.to_thread(
                db.add_case_comment,
                case_id, user["id"] if user else None,
                f"{name} changed status from {old_status} to {data.status}",
                True,
            )

        return JSONResponse({"success": True, "case": result})

    @mcp.custom_route("/api/v1/cases/{case_id}", methods=["DELETE"])
    async def api_delete_case(request):
        """Delete a case."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        deleted = await asyncio.to_thread(db.delete_case, case_id)
        if deleted:
            return JSONResponse({"success": True})
        return api_error("Case not found", "NOT_FOUND", 404)

    # =========================================================================
    # Case Staff Assignments (Attorneys & Paralegals)
    # =========================================================================

    @mcp.custom_route("/api/v1/cases/{case_id}/users", methods=["GET"])
    async def api_get_case_users(request):
        """Get all staff users (attorneys and paralegals) assigned to a case."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        result = await asyncio.to_thread(db.get_case_users, case_id)
        return JSONResponse({"success": True, "data": result})

    @mcp.custom_route("/api/v1/cases/{case_id}/attorneys/{user_id}", methods=["POST"])
    async def api_assign_attorney_to_case(request):
        """Assign an attorney to a case. Auto-assigns their default paralegal."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        user_id = int(request.path_params["user_id"])
        result = await asyncio.to_thread(db.assign_attorney_to_case, case_id, user_id)
        if not result.get("success"):
            return api_error(result.get("error", "Failed to assign"), "ASSIGN_FAILED", 400)

        # Log system comment
        current_user = auth.get_current_user(request)
        actor = f"{current_user['firstName']} {current_user['lastName']}" if current_user else "System"
        staff = await asyncio.to_thread(db.get_user_by_id, user_id)
        staff_name = f"{staff['first_name']} {staff['last_name']}" if staff else f"User {user_id}"
        await asyncio.to_thread(
            db.add_case_comment, case_id,
            current_user["id"] if current_user else None,
            f"{actor} assigned {staff_name} as Attorney", True,
        )

        return JSONResponse({"success": True, "data": result})

    @mcp.custom_route("/api/v1/cases/{case_id}/attorneys/{user_id}", methods=["DELETE"])
    async def api_remove_attorney_from_case(request):
        """Remove an attorney from a case."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        user_id = int(request.path_params["user_id"])

        # Get staff name before removal
        staff = await asyncio.to_thread(db.get_user_by_id, user_id)
        staff_name = f"{staff['first_name']} {staff['last_name']}" if staff else f"User {user_id}"

        result = await asyncio.to_thread(db.remove_attorney_from_case, case_id, user_id)
        if not result.get("success"):
            return api_error(result.get("error", "Failed to remove"), "REMOVE_FAILED", 400)

        current_user = auth.get_current_user(request)
        actor = f"{current_user['firstName']} {current_user['lastName']}" if current_user else "System"
        await asyncio.to_thread(
            db.add_case_comment, case_id,
            current_user["id"] if current_user else None,
            f"{actor} removed {staff_name} as Attorney", True,
        )

        return JSONResponse({"success": True, "data": result})

    @mcp.custom_route("/api/v1/cases/{case_id}/paralegals/{user_id}", methods=["POST"])
    async def api_assign_paralegal_to_case(request):
        """Manually assign a paralegal to a case."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        user_id = int(request.path_params["user_id"])
        result = await asyncio.to_thread(db.assign_paralegal_to_case, case_id, user_id)
        if not result.get("success"):
            return api_error(result.get("error", "Failed to assign"), "ASSIGN_FAILED", 400)

        current_user = auth.get_current_user(request)
        actor = f"{current_user['firstName']} {current_user['lastName']}" if current_user else "System"
        staff = await asyncio.to_thread(db.get_user_by_id, user_id)
        staff_name = f"{staff['first_name']} {staff['last_name']}" if staff else f"User {user_id}"
        await asyncio.to_thread(
            db.add_case_comment, case_id,
            current_user["id"] if current_user else None,
            f"{actor} assigned {staff_name} as Paralegal", True,
        )

        return JSONResponse({"success": True, "data": result})

    @mcp.custom_route("/api/v1/cases/{case_id}/paralegals/{user_id}", methods=["DELETE"])
    async def api_remove_paralegal_from_case(request):
        """Remove a paralegal from a case."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        user_id = int(request.path_params["user_id"])

        staff = await asyncio.to_thread(db.get_user_by_id, user_id)
        staff_name = f"{staff['first_name']} {staff['last_name']}" if staff else f"User {user_id}"

        result = await asyncio.to_thread(db.remove_paralegal_from_case, case_id, user_id)
        if not result.get("success"):
            return api_error(result.get("error", "Failed to remove"), "REMOVE_FAILED", 400)

        current_user = auth.get_current_user(request)
        actor = f"{current_user['firstName']} {current_user['lastName']}" if current_user else "System"
        await asyncio.to_thread(
            db.add_case_comment, case_id,
            current_user["id"] if current_user else None,
            f"{actor} removed {staff_name} as Paralegal", True,
        )

        return JSONResponse({"success": True, "data": result})

    # =========================================================================
    # Case Comments (Activity Feed)
    # =========================================================================

    @mcp.custom_route("/api/v1/cases/{case_id}/comments", methods=["GET"])
    async def api_get_case_comments(request):
        """List all comments for a case with last_read_at for the current user."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        user = auth.get_current_user(request)
        user_id = user["id"] if user else 0
        comments = await asyncio.to_thread(db.get_case_comments, case_id)
        last_read_at = await asyncio.to_thread(db.get_case_last_read_at, case_id, user_id)
        return JSONResponse({"comments": comments, "last_read_at": last_read_at})

    @mcp.custom_route("/api/v1/cases/{case_id}/comments", methods=["POST"])
    async def api_create_case_comment(request):
        """Add a user comment to a case."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        user = auth.get_current_user(request)
        if not user:
            return api_error("User not found", "UNAUTHORIZED", 401)
        try:
            data = CreateCaseCommentInput(**(await request.json()))
        except ValidationError as e:
            return pydantic_error(e)
        comment = await asyncio.to_thread(
            db.add_case_comment,
            case_id, user["id"], data.content,
        )
        return JSONResponse(comment, status_code=201)

    @mcp.custom_route("/api/v1/cases/{case_id}/read", methods=["POST"])
    async def api_mark_case_read(request):
        """Mark all comments as read for the current user."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        user = auth.get_current_user(request)
        user_id = user["id"] if user else 0
        await asyncio.to_thread(db.mark_case_read, case_id, user_id)
        return JSONResponse({"success": True})
