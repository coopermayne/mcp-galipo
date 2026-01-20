"""
MCP Server for Legal Case Management (Personal Injury Litigation)

A FastMCP server exposing tools to query and manage legal cases.
Uses PostgreSQL database for persistent storage.
"""

import os
from datetime import datetime
from typing import Optional
from fastmcp import FastMCP
from fastapi import Request
from fastapi.responses import HTMLResponse

import database as db

# Initialize the MCP server
mcp = FastMCP("Legal Case Management")


@mcp.custom_route("/", methods=["GET"])
async def dashboard(request: Request):
    """HTML dashboard to view all cases with full details."""
    cases = db.get_all_cases()

    # Build case details HTML
    cases_html = ""
    for case_summary in cases:
        case = db.get_case_by_id(case_summary["id"])
        if case:
            # Case numbers
            case_numbers_html = ", ".join(
                f"{cn['case_number']} ({cn['label'] or 'N/A'})"
                + (" [Primary]" if cn['is_primary'] else "")
                for cn in case.get("case_numbers", [])
            ) or "None"

            # Clients
            clients_html = ""
            for cl in case.get("clients", []):
                contact_info = "Direct" if cl["contact_directly"] else f"Via {cl.get('contact_via_name', 'N/A')} ({cl.get('contact_via_relationship', '')})"
                primary_badge = " [Primary]" if cl["is_primary"] else ""
                clients_html += f"<tr><td>{cl['name']}{primary_badge}</td><td>{cl.get('phone', '-')}</td><td>{cl.get('email', '-')}</td><td>{contact_info}</td></tr>"

            # Defendants
            defendants_html = ", ".join(d["name"] for d in case.get("defendants", [])) or "None"

            # Contacts
            contacts_html = ""
            for co in case.get("contacts", []):
                contacts_html += f"<tr><td>{co['name']}</td><td>{co.get('firm', '-')}</td><td>{co['role']}</td><td>{co.get('phone', '-')}</td><td>{co.get('email', '-')}</td></tr>"

            # Activities
            activities_html = ""
            for a in case.get("activities", []):
                activities_html += f"<tr><td>{a['date']}</td><td>{a['type']}</td><td>{a['description']}</td><td>{a.get('minutes') or '-'}</td></tr>"

            # Deadlines
            deadlines_html = ""
            for d in case.get("deadlines", []):
                urgency_class = "urgency-high" if d['urgency'] >= 4 else "urgency-medium" if d['urgency'] >= 3 else "urgency-low"
                deadlines_html += f"<tr class='{urgency_class}'><td>{d['date']}</td><td>{d['description']}</td><td>{d['status']}</td><td>{d['urgency']}</td><td>{d.get('calculation_note', '-')}</td></tr>"

            # Tasks
            tasks_html = ""
            for t in case.get("tasks", []):
                urgency_class = "urgency-high" if t['urgency'] >= 4 else "urgency-medium" if t['urgency'] >= 3 else "urgency-low"
                deadline_ref = f" (linked to: {t['deadline_description']})" if t.get('deadline_description') else ""
                tasks_html += f"<tr class='{urgency_class}'><td>{t.get('due_date', '-')}</td><td>{t['description']}{deadline_ref}</td><td>{t['status']}</td><td>{t['urgency']}</td></tr>"

            # Notes
            notes_html = ""
            for n in case.get("notes", []):
                notes_html += f"<div class='note'><small>{n['created_at']}</small><p>{n['content']}</p></div>"

            # Status badge color
            status_colors = {
                "Signing Up": "#6c757d", "Prospective": "#17a2b8", "Pre-Filing": "#ffc107",
                "Pleadings": "#007bff", "Discovery": "#28a745", "Expert Discovery": "#20c997",
                "Pre-trial": "#fd7e14", "Trial": "#dc3545", "Post-Trial": "#6610f2",
                "Appeal": "#e83e8c", "Settl. Pend.": "#6f42c1", "Stayed": "#adb5bd", "Closed": "#343a40"
            }
            status_color = status_colors.get(case['status'], "#007bff")

            cases_html += f"""
            <div class="case">
                <h2>{case['case_name']}</h2>
                <div class="meta">
                    <span><strong>Status:</strong> <span class="status" style="background:{status_color}">{case['status']}</span></span>
                    <span><strong>Court:</strong> {case.get('court', '-')}</span>
                    <span><strong>Print Code:</strong> {case.get('print_code', '-')}</span>
                </div>
                <div class="meta">
                    <span><strong>Case Numbers:</strong> {case_numbers_html}</span>
                    <span><strong>Defendants:</strong> {defendants_html}</span>
                </div>
                {f'<div class="meta"><strong>Summary:</strong> {case["case_summary"]}</div>' if case.get('case_summary') else ''}
                <div class="meta">
                    <span><strong>Date of Injury:</strong> {case.get('date_of_injury', '-')}</span>
                    <span><strong>Claim Due:</strong> {case.get('claim_due', '-')}</span>
                    <span><strong>Complaint Due:</strong> {case.get('complaint_due', '-')}</span>
                    <span><strong>Trial Date:</strong> {case.get('trial_date', '-')}</span>
                </div>

                <h3>Clients</h3>
                <table>
                    <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Contact Method</th></tr></thead>
                    <tbody>{clients_html if clients_html else '<tr><td colspan="4">No clients</td></tr>'}</tbody>
                </table>

                <h3>Contacts</h3>
                <table>
                    <thead><tr><th>Name</th><th>Firm</th><th>Role</th><th>Phone</th><th>Email</th></tr></thead>
                    <tbody>{contacts_html if contacts_html else '<tr><td colspan="5">No contacts</td></tr>'}</tbody>
                </table>

                <h3>Deadlines</h3>
                <table>
                    <thead><tr><th>Date</th><th>Description</th><th>Status</th><th>Urgency</th><th>Calculation</th></tr></thead>
                    <tbody>{deadlines_html if deadlines_html else '<tr><td colspan="5">No deadlines</td></tr>'}</tbody>
                </table>

                <h3>Tasks</h3>
                <table>
                    <thead><tr><th>Due Date</th><th>Description</th><th>Status</th><th>Urgency</th></tr></thead>
                    <tbody>{tasks_html if tasks_html else '<tr><td colspan="4">No tasks</td></tr>'}</tbody>
                </table>

                <h3>Activities</h3>
                <table>
                    <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Minutes</th></tr></thead>
                    <tbody>{activities_html if activities_html else '<tr><td colspan="4">No activities</td></tr>'}</tbody>
                </table>

                <h3>Notes</h3>
                <div class="notes-container">{notes_html if notes_html else '<p>No notes</p>'}</div>
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
            .meta {{ display: flex; flex-wrap: wrap; gap: 20px; color: #666; font-size: 0.9em; margin-bottom: 10px; }}
            .status {{ color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.85em; }}
            table {{ width: 100%; border-collapse: collapse; font-size: 0.9em; margin-bottom: 10px; }}
            th, td {{ padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; }}
            th {{ background: #f8f9fa; font-weight: 600; color: #555; }}
            tr:hover {{ background: #f8f9fa; }}
            .urgency-high {{ background-color: #ffe6e6; }}
            .urgency-medium {{ background-color: #fff9e6; }}
            .urgency-low {{ background-color: #e6ffe6; }}
            .refresh {{ float: right; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }}
            .refresh:hover {{ background: #0056b3; }}
            .notes-container {{ max-height: 200px; overflow-y: auto; }}
            .note {{ background: #f8f9fa; padding: 10px; margin-bottom: 8px; border-radius: 4px; border-left: 3px solid #007bff; }}
            .note small {{ color: #888; }}
            .note p {{ margin: 5px 0 0 0; }}
        </style>
    </head>
    <body>
        <h1>Legal Case Management <button class="refresh" onclick="location.reload()">Refresh</button></h1>
        <p>Total cases: {len(cases)} | Statuses: {', '.join(db.CASE_STATUSES[:5])}...</p>
        {cases_html if cases_html else '<p>No cases found.</p>'}
    </body>
    </html>
    """
    return HTMLResponse(content=html)


