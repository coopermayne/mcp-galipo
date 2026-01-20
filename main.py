"""
MCP Server for Legal Case Management (Proof of Concept)

A minimal FastMCP server exposing tools to query and manage legal cases.
Uses in-memory mock data for testing MCP connectivity.
"""

from datetime import datetime, timedelta
from typing import Optional
from fastmcp import FastMCP

# Initialize the MCP server
mcp = FastMCP("Legal Case Management")

# Mock data: 3 fake legal cases with activities and deadlines
CASES = {
    "Smith v. Johnson": {
        "case_number": "2024-CV-1234",
        "client_name": "Robert Smith",
        "status": "Active",
        "court": "Superior Court of California, Los Angeles County",
        "activities": [
            {"date": "2024-01-15", "description": "Initial client consultation", "type": "Meeting", "minutes": 60},
            {"date": "2024-02-01", "description": "Filed complaint", "type": "Filing", "minutes": 120},
            {"date": "2024-02-20", "description": "Received defendant's answer", "type": "Document Review", "minutes": 45},
        ],
        "deadlines": [
            {"date": "2024-03-15", "description": "Discovery requests due", "status": "Pending"},
            {"date": "2024-04-30", "description": "Deposition of defendant", "status": "Pending"},
        ],
    },
    "Estate of Williams": {
        "case_number": "2024-PR-5678",
        "client_name": "Sarah Williams",
        "status": "Active",
        "court": "Probate Court, Cook County, Illinois",
        "activities": [
            {"date": "2024-01-20", "description": "Met with executor", "type": "Meeting", "minutes": 90},
            {"date": "2024-02-05", "description": "Filed petition for probate", "type": "Filing", "minutes": 180},
        ],
        "deadlines": [
            {"date": "2024-03-20", "description": "Creditor claims deadline", "status": "Pending"},
        ],
    },
    "Acme Corp Acquisition": {
        "case_number": "2024-MA-9012",
        "client_name": "Acme Corporation",
        "status": "Pending Review",
        "court": "N/A - Transactional",
        "activities": [
            {"date": "2024-02-10", "description": "Due diligence kickoff call", "type": "Meeting", "minutes": 120},
            {"date": "2024-02-15", "description": "Reviewed target financials", "type": "Document Review", "minutes": 240},
            {"date": "2024-02-22", "description": "Drafted letter of intent", "type": "Drafting", "minutes": 180},
        ],
        "deadlines": [
            {"date": "2024-03-01", "description": "LOI signature deadline", "status": "Pending"},
            {"date": "2024-04-15", "description": "Closing date target", "status": "Pending"},
        ],
    },
}


@mcp.tool()
def list_cases() -> dict:
    """
    List all cases with their names and current statuses.

    Returns a summary of all cases in the system.
    """
    cases_list = [
        {"case_name": name, "status": data["status"]}
        for name, data in CASES.items()
    ]
    return {"cases": cases_list, "total": len(cases_list)}


@mcp.tool()
def get_case(case_name: str) -> dict:
    """
    Get full details for a specific case.

    Args:
        case_name: The name of the case to retrieve (e.g., "Smith v. Johnson")

    Returns full case information including activities and deadlines.
    """
    if case_name not in CASES:
        available = list(CASES.keys())
        return {"error": f"Case '{case_name}' not found", "available_cases": available}

    case = CASES[case_name]
    return {
        "case_name": case_name,
        "case_number": case["case_number"],
        "client_name": case["client_name"],
        "status": case["status"],
        "court": case["court"],
        "activities": case["activities"],
        "deadlines": case["deadlines"],
    }


@mcp.tool()
def get_deadlines(days_ahead: int = 14) -> dict:
    """
    Get upcoming deadlines across all cases.

    Args:
        days_ahead: Number of days to look ahead (default: 14)

    Returns all deadlines within the specified time window.
    """
    today = datetime.now().date()
    cutoff = today + timedelta(days=days_ahead)

    upcoming = []
    for case_name, case in CASES.items():
        for deadline in case["deadlines"]:
            deadline_date = datetime.strptime(deadline["date"], "%Y-%m-%d").date()
            # Include all deadlines (for demo purposes, since mock dates are in the past)
            upcoming.append({
                "case_name": case_name,
                "date": deadline["date"],
                "description": deadline["description"],
                "status": deadline["status"],
            })

    # Sort by date
    upcoming.sort(key=lambda x: x["date"])

    return {
        "deadlines": upcoming,
        "total": len(upcoming),
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
    Log a new activity to a case (in-memory only).

    Args:
        case_name: The name of the case to add activity to
        description: Description of the activity performed
        activity_type: Type of activity (e.g., "Meeting", "Filing", "Research", "Drafting")
        minutes: Optional time spent in minutes

    Returns confirmation of the logged activity.
    """
    if case_name not in CASES:
        available = list(CASES.keys())
        return {"error": f"Case '{case_name}' not found", "available_cases": available}

    new_activity = {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "description": description,
        "type": activity_type,
        "minutes": minutes,
    }

    CASES[case_name]["activities"].append(new_activity)

    return {
        "success": True,
        "message": f"Activity logged to '{case_name}'",
        "activity": new_activity,
    }


if __name__ == "__main__":
    # Run the MCP server with SSE transport for remote access
    mcp.run(transport="sse", host="0.0.0.0", port=8000)
