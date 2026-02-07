"""
Activity/time tracking routes.

Handles activity CRUD operations for cases.
"""

import asyncio
from fastapi.responses import JSONResponse
from pydantic import ValidationError
import database as db
import auth
from schemas import CreateActivityInput
from .common import api_error, pydantic_error


def register_activity_routes(mcp):
    """Register activity management routes."""

    @mcp.custom_route("/api/v1/activities", methods=["POST"])
    async def api_create_activity(request):
        """Create a new activity."""
        if err := auth.require_auth(request):
            return err
        try:
            data = CreateActivityInput(**(await request.json()))
        except ValidationError as e:
            return pydantic_error(e)
        result = await asyncio.to_thread(
            db.add_activity,
            data.case_id,
            data.description,
            data.activity_type,
            data.date,
            data.minutes,
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
