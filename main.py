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
from fastapi.responses import HTMLResponse, FileResponse
from pathlib import Path

import database as db
from database import ValidationError

STATIC_DIR = Path(__file__).parent / "static"


# ===== STANDARD ERROR RESPONSES =====

def error_response(message: str, code: str) -> dict:
    """Create a standardized error response for MCP tools."""
    return {"success": False, "error": {"message": message, "code": code}}


def validation_error(message: str) -> dict:
    """Create a validation error response."""
    return error_response(message, "VALIDATION_ERROR")


def not_found_error(resource: str) -> dict:
    """Create a not found error response."""
    return error_response(f"{resource} not found", "NOT_FOUND")


def api_error(message: str, code: str, status_code: int = 400):
    """Create a standardized API error response."""
    from fastapi.responses import JSONResponse
    return JSONResponse(
        {"success": False, "error": {"message": message, "code": code}},
        status_code=status_code
    )

# Initialize the MCP server
mcp = FastMCP("Legal Case Management")


@mcp.custom_route("/", methods=["GET"])
async def dashboard(request: Request):
    """Modern SPA dashboard for legal case management."""
    html = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Legal Case Management</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/static/styles.css">
</head>
<body>
    <div class="app-container">
        <aside class="sidebar">
            <div class="sidebar-header">
                <h1>Case Manager</h1>
            </div>
            <nav class="sidebar-nav">
                <a class="nav-item active" data-view="dashboard" onclick="navigate('dashboard')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                    Dashboard
                </a>
                <a class="nav-item" data-view="cases" onclick="navigate('cases')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                    Cases
                </a>
                <a class="nav-item" data-view="tasks" onclick="navigate('tasks')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                    Tasks
                </a>
                <a class="nav-item" data-view="deadlines" onclick="navigate('deadlines')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    Deadlines
                </a>
            </nav>
        </aside>
        <main class="main-content" id="main-content">
            <div class="loading"><div class="spinner"></div></div>
        </main>
    </div>

    <div class="modal-overlay" id="modal-overlay" onclick="if(event.target === this) closeModal()">
        <div class="modal" id="modal-content"></div>
    </div>

    <div class="toast-container" id="toast-container"></div>

    <script src="/static/app.js"></script>