# Initialize database on startup (drop and recreate for migration)
db.drop_all_tables()
db.init_db()
db.seed_db()


# ===== CASE TOOLS =====

@mcp.tool()
def list_cases(status_filter: Optional[str] = None) -> dict:
    """
    List all cases with optional status filter.

    Args:
        status_filter: Optional status to filter by (e.g., "Discovery", "Pre-trial")
                      Valid statuses: Signing Up, Prospective, Pre-Filing, Pleadings,
                      Discovery, Expert Discovery, Pre-trial, Trial, Post-Trial,
                      Appeal, Settl. Pend., Stayed, Closed

    Returns list of cases with id, name, status, court.
    """
    cases = db.get_all_cases(status_filter)
    return {"cases": cases, "total": len(cases), "filter": status_filter}


@mcp.tool()
def get_case(case_id: Optional[int] = None, case_name: Optional[str] = None) -> dict:
    """
    Get full details for a specific case by ID or name.

    Args:
        case_id: The numeric ID of the case
        case_name: The name of the case (e.g., "Martinez v. City of Los Angeles")

    Returns complete case information including clients, defendants, contacts,
    case numbers, activities, deadlines, tasks, and notes.
    """
    if case_id:
        case = db.get_case_by_id(case_id)
    elif case_name:
        case = db.get_case_by_name(case_name)
    else:
        return {"error": "Provide either case_id or case_name"}

    if not case:
        available = db.get_all_case_names()
        return {"error": "Case not found", "available_cases": available}

    return case


