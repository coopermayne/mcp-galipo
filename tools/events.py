"""
Event MCP Tools

Tools for managing calendar events (hearings, depositions, filing deadlines, etc.)
in the legal case management system.
"""

from typing import Optional
from mcp.server.fastmcp import Context
import database as db
from database import ValidationError
from tools.utils import (
    validation_error, not_found_error,
    invalid_date_format_error, invalid_time_format_error,
    check_empty_required_field, task_event_confusion_hint
)


def register_event_tools(mcp):
    """Register event-related MCP tools."""

    @mcp.tool()
    def add_event(
        context: Context,
        case_id: int,
        date: str,
        description: str,
        time: Optional[str] = None,
        location: Optional[str] = None,
        document_link: Optional[str] = None,
        calculation_note: Optional[str] = None,
        starred: bool = False
    ) -> dict:
        """Add an event to a case (deadline, hearing, deposition, etc.)."""
        context.info(f"Adding event for case {case_id}: {description}")

        try:
            db.validate_date_format(date, "date")
        except ValidationError:
            return invalid_date_format_error(date, "date")

        if time:
            try:
                db.validate_time_format(time, "time")
            except ValidationError:
                return invalid_time_format_error(time, "time")

        result = db.add_event(case_id, date, description,
                              document_link, calculation_note, time, location, starred)
        if not result:
            return not_found_error("Case", hint=task_event_confusion_hint())

        context.info(f"Event created with ID {result.get('id')}")
        return {"success": True, "event": result}

    @mcp.tool()
    def get_events(
        context: Context,
        case_id: Optional[int] = None
    ) -> dict:
        """Get upcoming events, optionally filtered by case."""
        context.info(f"Fetching events{' for case ' + str(case_id) if case_id else ''}")
        result = db.get_upcoming_events()

        # Filter by case_id if provided (since db function doesn't support it directly)
        if case_id:
            result["events"] = [e for e in result["events"] if e["case_id"] == case_id]
            result["total"] = len(result["events"])

        context.info(f"Found {result['total']} events")
        return {"events": result["events"], "total": result["total"]}

    @mcp.tool()
    def update_event(
        context: Context,
        event_id: int,
        date: Optional[str] = None,
        description: Optional[str] = None,
        time: Optional[str] = None,
        location: Optional[str] = None,
        document_link: Optional[str] = None,
        calculation_note: Optional[str] = None,
        starred: Optional[bool] = None
    ) -> dict:
        """Update an event."""
        context.info(f"Updating event {event_id}")

        # Build kwargs with only explicitly provided fields
        # None = not provided (don't update), "" = clear the field, other = set value
        kwargs = {}

        if date is not None:
            error = check_empty_required_field(date, "date")
            if error:
                return error
            try:
                db.validate_date_format(date, "date")
            except ValidationError:
                return invalid_date_format_error(date, "date")
            kwargs['date'] = date

        if description is not None:
            error = check_empty_required_field(description, "description")
            if error:
                return error
            kwargs['description'] = description

        if time is not None:
            if time == "":
                kwargs['time'] = None  # Clear the time
            else:
                try:
                    db.validate_time_format(time, "time")
                except ValidationError:
                    return invalid_time_format_error(time, "time")
                kwargs['time'] = time

        if location is not None:
            kwargs['location'] = location if location != "" else None

        if document_link is not None:
            kwargs['document_link'] = document_link if document_link != "" else None

        if calculation_note is not None:
            kwargs['calculation_note'] = calculation_note if calculation_note != "" else None

        if starred is not None:
            kwargs['starred'] = starred

        if not kwargs:
            return validation_error(
                "No fields to update",
                hint="Provide at least one field to update. Pass \"\" to clear optional fields (time, location, document_link, calculation_note)."
            )

        result = db.update_event_full(event_id, **kwargs)
        if not result:
            return not_found_error("Event")
        context.info(f"Event {event_id} updated successfully")
        return {"success": True, "event": result}

    @mcp.tool()
    def delete_event(context: Context, event_id: int) -> dict:
        """Delete an event."""
        context.info(f"Deleting event {event_id}")
        if db.delete_event(event_id):
            context.info(f"Event {event_id} deleted successfully")
            return {"success": True, "message": "Event deleted"}
        return not_found_error("Event")

    @mcp.tool()
    def get_calendar(
        context: Context,
        days: int = 30,
        include_tasks: bool = True,
        include_events: bool = True
    ) -> dict:
        """Get a combined calendar view of tasks and events."""
        context.info(f"Fetching calendar for next {days} days")
        items = db.get_calendar(days, include_tasks, include_events)
        context.info(f"Found {len(items)} calendar items")
        return {"items": items, "total": len(items), "days": days}
