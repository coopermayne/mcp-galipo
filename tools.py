"""
MCP Tools for Legal Case Management

All MCP tool definitions for querying and managing legal cases.
"""

from typing import Optional
import database as db
from database import ValidationError


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


def register_tools(mcp):
    """Register all MCP tools on the given FastMCP instance."""

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
        date_of_injury: Optional[str] = None,
        case_numbers: Optional[list] = None,
        clients: Optional[list] = None,
        defendants: Optional[list] = None
    ) -> dict:
        """
        Create a new case with optional nested clients, defendants, and case numbers.

        This tool can create a complete case in a single call, including all related entities.

        Args:
            case_name: Name of the case (e.g., "Jones v. LAPD")
            status: Initial status (default: "Signing Up")
            court: Court name
            print_code: Short code for printing/filing
            case_summary: Brief description of the case
            date_of_injury: Date of injury (YYYY-MM-DD format)
            case_numbers: List of case numbers
                          Format: [{"number": "24STCV12345", "label": "State", "primary": true}]
            clients: List of clients/plaintiffs to add
                     Format: [{"name": "Maria Martinez", "phone": "555-1234", "is_primary": true}]
                     Optional fields: email, address, contact_directly, contact_via, contact_via_relationship, notes
            defendants: List of defendant names
                        Format: ["City of Los Angeles", "LAPD"]

        Returns the created case with IDs and summary of added entities.

        Example:
            create_case(
                case_name="Martinez v. City of LA",
                status="Signing Up",
                court="LA Superior Court",
                clients=[{"name": "Maria Martinez", "phone": "555-1234", "is_primary": true}],
                defendants=["City of Los Angeles", "LAPD"],
                case_numbers=[{"number": "24STCV12345", "label": "State", "primary": true}]
            )
        """
        try:
            db.validate_case_status(status)
            if date_of_injury:
                db.validate_date_format(date_of_injury, "date_of_injury")
        except ValidationError as e:
            return validation_error(str(e))

        result = db.create_case(
            case_name, status, court, print_code, case_summary,
            date_of_injury, case_numbers, clients, defendants
        )
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
        trial_date: Optional[str] = None,
        case_numbers: Optional[list] = None
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
            case_numbers: List of case numbers (replaces entire list).
                          Format: [{"number": "24STCV12345", "label": "State", "primary": true}]

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
            complaint_filed_date=complaint_filed_date, trial_date=trial_date,
            case_numbers=case_numbers
        )
        if not result:
            return not_found_error("Case or no updates provided")
        return {"success": True, "case": result}

    # ===== CLIENT TOOLS =====

    @mcp.tool()
    def add_client_to_case(
        case_id: int,
        name: str,
        phone: Optional[str] = None,
        email: Optional[str] = None,
        address: Optional[str] = None,
        contact_directly: bool = True,
        contact_via: Optional[str] = None,
        contact_via_relationship: Optional[str] = None,
        is_primary: bool = False,
        notes: Optional[str] = None
    ) -> dict:
        """
        Add a client to a case. Automatically finds existing client or creates new.

        This smart tool:
        - Searches for existing client by name (+ phone/email if provided)
        - If found, links existing client to case
        - If not found, creates new client and links to case
        - Handles contact preferences (direct or via guardian/family member)

        Args:
            case_id: ID of the case
            name: Client's full name (e.g., "Maria Martinez")
            phone: Phone number (helps match existing clients)
            email: Email address (helps match existing clients)
            address: Mailing address
            contact_directly: Whether to contact client directly (default True)
            contact_via: If not direct, name of contact person (e.g., "Rosa Martinez")
            contact_via_relationship: Relationship (e.g., "Mother", "Guardian", "Spouse")
            is_primary: Whether this is the primary plaintiff
            notes: Additional notes about this client

        Returns confirmation with client_id and whether a new client was created.
        """
        result = db.smart_add_client_to_case(
            case_id, name, phone, email, address,
            contact_directly, contact_via, contact_via_relationship,
            is_primary, notes
        )
        return result

    # ===== CASE NUMBER TOOLS =====
    # NOTE: Case numbers are now managed via update_case(case_id, case_numbers=[...])
    # The individual add_case_number, update_case_number, delete_case_number tools
    # have been removed as part of the interface simplification (Phase 1).

    # ===== CONTACT TOOLS =====

    @mcp.tool()
    def add_contact_to_case(
        case_id: int,
        name: str,
        role: str,
        firm: Optional[str] = None,
        phone: Optional[str] = None,
        email: Optional[str] = None,
        notes: Optional[str] = None
    ) -> dict:
        """
        Add a contact to a case with a specific role. Automatically finds existing or creates new.

        This smart tool:
        - Searches for existing contact by name (+ firm if provided)
        - If found, links existing contact to case with the specified role
        - If not found, creates new contact and links to case

        Args:
            case_id: ID of the case
            name: Contact's full name (e.g., "John Smith", "Hon. Garcia")
            role: Role in this case. Valid roles: Opposing Counsel, Co-Counsel,
                  Referring Attorney, Mediator, Judge, Magistrate Judge,
                  Plaintiff Expert, Defendant Expert, Witness, Client Contact,
                  Guardian Ad Litem, Family Contact
            firm: Firm or organization (e.g., "City Attorney's Office")
            phone: Phone number
            email: Email address
            notes: Notes specific to this case/role

        Returns confirmation with contact_id and whether a new contact was created.
        """
        try:
            db.validate_contact_role(role)
        except ValidationError as e:
            return validation_error(str(e))

        result = db.smart_add_contact_to_case(case_id, name, role, firm, phone, email, notes)
        return result

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
        db.add_defendant_to_case(case_id, defendant_name)
        return {"success": True, "message": f"Defendant '{defendant_name}' added to case"}

    # update_defendant REMOVED - rarely needed; remove and re-add defendant instead

    # search_cases_by_defendant REMOVED - use search_cases(defendant="...") instead

    # ===== SEARCH TOOLS =====

    # search_clients REMOVED - add_client_to_case handles lookup internally
    # Use search_cases(client="...") to find cases by client name

    @mcp.tool()
    def search_cases(
        query: Optional[str] = None,
        case_number: Optional[str] = None,
        defendant: Optional[str] = None,
        client: Optional[str] = None,
        contact: Optional[str] = None,
        status: Optional[str] = None
    ) -> dict:
        """
        Search for cases with multiple filter options.

        All provided filters are combined with AND logic (case must match all filters).
        This replaces the need for separate search_cases_by_defendant tool.

        Args:
            query: Free text search on case name (e.g., "Martinez", "City of LA")
            case_number: Search by case number (e.g., "24STCV", "12345")
            defendant: Filter by defendant name (e.g., "City of Los Angeles")
            client: Filter by client/plaintiff name (e.g., "Martinez")
            contact: Filter by contact name (e.g., "Smith")
            status: Filter by exact status (e.g., "Discovery", "Pre-trial")

        At least one search parameter must be provided.

        Returns matching cases with full context:
        [{id, case_name, status, court, clients, defendants, contacts, case_numbers}]

        Examples:
            - search_cases(query="Martinez") - find cases with "Martinez" in the name
            - search_cases(defendant="LAPD") - find all cases against LAPD
            - search_cases(status="Discovery") - find all cases in Discovery phase
            - search_cases(defendant="City", status="Pre-trial") - cases against "City" in Pre-trial
        """
        if not any([query, case_number, defendant, client, contact, status]):
            return validation_error("Provide at least one search parameter")

        cases = db.search_cases(query, case_number, defendant, client, contact, status)
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
        case_id: Optional[int] = None,
        urgency_filter: Optional[int] = None,
        status_filter: Optional[str] = None,
        due_within_days: Optional[int] = None
    ) -> dict:
        """
        Get deadlines, optionally filtered by case, urgency, status, or due date.

        Args:
            case_id: Filter by specific case
            urgency_filter: Minimum urgency level (1-5). E.g., 4 returns urgency 4 and 5.
            status_filter: Filter by status (e.g., "Pending")
            due_within_days: Only deadlines due within N days from today

        Returns list of deadlines with case information.

        Examples:
            - get_deadlines(due_within_days=7) - deadlines due this week
            - get_deadlines(status_filter="Pending", urgency_filter=5) - critical pending deadlines
            - get_deadlines(case_id=5) - all deadlines for case 5
        """
        result = db.get_upcoming_deadlines(urgency_filter, status_filter, due_within_days, case_id)
        return {"deadlines": result["items"], "total": result["total"]}

    @mcp.tool()
    def get_calendar(
        days: int = 30,
        include_tasks: bool = True,
        include_deadlines: bool = True,
        case_id: Optional[int] = None
    ) -> dict:
        """
        Get a combined calendar view of tasks and deadlines.

        This tool provides a unified view of everything due in the specified time period,
        sorted by date. Great for answering questions like "What's on my calendar this week?"

        Args:
            days: Number of days to look ahead (default 30)
            include_tasks: Include tasks in results (default True)
            include_deadlines: Include deadlines in results (default True)
            case_id: Optional filter to specific case

        Returns combined list sorted by date, with items grouped by date.
        Each item includes: id, date, description, status, urgency, case_id, case_name, item_type

        Examples:
            - get_calendar(days=7) - everything due this week
            - get_calendar(days=1) - what's due today
            - get_calendar(case_id=5, days=30) - calendar for specific case
            - get_calendar(include_tasks=False) - deadlines only
        """
        result = db.get_calendar(days, include_tasks, include_deadlines, case_id)
        return result

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
        urgency_filter: Optional[int] = None,
        due_within_days: Optional[int] = None
    ) -> dict:
        """
        Get tasks, optionally filtered by case, status, urgency, or due date.

        Args:
            case_id: Filter by specific case
            status_filter: Filter by status (Pending, Active, Done, etc.)
            urgency_filter: Minimum urgency level (1-5). E.g., 4 returns urgency 4 and 5.
            due_within_days: Only tasks due within N days from today

        Returns list of tasks with case and deadline information.

        Examples:
            - get_tasks(due_within_days=7) - tasks due this week
            - get_tasks(status_filter="Pending", urgency_filter=4) - urgent pending tasks
            - get_tasks(case_id=5) - all tasks for case 5
        """
        result = db.get_tasks(case_id, status_filter, urgency_filter, due_within_days)
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

    # update_note REMOVED - rarely needed; delete and re-add note instead

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

    # delete_activity REMOVED - rarely needed; activities are typically kept for audit trail

    # ===== LIST TOOLS =====

    # LIST TOOLS REMOVED (Phase 5 cleanup):
    # - list_clients: Use search_cases(client="...") or get_case() to see clients
    # - list_contacts: Use search_contacts() instead
    # - list_activities: Activities are included in get_case() response

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

    # update_client REMOVED - rarely needed; client info typically set once

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

    # update_activity REMOVED - rarely needed; activities are typically immutable time entries

    # ===== REMOVE/UNLINK TOOLS =====

    @mcp.tool()
    def remove_client_from_case(case_id: int, client_name: str) -> dict:
        """
        Remove a client from a case by name (does not delete the client record).

        Args:
            case_id: ID of the case
            client_name: Name of the client to remove (partial match supported)

        Returns confirmation.
        """
        result = db.remove_client_from_case_by_name(case_id, client_name)
        return result

    @mcp.tool()
    def remove_contact_from_case(
        case_id: int,
        contact_name: str,
        role: Optional[str] = None
    ) -> dict:
        """
        Remove a contact from a case by name (does not delete the contact record).

        Args:
            case_id: ID of the case
            contact_name: Name of the contact to remove (partial match supported)
            role: Optional specific role to remove (if contact has multiple roles)

        Returns confirmation.
        """
        result = db.remove_contact_from_case_by_name(case_id, contact_name, role)
        return result

    @mcp.tool()
    def remove_defendant_from_case(case_id: int, defendant_name: str) -> dict:
        """
        Remove a defendant from a case by name (does not delete the defendant record).

        Args:
            case_id: ID of the case
            defendant_name: Name of the defendant to remove (partial match supported)

        Returns confirmation.
        """
        result = db.remove_defendant_from_case_by_name(case_id, defendant_name)
        return result
