"""
Event API routes.

Handles event (calendar items: hearings, depositions, filing deadlines) CRUD operations.
"""

from fastapi.responses import JSONResponse
import database as db
import auth
from .common import api_error, DEFAULT_PAGE_SIZE


def register_event_routes(mcp):
    """Register event management routes."""

    @mcp.custom_route("/api/v1/events", methods=["GET"])
    async def api_list_events(request):
        """List events with optional filtering and pagination."""
        if err := auth.require_auth(request):
            return err
        limit = request.query_params.get("limit")
        offset = request.query_params.get("offset", "0")
        limit = int(limit) if limit else DEFAULT_PAGE_SIZE
        offset = int(offset)

        result = db.get_upcoming_events(
            limit=limit,
            offset=offset
        )
        return JSONResponse(result)

    @mcp.custom_route("/api/v1/events", methods=["POST"])
    async def api_create_event(request):
        """Create a new event (hearing, deposition, filing deadline, etc.)."""
        if err := auth.require_auth(request):
            return err
        data = await request.json()
        result = db.add_event(
            data["case_id"],
            data["date"],
            data["description"],
            data.get("document_link"),
            data.get("calculation_note"),
            data.get("time"),
            data.get("location"),
            data.get("starred", False)
        )
        return JSONResponse({"success": True, "event": result})

    @mcp.custom_route("/api/v1/events/{event_id}", methods=["PUT"])
    async def api_update_event(request):
        """Update an event."""
        if err := auth.require_auth(request):
            return err
        event_id = int(request.path_params["event_id"])
        data = await request.json()
        result = db.update_event_full(event_id, **data)
        if not result:
            return api_error("Event not found", "NOT_FOUND", 404)
        return JSONResponse({"success": True, "event": result})

    @mcp.custom_route("/api/v1/events/{event_id}", methods=["DELETE"])
    async def api_delete_event(request):
        """Delete an event."""
        if err := auth.require_auth(request):
            return err
        event_id = int(request.path_params["event_id"])
        if db.delete_event(event_id):
            return JSONResponse({"success": True})
        return api_error("Event not found", "NOT_FOUND", 404)
