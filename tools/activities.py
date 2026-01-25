"""
Activity MCP Tools

Tools for logging and managing time/activity entries in the legal case management system.
"""

from typing import Optional
from mcp.server.fastmcp import Context
import database as db
from database import ValidationError
from tools.utils import (
    validation_error, not_found_error, ActivityType,
    invalid_date_format_error, ACTIVITY_TYPE_LIST
)


def register_activity_tools(mcp):
    """Register activity-related MCP tools."""

    @mcp.tool()
    def get_activities(context: Context, case_id: Optional[int] = None) -> dict:
        """Get activities/time entries, optionally filtered by case."""
        context.info(f"Fetching activities{' for case ' + str(case_id) if case_id else ''}")
        result = db.get_activities(case_id)
        context.info(f"Found {result['total']} activities")
        return {"success": True, "activities": result["activities"], "total": result["total"]}

    @mcp.tool()
    def log_activity(
        context: Context,
        case_id: int,
        description: str,
        activity_type: ActivityType,
        minutes: Optional[int] = None,
        date: Optional[str] = None
    ) -> dict:
        """Log a time/activity entry to a case."""
        context.info(f"Logging {activity_type} activity for case {case_id}")

        # Validate activity_type
        if activity_type not in ACTIVITY_TYPE_LIST:
            return validation_error(
                f"Invalid activity_type: '{activity_type}'",
                valid_values=ACTIVITY_TYPE_LIST
            )

        if date:
            try:
                db.validate_date_format(date, "date")
            except ValidationError:
                return invalid_date_format_error(date, "date")

        # Default to today if no date provided
        if not date:
            from datetime import date as dt_date
            date = dt_date.today().isoformat()

        result = db.add_activity(case_id, description, activity_type, date, minutes)
        if not result:
            return not_found_error("Case")
        context.info(f"Activity logged with ID {result.get('id')}")
        return {"success": True, "activity": result}

    @mcp.tool()
    def update_activity(
        context: Context,
        activity_id: int,
        date: Optional[str] = None,
        description: Optional[str] = None,
        activity_type: Optional[ActivityType] = None,
        minutes: Optional[int] = None
    ) -> dict:
        """Update an activity/time entry."""
        context.info(f"Updating activity {activity_id}")

        if date:
            try:
                db.validate_date_format(date, "date")
            except ValidationError:
                return invalid_date_format_error(date, "date")

        if activity_type and activity_type not in ACTIVITY_TYPE_LIST:
            return validation_error(
                f"Invalid activity_type: '{activity_type}'",
                valid_values=ACTIVITY_TYPE_LIST
            )

        result = db.update_activity(activity_id, date, description, activity_type, minutes)
        if not result:
            return not_found_error("Activity")
        context.info(f"Activity {activity_id} updated successfully")
        return {"success": True, "activity": result}

    @mcp.tool()
    def delete_activity(context: Context, activity_id: int) -> dict:
        """Delete an activity/time entry."""
        context.info(f"Deleting activity {activity_id}")
        if db.delete_activity(activity_id):
            context.info(f"Activity {activity_id} deleted successfully")
            return {"success": True, "message": "Activity deleted"}
        return not_found_error("Activity")
