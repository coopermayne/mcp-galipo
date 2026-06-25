"""
Event API routes.

Handles event (calendar items: hearings, depositions, filing deadlines) CRUD operations.
"""

import asyncio
from fastapi.responses import JSONResponse, Response
from pydantic import ValidationError
import db
import auth
from schemas import CreateEventInput, UpdateEventInput
from services.ical_export import build_ics_from_events
from .common import api_error, pydantic_error, clamp_pagination, feature_disabled_error
from .comments import _get_db_user_id
from .sse import broadcast


def register_event_routes(mcp):
    """Register event management routes."""

    @mcp.custom_route("/api/v1/events", methods=["GET"])
    async def api_list_events(request):
        """List events with optional filtering and pagination."""
        if err := auth.require_auth(request):
            return err
        include_past = request.query_params.get("include_past", "false").lower() == "true"
        past_days = request.query_params.get("past_days")
        case_id = request.query_params.get("case_id")
        user_id = request.query_params.get("user_id")
        attendee_id = request.query_params.get("attendee_id")

        limit, offset = clamp_pagination(request)
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
        try:
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
                notes=data.notes,
                on_trial_calendar=data.on_trial_calendar,
            )
        except db.FeatureDisabled as e:
            return feature_disabled_error(e)

        # System comment for event creation
        user = auth.get_current_user(request)
        if user and data.case_id:
            name = f"{user['firstName']} {user['lastName']}"
            desc = data.description[:80] + ("..." if len(data.description) > 80 else "")
            await asyncio.to_thread(
                db.add_case_comment, data.case_id, _get_db_user_id(user),
                f'{name} added event: "{desc}"', True,
            )

        broadcast({"entity": "event", "action": "created", "id": result.get("id"), "case_id": data.case_id})
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

    @mcp.custom_route("/api/v1/events/export.ics", methods=["POST"])
    async def api_export_events_ics(request):
        """Export selected events as an iCalendar (.ics) file.

        Body: {"event_ids": [int, ...]} — events to include. If omitted/empty,
        falls back to the next 365 days for the authenticated user's cases.
        """
        if err := auth.require_auth(request):
            return err
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        event_ids = body.get("event_ids") or []

        if event_ids:
            events = await asyncio.to_thread(
                lambda: [db.get_event_by_id(int(eid)) for eid in event_ids]
            )
            events = [e for e in events if e]
        else:
            # Fallback: this user's events, ±365 days
            user = auth.get_current_user(request)
            user_id = _get_db_user_id(user) if user else None
            result = await asyncio.to_thread(
                db.get_upcoming_events,
                limit=1000,
                include_past=True,
                past_days=365,
                user_id=user_id,
            )
            events = result.get("events", [])

        ics_text = build_ics_from_events(events)
        return Response(
            content=ics_text,
            media_type="text/calendar",
            headers={
                "Content-Disposition": 'attachment; filename="galipo-events.ics"'
            },
        )

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
        try:
            result = await asyncio.to_thread(db.update_event_full, event_id, **updates)
        except db.FeatureDisabled as e:
            return feature_disabled_error(e)
        if not result:
            return api_error("Event not found", "NOT_FOUND", 404)
        broadcast({"entity": "event", "action": "updated", "id": event_id, "case_id": result.get("case_id")})
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
        try:
            deleted = await asyncio.to_thread(db.delete_event, event_id)
        except db.FeatureDisabled as e:
            return feature_disabled_error(e)
        if deleted:
            broadcast({"entity": "event", "action": "deleted", "id": event_id})
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
        try:
            result = await asyncio.to_thread(db.add_event_attendee, event_id, user_id)
        except db.FeatureDisabled as e:
            return feature_disabled_error(e)
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
        try:
            result = await asyncio.to_thread(db.remove_event_attendee, event_id, user_id)
        except db.FeatureDisabled as e:
            return feature_disabled_error(e)
        if not result.get("success"):
            return api_error(result.get("error", "Failed to remove attendee"), "REMOVE_FAILED", 400)
        return JSONResponse({"success": True, "data": result})