@mcp.tool()
def create_case(
    case_name: str,
    status: str = "Signing Up",
    court: Optional[str] = None,
    print_code: Optional[str] = None,
    case_summary: Optional[str] = None,
    date_of_injury: Optional[str] = None
) -> dict:
    """
    Create a new case.

    Args:
        case_name: Name of the case (e.g., "Jones v. LAPD")
        status: Initial status (default: "Signing Up")
        court: Court name
        print_code: Short code for printing/filing
        case_summary: Brief description of the case
        date_of_injury: Date of injury (YYYY-MM-DD format)

    Returns the created case with its ID.
    """
    result = db.create_case(case_name, status, court, print_code, case_summary, date_of_injury)
    return {"success": True, "message": f"Case '{case_name}' created", "case": result}


@mcp.tool()
def update_case(
    case_id: int,
    case_name: Optional[str] = None,
    status: Optional[str] = None,
    court: Optional[str] = None,
    print_code: Optional[str] = None,
    case_summary: Optional[str] = None,
    date_of_injury: Optional[str] = None,
    claim_due: Optional[str] = None,
    claim_filed_date: Optional[str] = None,
    complaint_due: Optional[str] = None,
    complaint_filed_date: Optional[str] = None,
    trial_date: Optional[str] = None
) -> dict:
    """
    Update case fields.

    Args:
        case_id: ID of the case to update
        case_name: New case name
        status: New status
        court: New court
        print_code: New print code
        case_summary: New summary
        date_of_injury: Date of injury (YYYY-MM-DD)
        claim_due: Claim due date (YYYY-MM-DD)
        claim_filed_date: Date claim was filed (YYYY-MM-DD)
        complaint_due: Complaint due date (YYYY-MM-DD)
        complaint_filed_date: Date complaint was filed (YYYY-MM-DD)
        trial_date: Trial date (YYYY-MM-DD)

    Returns updated case info.
    """
    result = db.update_case(
        case_id, case_name=case_name, status=status, court=court,
        print_code=print_code, case_summary=case_summary,
        date_of_injury=date_of_injury, claim_due=claim_due,
        claim_filed_date=claim_filed_date, complaint_due=complaint_due,
        complaint_filed_date=complaint_filed_date, trial_date=trial_date
    )
    if not result:
        return {"error": "Case not found or no updates provided"}
    return {"success": True, "case": result}


# ===== CLIENT TOOLS =====

