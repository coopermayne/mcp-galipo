"""
Event API routes.

Handles event (calendar items: hearings, depositions, filing deadlines) CRUD operations.
"""

import asyncio
from fastapi.responses import JSONResponse
from pydantic import ValidationError
import db
import auth
from schemas import CreateEventInput, UpdateEventInput
from .common import api_error, pydantic_error, DEFAULT_PAGE_SIZE


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
        user_id = request.query_params.get("user_id")
        attendee_id = request.query_params.get("attendee_id")

        limit = int(limit) if limit else DEFAULT_PAGE_SIZE
        offset = int(offset)
        past_days = int(past_days) if past_days else 14
        case_id = int(case_id) if case_id else None
        user_id = int(user_id) if user_id else None
        attendee_id = int(attendee_id) if attendee_id else None

        result = await asyncio.to_thread(
            db.get_upcoming_events,
            limit=limit,
            offset=offset,
            include_past=include_past,
            past_days=past_days,
            case_id=case_id,
            user_id=user_id,
            attendee_id=attendee_id
        )
        return JSONResponse(result)

    @mcp.custom_route("/api/v1/events", methods=["POST"])
    async def api_create_event(request):
        """Create a new event (hearing, deposition, filing deadline, etc.)."""
        if err := auth.require_auth(request):
            return err
        try:
            data = CreateEventInput(**(await request.json()))
        except ValidationError as e:
            return pydantic_error(e)
        result = await asyncio.to_thread(
            db.add_event,
            data.case_id,
            data.date,
            data.description,
            data.document_link,
            data.calculation_note,
            data.time,
            data.location,
            data.starred,
            data.event_type,
            data.end_date,
            data.blocks_calendar,
        )

        # System comment for event creation
        user = auth.get_current_user(request)
        if user and data.case_id:
            name = f"{user['firstName']} {user['lastName']}"
            desc = data.description[:80] + ("..." if len(data.description) > 80 else "")
            await asyncio.to_thread(
                db.add_case_comment, data.case_id, user["id"],
                f'{name} added event: "{desc}"', True,
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

    @mcp.custom_route("/api/v1/events/{event_id}", methods=["GET"])
    async def api_get_event(request):
        """Get a single event by ID."""
        if err := auth.require_auth(request):
            return err
        event_id = int(request.path_params["event_id"])
        result = await asyncio.to_thread(db.get_event_by_id, event_id)
        if not result:
            return api_error("Event not found", "NOT_FOUND", 404)
        return JSONResponse({"event": result})

    @mcp.custom_route("/api/v1/events/{event_id}", methods=["PUT"])
    async def api_update_event(request):
        """Update an event."""
        if err := auth.require_auth(request):
            return err
        event_id = int(request.path_params["event_id"])
        try:
            data = UpdateEventInput(**(await request.json()))
        except ValidationError as e:
            return pydantic_error(e)
        updates = data.model_dump(exclude_none=True)
        result = await asyncio.to_thread(db.update_event_full, event_id, **updates)
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

    # =========================================================================
    # Event Attendees
    # =========================================================================

    @mcp.custom_route("/api/v1/events/{event_id}/attendees", methods=["GET"])
    async def api_get_event_attendees(request):
        """Get all attendees for an event."""
        if err := auth.require_auth(request):
            return err
        event_id = int(request.path_params["event_id"])
        attendees = await asyncio.to_thread(db.get_event_attendees, event_id)
        return JSONResponse({"success": True, "data": attendees})

    @mcp.custom_route("/api/v1/events/{event_id}/attendees/{user_id}", methods=["POST"])
    async def api_add_event_attendee(request):
        """Add an attendee to an event."""
        if err := auth.require_auth(request):
            return err
        event_id = int(request.path_params["event_id"])
        user_id = int(request.path_params["user_id"])
        result = await asyncio.to_thread(db.add_event_attendee, event_id, user_id)
        if not result.get("success"):
            return api_error(result.get("error", "Failed to add attendee"), "ADD_FAILED", 400)
        return JSONResponse({"success": True, "data": result})

    @mcp.custom_route("/api/v1/events/{event_id}/attendees/{user_id}", methods=["DELETE"])
    async def api_remove_event_attendee(request):
        """Remove an attendee from an event."""
        if err := auth.require_auth(request):
            return err
        event_id = int(request.path_params["event_id"])
        user_id = int(request.path_params["user_id"])
        result = await asyncio.to_thread(db.remove_event_attendee, event_id, user_id)
        if not result.get("success"):
            return api_error(result.get("error", "Failed to remove attendee"), "REMOVE_FAILED", 400)
        return JSONResponse({"success": True, "data": result})
