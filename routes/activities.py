"""
Activity/time tracking routes.

Handles activity CRUD operations for cases.
"""

import asyncio
from fastapi.responses import JSONResponse
import database as db
import auth
from .common import api_error


def register_activity_routes(mcp):
    """Register activity management routes."""

    @mcp.custom_route("/api/v1/activities", methods=["POST"])
    async def api_create_activity(request):
        """Create a new activity."""
        if err := auth.require_auth(request):
            return err
        data = await request.json()

        # Validate required fields
        case_id = data.get("case_id")
        description = data.get("description")
        activity_type = data.get("activity_type")
        date = data.get("date")

        if not case_id:
            return api_error("case_id is required", "MISSING_FIELD", 400)
        if not description:
            return api_error("description is required", "MISSING_FIELD", 400)
        if not activity_type:
            return api_error("activity_type is required", "MISSING_FIELD", 400)
        if not date:
            return api_error("date is required", "MISSING_FIELD", 400)

        minutes = data.get("minutes")

        result = await asyncio.to_thread(
            db.add_activity,
            case_id,
            description,
            activity_type,
            date,
            minutes
        )
        return JSONResponse({"success": True, "activity": result})

    @mcp.custom_route("/api/v1/activities/{activity_id}", methods=["DELETE"])
    async def api_delete_activity(request):
        """Delete an activity."""
        if err := auth.require_auth(request):
            return err
        activity_id = int(request.path_params["activity_id"])
        deleted = await asyncio.to_thread(db.delete_activity, activity_id)
        if deleted:
            return JSONResponse({"success": True})
        return api_error("Activity not found", "NOT_FOUND", 404)
