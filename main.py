"""
MCP Server for Legal Case Management (Proof of Concept)

A minimal FastMCP server exposing tools to query and manage legal cases.
Uses PostgreSQL database for persistent storage.
"""

import os
from datetime import datetime, timedelta
from typing import Optional
from fastmcp import FastMCP

import database as db

# Initialize the MCP server
mcp = FastMCP("Legal Case Management")

# Initialize database on startup
db.init_db()
db.seed_db()


@mcp.tool()
def list_cases() -> dict:
    """
    List all cases with their names and current statuses.

    Returns a summary of all cases in the system.
    """
    cases = db.get_all_cases()
    cases_list = [{"case_name": c["case_name"], "status": c["status"]} for c in cases]
    return {"cases": cases_list, "total": len(cases_list)}


@mcp.tool()
def get_case(case_name: str) -> dict:
    """
    Get full details for a specific case.

    Args:
        case_name: The name of the case to retrieve (e.g., "Smith v. Johnson")

    Returns full case information including activities and deadlines.
    """
    case = db.get_case_by_name(case_name)

    if not case:
        available = db.get_all_case_names()
        return {"error": f"Case '{case_name}' not found", "available_cases": available}

    return case


@mcp.tool()
def get_deadlines(days_ahead: int = 14) -> dict:
    """
    Get upcoming deadlines across all cases.

    Args:
        days_ahead: Number of days to look ahead (default: 14)

    Returns all deadlines within the specified time window.
    """
    deadlines = db.get_upcoming_deadlines(days_ahead)

    return {
        "deadlines": deadlines,
        "total": len(deadlines),
        "days_ahead": days_ahead,
    }


@mcp.tool()
def log_activity(
    case_name: str,
    description: str,
    activity_type: str,
    minutes: Optional[int] = None
) -> dict:
    """
    Log a new activity to a case.

    Args:
        case_name: The name of the case to add activity to
        description: Description of the activity performed
        activity_type: Type of activity (e.g., "Meeting", "Filing", "Research", "Drafting")
        minutes: Optional time spent in minutes

    Returns confirmation of the logged activity.
    """
    today = datetime.now().strftime("%Y-%m-%d")
    activity = db.add_activity(case_name, description, activity_type, minutes, today)

    if not activity:
        available = db.get_all_case_names()
        return {"error": f"Case '{case_name}' not found", "available_cases": available}

    return {
        "success": True,
        "message": f"Activity logged to '{case_name}'",
        "activity": activity,
    }


if __name__ == "__main__":
    # Run the MCP server with SSE transport for remote access
    port = int(os.environ.get("PORT", 8000))
    mcp.run(transport="sse", host="0.0.0.0", port=port)
