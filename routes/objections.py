"""
Objections API routes.

CRUD endpoints for managing legal objections used in RFP responses.
"""

import asyncio
from fastapi.responses import JSONResponse
import auth
from db.objections import (
    get_objections,
    get_objection_by_id,
    create_objection,
    update_objection,
    delete_objection,
    reorder_objections,
)
from .common import api_error


def register_objection_routes(mcp):
    """Register objection management routes."""

    @mcp.custom_route("/api/v1/objections", methods=["GET"])
    async def api_list_objections(request):
        """List all objections ordered by position."""
        if err := auth.require_auth(request):
            return err
        objections = await asyncio.to_thread(get_objections)
        return JSONResponse({"success": True, "objections": objections})

    @mcp.custom_route("/api/v1/objections", methods=["POST"])
    async def api_create_objection(request):
        """Create a new objection."""
        if err := auth.require_auth(request):
            return err
        data = await request.json()

        if not data.get("name") or not data.get("short_name") or not data.get("formal_language"):
            return api_error("name, short_name, and formal_language are required", "VALIDATION_ERROR", 400)

        try:
            result = await asyncio.to_thread(
                create_objection,
                name=data["name"],
                short_name=data["short_name"],
                formal_language=data["formal_language"],
                argument_template=data.get("argument_template"),
                position=data.get("position", 0),
            )
            return JSONResponse({"success": True, "objection": result}, status_code=201)
        except Exception as e:
            if "duplicate key" in str(e).lower():
                return api_error(f"Objection with short_name '{data['short_name']}' already exists", "DUPLICATE", 409)
            raise

    @mcp.custom_route("/api/v1/objections/{objection_id}", methods=["PUT"])
    async def api_update_objection(request):
        """Update an objection."""
        if err := auth.require_auth(request):
            return err
        objection_id = int(request.path_params["objection_id"])
        data = await request.json()

        result = await asyncio.to_thread(
            update_objection,
            objection_id,
            name=data.get("name"),
            short_name=data.get("short_name"),
            formal_language=data.get("formal_language"),
            argument_template=data.get("argument_template"),
            position=data.get("position"),
        )
        if not result:
            return api_error("Objection not found", "NOT_FOUND", 404)
        return JSONResponse({"success": True, "objection": result})

    @mcp.custom_route("/api/v1/objections/{objection_id}", methods=["DELETE"])
    async def api_delete_objection(request):
        """Delete an objection."""
        if err := auth.require_auth(request):
            return err
        objection_id = int(request.path_params["objection_id"])
        result = await asyncio.to_thread(delete_objection, objection_id)
        if result.get("success"):
            return JSONResponse({"success": True})
        return api_error(result.get("error", "Cannot delete objection"), "DELETE_ERROR", 400)

    @mcp.custom_route("/api/v1/objections/reorder", methods=["POST"])
    async def api_reorder_objections(request):
        """Reorder objections. Expects {ordered_ids: [1, 3, 2, ...]}."""
        if err := auth.require_auth(request):
            return err
        data = await request.json()
        ordered_ids = data.get("ordered_ids", [])
        if not ordered_ids:
            return api_error("ordered_ids is required", "VALIDATION_ERROR", 400)
        objections = await asyncio.to_thread(reorder_objections, ordered_ids)
        return JSONResponse({"success": True, "objections": objections})
