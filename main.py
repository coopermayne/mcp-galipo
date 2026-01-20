"""
MCP Server for Legal Case Management (Proof of Concept)

A minimal FastMCP server exposing tools to query and manage legal cases.
Uses PostgreSQL database for persistent storage.
"""

import os
from datetime import datetime, timedelta
from typing import Optional
from fastmcp import FastMCP
from fastapi import Request
from fastapi.responses import HTMLResponse

import database as db

# Initialize the MCP server
mcp = FastMCP("Legal Case Management")


@mcp.custom_route("/", methods=["GET"])
async def dashboard(request: Request):
    """Simple HTML dashboard to view all cases."""
    cases = db.get_all_cases()
    case_names = db.get_all_case_names()

    # Build case details HTML
    cases_html = ""
    for name in case_names:
        case = db.get_case_by_name(name)
        if case:
            activities_html = "".join(
                f"<tr><td>{a['date']}</td><td>{a['type']}</td><td>{a['description']}</td><td>{a['minutes'] or '-'}</td></tr>"
                for a in case["activities"]
            )
            deadlines_html = "".join(
                f"<tr><td>{d['date']}</td><td>{d['description']}</td><td>{d['status']}</td></tr>"
                for d in case["deadlines"]
            )
            cases_html += f"""
            <div class="case">
                <h2>{case['case_name']}</h2>
                <div class="meta">
                    <span><strong>Case #:</strong> {case['case_number']}</span>
                    <span><strong>Client:</strong> {case['client_name']}</span>
                    <span><strong>Status:</strong> <span class="status">{case['status']}</span></span>
                    <span><strong>Court:</strong> {case['court']}</span>
                </div>
                <h3>Activities</h3>
                <table>
                    <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Minutes</th></tr></thead>
                    <tbody>{activities_html if activities_html else '<tr><td colspan="4">No activities</td></tr>'}</tbody>
                </table>
                <h3>Deadlines</h3>
                <table>
                    <thead><tr><th>Date</th><th>Description</th><th>Status</th></tr></thead>
                    <tbody>{deadlines_html if deadlines_html else '<tr><td colspan="3">No deadlines</td></tr>'}</tbody>
                </table>
            </div>
            """

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Legal Case Management</title>
        <style>
            * {{ box-sizing: border-box; }}
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }}
            h1 {{ color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }}
            .case {{ background: white; padding: 20px; margin-bottom: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
            .case h2 {{ margin-top: 0; color: #007bff; }}
            .case h3 {{ color: #555; margin-top: 20px; font-size: 1em; border-bottom: 1px solid #eee; padding-bottom: 5px; }}
            .meta {{ display: flex; flex-wrap: wrap; gap: 20px; color: #666; font-size: 0.9em; margin-bottom: 15px; }}
            .status {{ background: #28a745; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.85em; }}
            table {{ width: 100%; border-collapse: collapse; font-size: 0.9em; }}
            th, td {{ padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; }}
            th {{ background: #f8f9fa; font-weight: 600; color: #555; }}
            tr:hover {{ background: #f8f9fa; }}
            .refresh {{ float: right; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }}
            .refresh:hover {{ background: #0056b3; }}
        </style>
    </head>
    <body>
        <h1>Legal Case Management <button class="refresh" onclick="location.reload()">Refresh</button></h1>
        <p>Total cases: {len(case_names)}</p>
        {cases_html if cases_html else '<p>No cases found.</p>'}
    </body>
    </html>
    """
    return HTMLResponse(content=html)

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