@mcp.tool()
def add_client(
    case_id: int,
    name: str,
    phone: Optional[str] = None,
    email: Optional[str] = None,
    address: Optional[str] = None,
    contact_directly: bool = True,
    contact_via_name: Optional[str] = None,
    contact_via_relationship: Optional[str] = None,
    is_primary: bool = False,
    notes: Optional[str] = None
) -> dict:
    """
    Add a client to a case. Creates the client and links to case.

    Args:
        case_id: ID of the case
        name: Client's full name
        phone: Phone number
        email: Email address
        address: Mailing address
        contact_directly: Whether to contact client directly (default True)
        contact_via_name: If not direct, name of contact person (e.g., "Rosa Martinez")
        contact_via_relationship: Relationship of contact person (e.g., "Mother", "Guardian")
        is_primary: Whether this is the primary client
        notes: Additional notes

    Returns confirmation of client addition.
    """
    # Create the client
    client = db.create_client(name, phone, email, address, notes)

    # If contacting via someone, find or create that contact
    contact_via_id = None
    if not contact_directly and contact_via_name:
        existing = db.get_contact_by_name(contact_via_name)
        if existing:
            contact_via_id = existing["id"]
        else:
            new_contact = db.create_contact(contact_via_name)
            contact_via_id = new_contact["id"]

    # Link client to case
    link_result = db.add_client_to_case(
        case_id, client["id"], contact_directly,
        contact_via_id, contact_via_relationship, is_primary, notes
    )

    return {
        "success": True,
        "message": f"Client '{name}' added to case",
        "client_id": client["id"],
        "contact_method": "direct" if contact_directly else f"via {contact_via_name} ({contact_via_relationship})"
    }


# ===== CASE NUMBER TOOLS =====

@mcp.tool()
def add_case_number(
    case_id: int,
    case_number: str,
    label: Optional[str] = None,
    is_primary: bool = False
) -> dict:
    """
    Add a case number to a case.

    Args:
        case_id: ID of the case
        case_number: The case number (e.g., "24STCV12345")
        label: Type of case number (e.g., "State", "Federal", "Appeal")
        is_primary: Whether this is the primary case number

    Returns the created case number.
    """
    result = db.add_case_number(case_id, case_number, label, is_primary)
    return {"success": True, "case_number": result}


# ===== CONTACT TOOLS =====

@mcp.tool()
def add_contact(
    name: str,
    firm: Optional[str] = None,
    phone: Optional[str] = None,
    email: Optional[str] = None,
    address: Optional[str] = None,
    notes: Optional[str] = None
) -> dict:
    """
    Create a new contact (opposing counsel, expert, etc).

    Args:
        name: Contact's full name
        firm: Firm or organization name
        phone: Phone number
        email: Email address
        address: Mailing address
        notes: Additional notes

    Returns the created contact with ID.
    """
    result = db.create_contact(name, firm, phone, email, address, notes)
    return {"success": True, "contact": result}


@mcp.tool()
def link_contact(
    case_id: int,
    contact_id: int,
    role: str,
    notes: Optional[str] = None
) -> dict:
    """
    Link an existing contact to a case with a specific role.

    Args:
        case_id: ID of the case
        contact_id: ID of the contact
        role: Role in this case. Valid roles: Opposing Counsel, Co-Counsel,
              Referring Attorney, Mediator, Judge, Magistrate Judge,
              Plaintiff Expert, Defendant Expert, Witness, Client Contact,
              Guardian Ad Litem, Family Contact
        notes: Notes specific to this case/role

    Returns confirmation of the link.
    """
    result = db.link_contact_to_case(case_id, contact_id, role, notes)
    return {"success": True, "message": f"Contact linked as {role}", "result": result}


# ===== DEFENDANT TOOLS =====

@mcp.tool()
def add_defendant(case_id: int, defendant_name: str) -> dict:
    """
    Add a defendant to a case. Creates defendant if not exists.

    Args:
        case_id: ID of the case
        defendant_name: Name of the defendant (e.g., "City of Los Angeles", "LAPD")

    Returns confirmation.
    """
    result = db.add_defendant_to_case(case_id, defendant_name)
    return {"success": True, "message": f"Defendant '{defendant_name}' added to case"}


@mcp.tool()
def search_cases_by_defendant(defendant_name: str) -> dict:
    """
    Search for all cases involving a defendant.

    Args:
        defendant_name: Full or partial defendant name to search

    Returns list of matching cases.
    """
    cases = db.search_cases_by_defendant(defendant_name)
    return {"cases": cases, "total": len(cases), "search": defendant_name}


