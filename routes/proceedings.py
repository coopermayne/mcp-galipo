"""
Proceeding API routes.

Handles court proceeding CRUD operations for cases.
"""

from fastapi.responses import JSONResponse
import database as db
import auth
from .common import api_error


def register_proceeding_routes(mcp):
    """Register proceeding management routes."""

    @mcp.custom_route("/api/v1/cases/{case_id}/proceedings", methods=["GET"])
    async def api_list_proceedings(request):
        """List all proceedings for a case."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        proceedings = db.get_proceedings(case_id)
        return JSONResponse({"proceedings": proceedings, "total": len(proceedings)})

    @mcp.custom_route("/api/v1/cases/{case_id}/proceedings", methods=["POST"])
    async def api_create_proceeding(request):
        """Create a new proceeding for a case."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        data = await request.json()

        if not data.get("case_number"):
            return api_error("case_number is required", "VALIDATION_ERROR", 400)

        result = db.add_proceeding(
            case_id=case_id,
            case_number=data["case_number"],
            jurisdiction_id=data.get("jurisdiction_id"),
            judge_id=data.get("judge_id"),
            sort_order=data.get("sort_order"),
            is_primary=data.get("is_primary", False),
            notes=data.get("notes")
        )
        return JSONResponse({"success": True, "proceeding": result})

    @mcp.custom_route("/api/v1/proceedings/{proceeding_id}", methods=["GET"])
    async def api_get_proceeding(request):
        """Get a proceeding by ID."""
        if err := auth.require_auth(request):
            return err
        proceeding_id = int(request.path_params["proceeding_id"])
        result = db.get_proceeding_by_id(proceeding_id)
        if not result:
            return api_error("Proceeding not found", "NOT_FOUND", 404)
        return JSONResponse(result)

    @mcp.custom_route("/api/v1/proceedings/{proceeding_id}", methods=["PUT"])
    async def api_update_proceeding(request):
        """Update a proceeding."""
        if err := auth.require_auth(request):
            return err
        proceeding_id = int(request.path_params["proceeding_id"])
        data = await request.json()
        result = db.update_proceeding(proceeding_id, **data)
        if not result:
            return api_error("Proceeding not found", "NOT_FOUND", 404)
        return JSONResponse({"success": True, "proceeding": result})

    @mcp.custom_route("/api/v1/proceedings/{proceeding_id}", methods=["DELETE"])
    async def api_delete_proceeding(request):
        """Delete a proceeding."""
        if err := auth.require_auth(request):
            return err
        proceeding_id = int(request.path_params["proceeding_id"])
        if db.delete_proceeding(proceeding_id):
            return JSONResponse({"success": True})
        return api_error("Proceeding not found", "NOT_FOUND", 404)
