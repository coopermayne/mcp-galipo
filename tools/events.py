"""
Event MCP Tools

Tools for managing calendar events (hearings, depositions, filing deadlines, etc.)
in the legal case management system.
"""

from typing import Optional
from mcp.server.fastmcp import Context
import database as db
from database import ValidationError
from tools.utils import validation_error, not_found_error


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
        """
        Add an event to a case - anything that HAS to happen on a specific date.

        This includes filing deadlines, depositions, hearings, trial dates, mediations,
        expert report due dates, discovery cutoffs, CMCs, MSJ hearings, etc.
        If it's on the calendar and must happen, it's an event.

        Key heuristic: Event = it's happening whether you're ready or not.

        Args:
            case_id: ID of the case
            date: Event date (YYYY-MM-DD)
            description: What is due/happening (e.g., "MSJ due", "Discovery cutoff", "Deposition of Dr. Smith")
            time: Time of event (HH:MM format, 24-hour)
            location: Location (e.g., courtroom, address)
            document_link: URL to related document
            calculation_note: How the date was calculated (e.g., "Filing date + 60 days")
            starred: Whether to star/highlight this event in case overview (default False)

        Returns the created event with ID.
        """
        context.info(f"Adding event for case {case_id}: {description}")
        try:
            db.validate_date_format(date, "date")
            db.validate_time_format(time, "time")
        except ValidationError as e:
            return validation_error(str(e))

        result = db.add_event(case_id, date, description,
                              document_link, calculation_note, time, location, starred)
        context.info(f"Event created with ID {result.get('id')}")
        return {"success": True, "event": result}

    @mcp.tool()
    def get_events(
        context: Context,
        case_id: Optional[int] = None
    ) -> dict:
        """
        Get upcoming events, optionally filtered by case.

        Args:
            case_id: Filter by specific case

        Returns list of events with case information.

        Examples:
            - get_events() - all upcoming events
            - get_events(case_id=5) - all events for case 5
        """
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
        """
        Update an event.

        Args:
            event_id: ID of the event
            date: New date (YYYY-MM-DD) - required field, cannot be cleared
            description: New description - required field, cannot be empty
            time: New time (HH:MM format), pass "" to clear
            location: New location, pass "" to clear
            document_link: New document link, pass "" to clear
            calculation_note: New calculation note, pass "" to clear
            starred: Whether to star/highlight this event in case overview

        Returns updated event.
        """
        context.info(f"Updating event {event_id}")

        # Build kwargs with only explicitly provided fields
        # None = not provided (don't update), "" = clear the field, other = set value
        kwargs = {}

        if date is not None:
            if date == "":
                return validation_error("Date cannot be cleared (required field)")
            db.validate_date_format(date, "date")
            kwargs['date'] = date

        if description is not None:
            if description == "":
                return validation_error("Description cannot be empty")
            kwargs['description'] = description

        if time is not None:
            if time == "":
                kwargs['time'] = None  # Clear the time
            else:
                db.validate_time_format(time, "time")
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
            return validation_error("No fields to update")

        result = db.update_event_full(event_id, **kwargs)
        if not result:
            return not_found_error("Event not found")
        context.info(f"Event {event_id} updated successfully")
        return {"success": True, "event": result}

    @mcp.tool()
    def delete_event(context: Context, event_id: int) -> dict:
        """
        Delete an event.

        Args:
            event_id: ID of the event to delete

        Returns confirmation.
        """
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
        """
        Get a combined calendar view of tasks and events.

        This tool provides a unified view of everything due in the specified time period,
        sorted by date. Great for answering questions like "What's on my calendar this week?"

        Args:
            days: Number of days to look ahead (default 30)
            include_tasks: Include tasks in results (default True)
            include_events: Include events in results (default True)

        Returns combined list sorted by date.
        Each item includes: id, date, time, location, description, status,
        case_id, case_name, short_name, item_type (tasks also include urgency)

        Examples:
            - get_calendar(days=7) - everything due this week
            - get_calendar(days=1) - what's due today
            - get_calendar(include_tasks=False) - events only
        """
        context.info(f"Fetching calendar for next {days} days")
        items = db.get_calendar(days, include_tasks, include_events)
        context.info(f"Found {len(items)} calendar items")
        return {"items": items, "total": len(items), "days": days}

    @mcp.tool()
    def search_events(
        context: Context,
        query: Optional[str] = None,
        case_id: Optional[int] = None
    ) -> dict:
        """
        Search for events by description or case.

        Args:
            query: Search in event descriptions (partial match)
            case_id: Filter to specific case

        At least one parameter must be provided.

        Examples:
            - search_events(query="discovery") - find events mentioning "discovery"
            - search_events(case_id=5) - find all events for case 5
        """
        if not any([query, case_id]):
            return validation_error("Provide at least one search parameter")

        context.info(f"Searching events{' for query=' + query if query else ''}")
        events = db.search_events(query, case_id)
        context.info(f"Found {len(events)} matching events")
        return {"events": events, "total": len(events)}