# ===== ACTIVITY TOOLS =====

@mcp.tool()
def log_activity(
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
    result = db.add_activity(case_id, description, activity_type, date, minutes)
    return {"success": True, "activity": result}


# ===== DEADLINE TOOLS =====

@mcp.tool()
def add_deadline(
    case_id: int,
    date: str,
    description: str,
    urgency: int = 3,
    status: str = "Pending",
    document_link: Optional[str] = None,
    calculation_note: Optional[str] = None
) -> dict:
    """
    Add a court-imposed deadline to a case.

    Args:
        case_id: ID of the case
        date: Deadline date (YYYY-MM-DD)
        description: What is due (e.g., "MSJ due", "Discovery cutoff")
        urgency: 1-5 scale (1=low, 5=critical), default 3
        status: Status (default "Pending")
        document_link: URL to related document
        calculation_note: How the deadline was calculated (e.g., "Filing date + 60 days")

    Returns the created deadline with ID.
    """
    result = db.add_deadline(case_id, date, description, status, urgency, document_link, calculation_note)
    return {"success": True, "deadline": result}


@mcp.tool()
def get_deadlines(
    urgency_filter: Optional[int] = None,
    status_filter: Optional[str] = None
) -> dict:
    """
    Get deadlines across all cases, optionally filtered.

    Args:
        urgency_filter: Minimum urgency level (1-5). E.g., 4 returns urgency 4 and 5.
        status_filter: Filter by status (e.g., "Pending")

    Returns list of deadlines with case information.
    """
    deadlines = db.get_upcoming_deadlines(urgency_filter, status_filter)
    return {"deadlines": deadlines, "total": len(deadlines)}


# ===== TASK TOOLS =====

@mcp.tool()
def add_task(
    case_id: int,
    description: str,
    due_date: Optional[str] = None,
    urgency: int = 3,
    status: str = "Pending",
    deadline_id: Optional[int] = None
) -> dict:
    """
    Add an internal task/to-do to a case.

    Args:
        case_id: ID of the case
        description: What needs to be done
        due_date: Due date (YYYY-MM-DD)
        urgency: 1-5 scale (1=low, 5=critical), default 3
        status: Status (Pending, Active, Done, Partially Complete, Blocked, Awaiting Atty Review)
        deadline_id: Optional ID of deadline this task is linked to

    Returns the created task with ID.
    """
    result = db.add_task(case_id, description, due_date, status, urgency, deadline_id)
    return {"success": True, "task": result}


@mcp.tool()
def get_tasks(
    case_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    urgency_filter: Optional[int] = None
) -> dict:
    """
    Get tasks, optionally filtered by case, status, or urgency.

    Args:
        case_id: Filter by specific case
        status_filter: Filter by status (Pending, Active, Done, etc.)
        urgency_filter: Minimum urgency level (1-5)

    Returns list of tasks with case and deadline information.
    """
    tasks = db.get_tasks(case_id, status_filter, urgency_filter)
    return {"tasks": tasks, "total": len(tasks)}


@mcp.tool()
def update_task(
    task_id: int,
    status: Optional[str] = None,
    urgency: Optional[int] = None,
    due_date: Optional[str] = None
) -> dict:
    """
    Update a task's status, urgency, or due date.

    Args:
        task_id: ID of the task
        status: New status (Pending, Active, Done, Partially Complete, Blocked, Awaiting Atty Review)
        urgency: New urgency (1-5)
        due_date: New due date (YYYY-MM-DD)

    Returns updated task.
    """
    result = db.update_task(task_id, status, urgency, due_date)
    if not result:
        return {"error": "Task not found or no updates provided"}
    return {"success": True, "task": result}


# ===== NOTE TOOLS =====

@mcp.tool()
def add_note(case_id: int, content: str) -> dict:
    """
    Add a note to a case.

    Args:
        case_id: ID of the case
        content: Note content

    Returns the created note with timestamp.
    """
    result = db.add_note(case_id, content)
    return {"success": True, "note": result}


if __name__ == "__main__":
    # Run the MCP server with SSE transport for remote access
    port = int(os.environ.get("PORT", 8000))
    mcp.run(transport="sse", host="0.0.0.0", port=port)
