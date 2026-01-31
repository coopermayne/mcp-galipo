"""
Event API routes.

Handles event (calendar items: hearings, depositions, filing deadlines) CRUD operations.
"""

import asyncio
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
        include_past = request.query_params.get("include_past", "false").lower() == "true"
        past_days = request.query_params.get("past_days")
        case_id = request.query_params.get("case_id")

        limit = int(limit) if limit else DEFAULT_PAGE_SIZE
        offset = int(offset)
        past_days = int(past_days) if past_days else 14
        case_id = int(case_id) if case_id else None

        result = await asyncio.to_thread(
            db.get_upcoming_events,
            limit=limit,
            offset=offset,
            include_past=include_past,
            past_days=past_days,
            case_id=case_id
        )
        return JSONResponse(result)

    @mcp.custom_route("/api/v1/events", methods=["POST"])
    async def api_create_event(request):
        """Create a new event (hearing, deposition, filing deadline, etc.)."""
        if err := auth.require_auth(request):
            return err
        data = await request.json()
        result = await asyncio.to_thread(
            db.add_event,
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

    @mcp.custom_route("/api/v1/events/search", methods=["GET"])
    async def api_search_events(request):
        """Search events by query and/or case_id."""
        if err := auth.require_auth(request):
            return err
        query = request.query_params.get("q")
        case_id = request.query_params.get("case_id")
        limit = request.query_params.get("limit", "50")

        case_id = int(case_id) if case_id else None
        limit = int(limit)

        events = await asyncio.to_thread(
            db.search_events,
            query=query,
            case_id=case_id,
            limit=limit
        )
        return JSONResponse({"events": events})

    @mcp.custom_route("/api/v1/events/{event_id}", methods=["PUT"])
    async def api_update_event(request):
        """Update an event."""
        if err := auth.require_auth(request):
            return err
        event_id = int(request.path_params["event_id"])
        data = await request.json()
        result = await asyncio.to_thread(db.update_event_full, event_id, **data)
        if not result:
            return api_error("Event not found", "NOT_FOUND", 404)
        return JSONResponse({"success": True, "event": result})

    @mcp.custom_route("/api/v1/events/{event_id}/tasks", methods=["GET"])
    async def api_get_event_tasks(request):
        """Get tasks linked to an event."""
        if err := auth.require_auth(request):
            return err
        event_id = int(request.path_params["event_id"])
        tasks = await asyncio.to_thread(db.get_tasks_for_event, event_id)
        return JSONResponse({"tasks": tasks})

    @mcp.custom_route("/api/v1/events/{event_id}", methods=["DELETE"])
    async def api_delete_event(request):
        """Delete an event and its linked tasks."""
        if err := auth.require_auth(request):
            return err
        event_id = int(request.path_params["event_id"])
        deleted = await asyncio.to_thread(db.delete_event, event_id)
        if deleted:
            return JSONResponse({"success": True})
        return api_error("Event not found", "NOT_FOUND", 404)
