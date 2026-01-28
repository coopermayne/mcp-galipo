"""
Case API routes.

Handles case CRUD operations.
"""

import asyncio
from fastapi.responses import JSONResponse
import database as db
import auth
from .common import api_error, DEFAULT_PAGE_SIZE


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
        result = await asyncio.to_thread(db.get_all_cases, status, limit=limit, offset=offset)
        return JSONResponse({
            "cases": result["cases"],
            "total": result["total"]
        })

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
        data = await request.json()
        result = await asyncio.to_thread(
            db.create_case,
            data["case_name"],
            data.get("status", "Signing Up"),
            print_code=data.get("print_code"),
            case_summary=data.get("case_summary"),
            result=data.get("result"),
            date_of_injury=data.get("date_of_injury"),
            case_numbers=data.get("case_numbers"),
            short_name=data.get("short_name")
        )
        return JSONResponse({"success": True, "case": result})

    @mcp.custom_route("/api/v1/cases/{case_id}", methods=["PUT"])
    async def api_update_case(request):
        """Update an existing case."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        data = await request.json()
        result = await asyncio.to_thread(db.update_case, case_id, **data)
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
