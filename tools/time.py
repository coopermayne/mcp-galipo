"""
Time MCP Tools

Tools for getting the current date and time in Pacific Time.
"""

from datetime import datetime
from zoneinfo import ZoneInfo
from mcp.server.fastmcp import Context


def register_time_tools(mcp):
    """Register time-related MCP tools."""

    @mcp.tool()
    def get_current_time(context: Context) -> dict:
        """
        Get the current date and time in Pacific Time (Los Angeles).

        IMPORTANT: Always call this tool at the start of any conversation or task
        to know the current date and time. This is essential for:
        - Creating events, tasks, or deadlines with correct dates
        - Understanding what "today", "tomorrow", "next week" means
        - Knowing the current year for date-related operations

        Returns:
            date: Current date (e.g., "Sunday, January 26, 2026")
            time: Current time (e.g., "2:30 PM")
            year: Current year as integer
            iso_date: Date in ISO format (YYYY-MM-DD)
            iso_datetime: Full datetime in ISO format
            timezone: Timezone name (Pacific Time)
        """
        context.info("Getting current Pacific Time")
        pacific = ZoneInfo("America/Los_Angeles")
        now = datetime.now(pacific)

        return {
            "success": True,
            "date": now.strftime("%A, %B %d, %Y"),
            "time": now.strftime("%I:%M %p"),
            "year": now.year,
            "iso_date": now.strftime("%Y-%m-%d"),
            "iso_datetime": now.isoformat(),
            "timezone": "Pacific Time (Los Angeles)"
        }
