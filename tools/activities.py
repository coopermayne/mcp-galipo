"""
Activity MCP Tools

Tools for logging and managing time/activity entries in the legal case management system.
"""

from typing import Optional
from mcp.server.fastmcp import Context
import database as db
from database import ValidationError
from tools.utils import validation_error, not_found_error


def register_activity_tools(mcp):
    """Register activity-related MCP tools."""

    @mcp.tool()
    def get_activities(context: Context, case_id: Optional[int] = None) -> dict:
        """
        Get activities/time entries, optionally filtered by case.

        Args:
            case_id: Filter by specific case (optional)

        Returns list of activities with case information.

        Examples:
            get_activities() - all activities
            get_activities(case_id=5) - activities for case 5
        """
        context.info(f"Fetching activities{' for case ' + str(case_id) if case_id else ''}")
        result = db.get_activities(case_id)
        context.info(f"Found {result['total']} activities")
        return {"success": True, "activities": result["activities"], "total": result["total"]}

    @mcp.tool()
    def log_activity(
        context: Context,
        case_id: int,
        description: str,
        activity_type: str,
        minutes: Optional[int] = None,
        date: Optional[str] = None
    ) -> dict:
        """
        Log a time/activity entry to a case.

        Args:
            case_id: ID of the case
            description: Description of the activity
            activity_type: Type (e.g., "Meeting", "Filing", "Research", "Drafting", "Document Review")
            minutes: Time spent in minutes
            date: Date of activity (YYYY-MM-DD), defaults to today

        Returns the logged activity.
        """
        context.info(f"Logging {activity_type} activity for case {case_id}")
        try:
            if date:
                db.validate_date_format(date, "date")
        except ValidationError as e:
            return validation_error(str(e))

        # Default to today if no date provided
        if not date:
            from datetime import date as dt_date
            date = dt_date.today().isoformat()

        result = db.add_activity(case_id, description, activity_type, date, minutes)
        context.info(f"Activity logged with ID {result.get('id')}")
        return {"success": True, "activity": result}

    @mcp.tool()
    def update_activity(
        context: Context,
        activity_id: int,
        date: Optional[str] = None,
        description: Optional[str] = None,
        activity_type: Optional[str] = None,
        minutes: Optional[int] = None
    ) -> dict:
        """
        Update an activity/time entry.

        Args:
            activity_id: ID of the activity to update
            date: New date (YYYY-MM-DD)
            description: New description
            activity_type: New type (e.g., "Meeting", "Filing", "Research")
            minutes: New time spent in minutes

        Returns updated activity.
        """
        context.info(f"Updating activity {activity_id}")
        try:
            if date:
                db.validate_date_format(date, "date")
        except ValidationError as e:
            return validation_error(str(e))

        result = db.update_activity(activity_id, date, description, activity_type, minutes)
        if not result:
            return not_found_error("Activity or no updates provided")
        context.info(f"Activity {activity_id} updated successfully")
        return {"success": True, "activity": result}

    @mcp.tool()
    def delete_activity(context: Context, activity_id: int) -> dict:
        """
        Delete an activity/time entry.

        Args:
            activity_id: ID of the activity to delete

        Returns confirmation.
        """
        context.info(f"Deleting activity {activity_id}")
        if db.delete_activity(activity_id):
            context.info(f"Activity {activity_id} deleted successfully")
            return {"success": True, "message": "Activity deleted"}
        return not_found_error("Activity")