</body>
</html>
    """
    return HTMLResponse(content=html)


@mcp.custom_route("/static/{filename:path}", methods=["GET"])
async def serve_static(request: Request):
    """Serve static files."""
    filename = request.path_params["filename"]
    file_path = STATIC_DIR / filename
    if file_path.exists() and file_path.is_file():
        content_types = {
            ".css": "text/css",
            ".js": "application/javascript",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".svg": "image/svg+xml"
        }
        content_type = content_types.get(file_path.suffix, "application/octet-stream")
        return FileResponse(file_path, media_type=content_type)
    return HTMLResponse("Not found", status_code=404)


# Initialize database on startup
# Only drop/recreate tables if RESET_DB=true (for development/testing)
if os.environ.get("RESET_DB", "").lower() == "true":
    print("RESET_DB=true: Dropping and recreating all tables...")
    db.drop_all_tables()
    db.init_db()
    db.seed_db()
else:
    # Just ensure tables exist (safe for production)
    db.init_db()


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
    result = db.get_all_cases(status_filter)
    return {"cases": result["items"], "total": result["total"], "filter": status_filter}


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
        return validation_error("Provide either case_id or case_name")

    if not case:
        available = db.get_all_case_names()
        result = not_found_error("Case")
        result["available_cases"] = available
        return result

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
    try:
        db.validate_case_status(status)
        if date_of_injury:
            db.validate_date_format(date_of_injury, "date_of_injury")
    except ValidationError as e:
        return validation_error(str(e))

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
    try:
        if status:
            db.validate_case_status(status)
        for field_name, value in [
            ("date_of_injury", date_of_injury), ("claim_due", claim_due),
            ("claim_filed_date", claim_filed_date), ("complaint_due", complaint_due),
            ("complaint_filed_date", complaint_filed_date), ("trial_date", trial_date)
        ]:
            if value:
                db.validate_date_format(value, field_name)
    except ValidationError as e:
        return validation_error(str(e))

    result = db.update_case(
        case_id, case_name=case_name, status=status, court=court,
        print_code=print_code, case_summary=case_summary,
        date_of_injury=date_of_injury, claim_due=claim_due,
        claim_filed_date=claim_filed_date, complaint_due=complaint_due,
        complaint_filed_date=complaint_filed_date, trial_date=trial_date
    )
    if not result:
        return not_found_error("Case or no updates provided")
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
    try:
        db.validate_contact_role(role)
    except ValidationError as e:
        return validation_error(str(e))

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


# ===== SEARCH TOOLS =====

@mcp.tool()
def search_clients(
    name: Optional[str] = None,
    phone: Optional[str] = None,
    email: Optional[str] = None
) -> dict:
    """
    Search for clients/plaintiffs by name, phone, or email (partial match).

    Use this to find a client before updating their info or to disambiguate
    when multiple clients might match. Returns clients with their case
    associations so you can identify the right person.

    Args:
        name: Full or partial client name (e.g., "Martinez")
        phone: Full or partial phone number
        email: Full or partial email address

    At least one search parameter must be provided.

    Returns matching clients with their case associations:
    [{id, name, phone, email, cases: [{id, case_name, status}]}]
    """
    if not any([name, phone, email]):
        return validation_error("Provide at least one search parameter (name, phone, or email)")

    clients = db.search_clients(name, phone, email)
    return {"clients": clients, "total": len(clients)}


@mcp.tool()
def search_cases(
    name: Optional[str] = None,
    case_number: Optional[str] = None
) -> dict:
    """
    Search for cases by name or case number (partial match).

    Use this to find a case before performing operations on it.
    Returns cases with their clients and defendants for context.

    Args:
        name: Full or partial case name (e.g., "Martinez", "City of LA")
        case_number: Full or partial case number (e.g., "24STCV", "12345")

    At least one search parameter must be provided.

    Returns matching cases with context:
    [{id, case_name, status, clients: [{id, name}], defendants: [{id, name}], case_numbers: [...]}]
    """
    if not any([name, case_number]):
        return validation_error("Provide at least one search parameter (name or case_number)")

    cases = db.search_cases(name, case_number)
    return {"cases": cases, "total": len(cases)}


@mcp.tool()
def search_contacts(
    name: Optional[str] = None,
    firm: Optional[str] = None
) -> dict:
    """
    Search for contacts by name or firm (partial match).

    Contacts include opposing counsel, experts, judges, mediators, etc.
    Use this to find a contact before updating their info or linking to a case.
    Returns contacts with their case/role associations.

    Args:
        name: Full or partial contact name (e.g., "Smith", "Dr. Johnson")
        firm: Full or partial firm name (e.g., "City Attorney")

    At least one search parameter must be provided.

    Returns matching contacts with their case associations:
    [{id, name, firm, phone, email, cases: [{id, case_name, role}]}]
    """
    if not any([name, firm]):
        return validation_error("Provide at least one search parameter (name or firm)")

    contacts = db.search_contacts(name, firm)
    return {"contacts": contacts, "total": len(contacts)}


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
    try:
        if date:
            db.validate_date_format(date, "date")
    except ValidationError as e:
        return validation_error(str(e))

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
    try:
        db.validate_date_format(date, "date")
        db.validate_urgency(urgency)
    except ValidationError as e:
        return validation_error(str(e))

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
    result = db.get_upcoming_deadlines(urgency_filter, status_filter)
    return {"deadlines": result["items"], "total": result["total"]}


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
    try:
        db.validate_task_status(status)
        db.validate_urgency(urgency)
        if due_date:
            db.validate_date_format(due_date, "due_date")
    except ValidationError as e:
        return validation_error(str(e))

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
    result = db.get_tasks(case_id, status_filter, urgency_filter)
    return {"tasks": result["items"], "total": result["total"]}


@mcp.tool()
def update_task(
    task_id: int,
    description: Optional[str] = None,
    status: Optional[str] = None,
    urgency: Optional[int] = None,
    due_date: Optional[str] = None
) -> dict:
    """
    Update a task's description, status, urgency, or due date.

    Args:
        task_id: ID of the task
        description: New description
        status: New status (Pending, Active, Done, Partially Complete, Blocked, Awaiting Atty Review)
        urgency: New urgency (1-5)
        due_date: New due date (YYYY-MM-DD)

    Returns updated task.
    """
    try:
        if status:
            db.validate_task_status(status)
        if urgency is not None:
            db.validate_urgency(urgency)
        if due_date:
            db.validate_date_format(due_date, "due_date")
    except ValidationError as e:
        return validation_error(str(e))

    result = db.update_task_full(task_id, description, due_date, status, urgency)
    if not result:
        return not_found_error("Task or no updates provided")
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


@mcp.tool()
def update_note(note_id: int, content: str) -> dict:
    """
    Update a note's content.

    Args:
        note_id: ID of the note
        content: New content

    Returns updated note.
    """
    result = db.update_note(note_id, content)
    if not result:
        return not_found_error("Note")
    return {"success": True, "note": result}


@mcp.tool()
def delete_note(note_id: int) -> dict:
    """
    Delete a note.

    Args:
        note_id: ID of the note to delete

    Returns confirmation.
    """
    if db.delete_note(note_id):
        return {"success": True, "message": "Note deleted"}
    return not_found_error("Note")


# ===== DELETE TOOLS =====

@mcp.tool()
def delete_task(task_id: int) -> dict:
    """
    Delete a task.

    Args:
        task_id: ID of the task to delete

    Returns confirmation.
    """
    if db.delete_task(task_id):
        return {"success": True, "message": "Task deleted"}
    return not_found_error("Task")


@mcp.tool()
def delete_deadline(deadline_id: int) -> dict:
    """
    Delete a deadline.

    Args:
        deadline_id: ID of the deadline to delete

    Returns confirmation.
    """
    if db.delete_deadline(deadline_id):
        return {"success": True, "message": "Deadline deleted"}
    return not_found_error("Deadline")


@mcp.tool()
def delete_case(case_id: int) -> dict:
    """
    Delete a case and all related data (clients, deadlines, tasks, notes, etc. are CASCADE deleted).

    Args:
        case_id: ID of the case to delete

    Returns confirmation.
    """
    if db.delete_case(case_id):
        return {"success": True, "message": "Case and all related data deleted"}
    return not_found_error("Case")


@mcp.tool()
def delete_activity(activity_id: int) -> dict:
    """
    Delete an activity/time entry.

    Args:
        activity_id: ID of the activity to delete

    Returns confirmation.
    """
    if db.delete_activity(activity_id):
        return {"success": True, "message": "Activity deleted"}
    return not_found_error("Activity")


@mcp.tool()
def delete_case_number(case_number_id: int) -> dict:
    """
    Delete a case number.

    Args:
        case_number_id: ID of the case number to delete

    Returns confirmation.
    """
    if db.delete_case_number(case_number_id):
        return {"success": True, "message": "Case number deleted"}
    return not_found_error("Case number")


# ===== LIST TOOLS =====

@mcp.tool()
def list_clients() -> dict:
    """
    List all clients in the system.

    Returns list of clients with contact information.
    """
    clients = db.get_all_clients()
    return {"clients": clients, "total": len(clients)}


@mcp.tool()
def list_contacts() -> dict:
    """
    List all contacts in the system (opposing counsel, experts, judges, etc.).

    Returns list of contacts with firm and contact information.
    """
    contacts = db.get_all_contacts()
    return {"contacts": contacts, "total": len(contacts)}


@mcp.tool()
def list_activities(case_id: Optional[int] = None) -> dict:
    """
    List activities/time entries, optionally filtered by case.

    Args:
        case_id: Optional case ID to filter by

    Returns list of activities.
    """
    activities = db.get_all_activities(case_id)
    return {"activities": activities, "total": len(activities)}


# ===== UPDATE TOOLS =====

@mcp.tool()
def update_deadline(
    deadline_id: int,
    date: Optional[str] = None,
    description: Optional[str] = None,
    status: Optional[str] = None,
    urgency: Optional[int] = None,
    document_link: Optional[str] = None,
    calculation_note: Optional[str] = None
) -> dict:
    """
    Update a deadline.

    Args:
        deadline_id: ID of the deadline
        date: New date (YYYY-MM-DD)
        description: New description
        status: New status
        urgency: New urgency (1-5)
        document_link: New document link
        calculation_note: New calculation note

    Returns updated deadline.
    """
    try:
        if date:
            db.validate_date_format(date, "date")
        if urgency is not None:
            db.validate_urgency(urgency)
    except ValidationError as e:
        return validation_error(str(e))

    result = db.update_deadline_full(deadline_id, date, description, status,
                                      urgency, document_link, calculation_note)
    if not result:
        return not_found_error("Deadline or no updates provided")
    return {"success": True, "deadline": result}


@mcp.tool()
def update_client(
    client_id: int,
    name: Optional[str] = None,
    phone: Optional[str] = None,
    email: Optional[str] = None,
    address: Optional[str] = None,
    notes: Optional[str] = None
) -> dict:
    """
    Update a client's information.

    Args:
        client_id: ID of the client
        name: New name
        phone: New phone
        email: New email
        address: New address
        notes: New notes

    Returns updated client.
    """
    result = db.update_client(client_id, name, phone, email, address, notes)
    if not result:
        return not_found_error("Client or no updates provided")
    return {"success": True, "client": result}


@mcp.tool()
def update_contact(
    contact_id: int,
    name: Optional[str] = None,
    firm: Optional[str] = None,
    phone: Optional[str] = None,
    email: Optional[str] = None,
    address: Optional[str] = None,
    notes: Optional[str] = None
) -> dict:
    """
    Update a contact's information.

    Args:
        contact_id: ID of the contact
        name: New name
        firm: New firm
        phone: New phone
        email: New email
        address: New address
        notes: New notes

    Returns updated contact.
    """
    result = db.update_contact(contact_id, name, firm, phone, email, address, notes)
    if not result:
        return not_found_error("Contact or no updates provided")
    return {"success": True, "contact": result}


@mcp.tool()
def update_activity(
    activity_id: int,
    date: Optional[str] = None,
    description: Optional[str] = None,
    activity_type: Optional[str] = None,
    minutes: Optional[int] = None
) -> dict:
    """
    Update an activity/time entry.

    Args:
        activity_id: ID of the activity
        date: New date (YYYY-MM-DD)
        description: New description
        activity_type: New type
        minutes: New minutes

    Returns updated activity.
    """
    try:
        if date:
            db.validate_date_format(date, "date")
    except ValidationError as e:
        return validation_error(str(e))

    result = db.update_activity(activity_id, date, description, activity_type, minutes)
    if not result:
        return not_found_error("Activity or no updates provided")
    return {"success": True, "activity": result}


# ===== REMOVE/UNLINK TOOLS =====

@mcp.tool()
def remove_client_from_case(case_id: int, client_id: int) -> dict:
    """
    Remove a client from a case (does not delete the client record).

    Args:
        case_id: ID of the case
        client_id: ID of the client to remove

    Returns confirmation.
    """
    if db.remove_client_from_case(case_id, client_id):
        return {"success": True, "message": "Client removed from case"}
    return not_found_error("Client-case link")


@mcp.tool()
def remove_contact_from_case(
    case_id: int,
    contact_id: int,
    role: Optional[str] = None
) -> dict:
    """
    Remove a contact from a case (does not delete the contact record).

    Args:
        case_id: ID of the case
        contact_id: ID of the contact to remove
        role: Optional specific role to remove (if contact has multiple roles)

    Returns confirmation.
    """
    if db.remove_contact_from_case(case_id, contact_id, role):
        return {"success": True, "message": "Contact removed from case"}
    return not_found_error("Contact-case link")


@mcp.tool()
def remove_defendant_from_case(case_id: int, defendant_id: int) -> dict:
    """
    Remove a defendant from a case (does not delete the defendant record).

    Args:
        case_id: ID of the case
        defendant_id: ID of the defendant to remove

    Returns confirmation.
    """
    if db.remove_defendant_from_case(case_id, defendant_id):
        return {"success": True, "message": "Defendant removed from case"}
    return not_found_error("Defendant-case link")


# ===== REST API ENDPOINTS FOR FRONTEND =====

from fastapi import HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional as Opt

class TaskCreate(BaseModel):
    case_id: int
    description: str
    due_date: Opt[str] = None
    urgency: int = 3
    status: str = "Pending"

class TaskUpdate(BaseModel):
    description: Opt[str] = None
    due_date: Opt[str] = None
    status: Opt[str] = None
    urgency: Opt[int] = None

class DeadlineCreate(BaseModel):
    case_id: int
    date: str
    description: str
    urgency: int = 3
    status: str = "Pending"
    document_link: Opt[str] = None
    calculation_note: Opt[str] = None

class DeadlineUpdate(BaseModel):
    date: Opt[str] = None
    description: Opt[str] = None
    status: Opt[str] = None
    urgency: Opt[int] = None
    document_link: Opt[str] = None
    calculation_note: Opt[str] = None

class CaseCreate(BaseModel):
    case_name: str
    status: str = "Signing Up"
    court: Opt[str] = None
    print_code: Opt[str] = None
    case_summary: Opt[str] = None
    date_of_injury: Opt[str] = None

class CaseUpdate(BaseModel):
    case_name: Opt[str] = None
    status: Opt[str] = None
    court: Opt[str] = None
    print_code: Opt[str] = None
    case_summary: Opt[str] = None
    date_of_injury: Opt[str] = None
    claim_due: Opt[str] = None
    claim_filed_date: Opt[str] = None
    complaint_due: Opt[str] = None
    complaint_filed_date: Opt[str] = None
    trial_date: Opt[str] = None

class NoteCreate(BaseModel):
    case_id: int
    content: str

# API Routes
@mcp.custom_route("/api/v1/stats", methods=["GET"])
async def api_stats(request):
    stats = db.get_dashboard_stats()
    return JSONResponse(stats)

@mcp.custom_route("/api/v1/cases", methods=["GET"])
async def api_list_cases(request):
    status = request.query_params.get("status")
    limit = request.query_params.get("limit")
    offset = request.query_params.get("offset", "0")
    limit = int(limit) if limit else db.DEFAULT_PAGE_SIZE
    offset = int(offset)
    result = db.get_all_cases(status, limit=limit, offset=offset)
    return JSONResponse({
        "cases": result["items"],
        "total": result["total"],
        "limit": result["limit"],
        "offset": result["offset"]
    })

@mcp.custom_route("/api/v1/cases/{case_id}", methods=["GET"])
async def api_get_case(request):
    case_id = int(request.path_params["case_id"])
    case = db.get_case_by_id(case_id)
    if not case:
        return api_error("Case not found", "NOT_FOUND", 404)
    return JSONResponse(case)

@mcp.custom_route("/api/v1/cases", methods=["POST"])
async def api_create_case(request):
    data = await request.json()
    result = db.create_case(
        data["case_name"],
        data.get("status", "Signing Up"),
        data.get("court"),
        data.get("print_code"),
        data.get("case_summary"),
        data.get("date_of_injury")
    )
    return JSONResponse({"success": True, "case": result})

@mcp.custom_route("/api/v1/cases/{case_id}", methods=["PUT"])
async def api_update_case(request):
    case_id = int(request.path_params["case_id"])
    data = await request.json()
    result = db.update_case(case_id, **data)
    if not result:
        return api_error("Case not found", "NOT_FOUND", 404)
    return JSONResponse({"success": True, "case": result})

@mcp.custom_route("/api/v1/cases/{case_id}", methods=["DELETE"])
async def api_delete_case(request):
    case_id = int(request.path_params["case_id"])
    if db.delete_case(case_id):
        return JSONResponse({"success": True})
    return api_error("Case not found", "NOT_FOUND", 404)

@mcp.custom_route("/api/v1/tasks", methods=["GET"])
async def api_list_tasks(request):
    case_id = request.query_params.get("case_id")
    status = request.query_params.get("status")
    urgency = request.query_params.get("urgency")
    limit = request.query_params.get("limit")
    offset = request.query_params.get("offset", "0")
    limit = int(limit) if limit else db.DEFAULT_PAGE_SIZE
    offset = int(offset)
    result = db.get_tasks(
        int(case_id) if case_id else None,
        status,
        int(urgency) if urgency else None,
        limit=limit,
        offset=offset
    )
    return JSONResponse({
        "tasks": result["items"],
        "total": result["total"],
        "limit": result["limit"],
        "offset": result["offset"]
    })

@mcp.custom_route("/api/v1/tasks", methods=["POST"])
async def api_create_task(request):
    data = await request.json()
    result = db.add_task(
        data["case_id"],
        data["description"],
        data.get("due_date"),
        data.get("status", "Pending"),
        data.get("urgency", 3),
        data.get("deadline_id")
    )
    return JSONResponse({"success": True, "task": result})

@mcp.custom_route("/api/v1/tasks/{task_id}", methods=["PUT"])
async def api_update_task(request):
    task_id = int(request.path_params["task_id"])
    data = await request.json()
    result = db.update_task_full(task_id, **data)
    if not result:
        return api_error("Task not found", "NOT_FOUND", 404)
    return JSONResponse({"success": True, "task": result})

@mcp.custom_route("/api/v1/tasks/{task_id}", methods=["DELETE"])
async def api_delete_task(request):
    task_id = int(request.path_params["task_id"])
    if db.delete_task(task_id):
        return JSONResponse({"success": True})
    return api_error("Task not found", "NOT_FOUND", 404)

@mcp.custom_route("/api/v1/deadlines", methods=["GET"])
async def api_list_deadlines(request):
    urgency = request.query_params.get("urgency")
    status = request.query_params.get("status")
    limit = request.query_params.get("limit")
    offset = request.query_params.get("offset", "0")
    limit = int(limit) if limit else db.DEFAULT_PAGE_SIZE
    offset = int(offset)
    result = db.get_upcoming_deadlines(
        int(urgency) if urgency else None,
        status,
        limit=limit,
        offset=offset
    )
    return JSONResponse({
        "deadlines": result["items"],
        "total": result["total"],
        "limit": result["limit"],
        "offset": result["offset"]
    })

@mcp.custom_route("/api/v1/deadlines", methods=["POST"])
async def api_create_deadline(request):
    data = await request.json()
    result = db.add_deadline(
        data["case_id"],
        data["date"],
        data["description"],
        data.get("status", "Pending"),
        data.get("urgency", 3),
        data.get("document_link"),
        data.get("calculation_note")
    )
    return JSONResponse({"success": True, "deadline": result})

@mcp.custom_route("/api/v1/deadlines/{deadline_id}", methods=["PUT"])
async def api_update_deadline(request):
    deadline_id = int(request.path_params["deadline_id"])
    data = await request.json()
    result = db.update_deadline_full(deadline_id, **data)
    if not result:
        return api_error("Deadline not found", "NOT_FOUND", 404)
    return JSONResponse({"success": True, "deadline": result})

@mcp.custom_route("/api/v1/deadlines/{deadline_id}", methods=["DELETE"])
async def api_delete_deadline(request):
    deadline_id = int(request.path_params["deadline_id"])
    if db.delete_deadline(deadline_id):
        return JSONResponse({"success": True})
    return api_error("Deadline not found", "NOT_FOUND", 404)

@mcp.custom_route("/api/v1/notes", methods=["POST"])
async def api_create_note(request):
    data = await request.json()
    result = db.add_note(data["case_id"], data["content"])
    return JSONResponse({"success": True, "note": result})

@mcp.custom_route("/api/v1/notes/{note_id}", methods=["DELETE"])
async def api_delete_note(request):
    note_id = int(request.path_params["note_id"])
    if db.delete_note(note_id):
        return JSONResponse({"success": True})
    return api_error("Note not found", "NOT_FOUND", 404)

@mcp.custom_route("/api/v1/constants", methods=["GET"])
async def api_constants(request):
    return JSONResponse({
        "case_statuses": db.CASE_STATUSES,
        "contact_roles": db.CONTACT_ROLES,
        "task_statuses": db.TASK_STATUSES
    })


if __name__ == "__main__":
    # Run the MCP server with SSE transport for remote access
    port = int(os.environ.get("PORT", 8000))
    mcp.run(transport="sse", host="0.0.0.0", port=port)
