"""
Case API routes.

Handles case CRUD operations.
"""

import asyncio
from fastapi.responses import JSONResponse
from pydantic import ValidationError
import db
import auth
from schemas import CreateCaseInput, UpdateCaseInput
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
            short_name=data.short_name
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
        updates = data.model_dump(exclude_none=True)
        result = await asyncio.to_thread(db.update_case, case_id, **updates)
        if not result:
            return api_error("Case not found", "NOT_FOUND", 404)
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
        return JSONResponse({"success": True, "data": result})

    @mcp.custom_route("/api/v1/cases/{case_id}/attorneys/{user_id}", methods=["DELETE"])
    async def api_remove_attorney_from_case(request):
        """Remove an attorney from a case."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        user_id = int(request.path_params["user_id"])
        result = await asyncio.to_thread(db.remove_attorney_from_case, case_id, user_id)
        if not result.get("success"):
            return api_error(result.get("error", "Failed to remove"), "REMOVE_FAILED", 400)
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
        return JSONResponse({"success": True, "data": result})

    @mcp.custom_route("/api/v1/cases/{case_id}/paralegals/{user_id}", methods=["DELETE"])
    async def api_remove_paralegal_from_case(request):
        """Remove a paralegal from a case."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        user_id = int(request.path_params["user_id"])
        result = await asyncio.to_thread(db.remove_paralegal_from_case, case_id, user_id)
        if not result.get("success"):
            return api_error(result.get("error", "Failed to remove"), "REMOVE_FAILED", 400)
        return JSONResponse({"success": True, "data": result})
