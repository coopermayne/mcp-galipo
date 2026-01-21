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

    # ===== JURISDICTION TOOLS =====

    @mcp.tool()
    def list_jurisdictions() -> dict:
        """
        List all jurisdictions (courts).

        Returns list of jurisdictions with id, name, local_rules_link, and notes.
        """
        jurisdictions = db.get_jurisdictions()
        return {"success": True, "jurisdictions": jurisdictions, "total": len(jurisdictions)}

    @mcp.tool()
    def manage_jurisdiction(
        name: str,
        jurisdiction_id: Optional[int] = None,
        local_rules_link: Optional[str] = None,
        notes: Optional[str] = None
    ) -> dict:
        """
        Create or update a jurisdiction (court).

        Args:
            name: Name of the jurisdiction (e.g., "C.D. Cal.", "Los Angeles Superior")
            jurisdiction_id: ID if updating existing jurisdiction (omit to create new)
            local_rules_link: URL to local rules
            notes: Additional notes

        Returns the created/updated jurisdiction.
        """
        if jurisdiction_id:
            result = db.update_jurisdiction(jurisdiction_id, name, local_rules_link, notes)
            if not result:
                return not_found_error("Jurisdiction")
            return {"success": True, "jurisdiction": result, "action": "updated"}
        else:
            result = db.create_jurisdiction(name, local_rules_link, notes)
            return {"success": True, "jurisdiction": result, "action": "created"}

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

        Returns list of cases with id, name, short_name, status, court.
        """
        result = db.get_all_cases(status_filter)
        return {"cases": result["cases"], "total": result["total"], "filter": status_filter}

    @mcp.tool()
    def get_case(case_id: Optional[int] = None, case_name: Optional[str] = None) -> dict:
        """
        Get full details for a specific case by ID or name.

        Args:
            case_id: The numeric ID of the case
            case_name: The name of the case (e.g., "Martinez v. City of Los Angeles")

        Returns complete case information including persons (clients, defendants, contacts),
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
        court_id: Optional[int] = None,
        print_code: Optional[str] = None,
        case_summary: Optional[str] = None,
        result: Optional[str] = None,
        date_of_injury: Optional[str] = None,
        case_numbers: Optional[list] = None,
        short_name: Optional[str] = None
    ) -> dict:
        """
        Create a new case.

        After creating a case, use assign_person_to_case to add clients, defendants,
        opposing counsel, judges, experts, etc.

        Args:
            case_name: Name of the case (e.g., "Jones v. LAPD")
            status: Initial status (default: "Signing Up")
            court_id: ID of the jurisdiction/court (use list_jurisdictions to see options)
            print_code: Short code for printing/filing
            case_summary: Brief description of the case
            result: Case outcome/result (e.g., "Settled", "Verdict for plaintiff")
            date_of_injury: Date of injury (YYYY-MM-DD format)
            case_numbers: List of case numbers
                          Format: [{"number": "24STCV12345", "label": "State", "primary": true}]
            short_name: Short display name (defaults to first word of case_name)

        Returns the created case.

        Example:
            create_case(
                case_name="Martinez v. City of LA",
                status="Signing Up",
                court_id=1,
                case_numbers=[{"number": "24STCV12345", "label": "State", "primary": true}]
            )
        """
        try:
            db.validate_case_status(status)
            if date_of_injury:
                db.validate_date_format(date_of_injury, "date_of_injury")
        except ValidationError as e:
            return validation_error(str(e))

        case = db.create_case(
            case_name, status, court_id, print_code, case_summary, result,
            date_of_injury, case_numbers, short_name
        )
        return {"success": True, "message": f"Case '{case_name}' created", "case": case}

    @mcp.tool()
    def update_case(
        case_id: int,
        case_name: Optional[str] = None,
        short_name: Optional[str] = None,
        status: Optional[str] = None,
        court_id: Optional[int] = None,
        print_code: Optional[str] = None,
        case_summary: Optional[str] = None,
        result: Optional[str] = None,
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
            short_name: New short display name
            status: New status
            court_id: New court/jurisdiction ID
            print_code: New print code
            case_summary: New summary
            result: Case outcome/result
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

        updated = db.update_case(
            case_id, case_name=case_name, short_name=short_name, status=status,
            court_id=court_id, print_code=print_code, case_summary=case_summary,
            result=result, date_of_injury=date_of_injury, claim_due=claim_due,
            claim_filed_date=claim_filed_date, complaint_due=complaint_due,
            complaint_filed_date=complaint_filed_date, trial_date=trial_date,
            case_numbers=case_numbers
        )
        if not updated:
            return not_found_error("Case or no updates provided")
        return {"success": True, "case": updated}

    @mcp.tool()
    def delete_case(case_id: int) -> dict:
        """
        Delete a case and all related data (persons, deadlines, tasks, notes, etc. are CASCADE deleted).

        Args:
            case_id: ID of the case to delete

        Returns confirmation.
        """
        if db.delete_case(case_id):
            return {"success": True, "message": "Case and all related data deleted"}
        return not_found_error("Case")

    # ===== SEARCH TOOLS =====

    @mcp.tool()
    def search_cases(
        query: Optional[str] = None,
        case_number: Optional[str] = None,
        person_name: Optional[str] = None,
        status: Optional[str] = None,
        court_id: Optional[int] = None
    ) -> dict:
        """
        Search for cases with multiple filter options.

        All provided filters are combined with AND logic (case must match all filters).

        Args:
            query: Free text search on case name and summary (e.g., "Martinez", "City of LA")
            case_number: Search by case number (e.g., "24STCV", "12345")
            person_name: Filter by any person's name (client, defendant, expert, etc.)
            status: Filter by exact status (e.g., "Discovery", "Pre-trial")
            court_id: Filter by jurisdiction/court ID

        At least one search parameter must be provided.

        Returns matching cases with context:
        [{id, case_name, short_name, status, case_summary, court, case_numbers}]

        Examples:
            - search_cases(query="Martinez") - find cases with "Martinez" in the name/summary
            - search_cases(person_name="LAPD") - find all cases involving LAPD
            - search_cases(status="Discovery") - find all cases in Discovery phase
            - search_cases(person_name="City", status="Pre-trial") - cases with "City" in Pre-trial
        """
        if not any([query, case_number, person_name, status, court_id]):
            return validation_error("Provide at least one search parameter")

        cases = db.search_cases(query, case_number, person_name, status, court_id)
        return {"cases": cases, "total": len(cases)}

    @mcp.tool()
    def search_tasks(
        query: Optional[str] = None,
        case_id: Optional[int] = None,
        status: Optional[str] = None,
        urgency: Optional[int] = None
    ) -> dict:
        """
        Search for tasks by description, case, status, or urgency.

        Args:
            query: Search in task descriptions (partial match)
            case_id: Filter to specific case
            status: Filter by status (Pending, Active, Done, etc.)
            urgency: Filter by urgency level (1-5)

        At least one parameter must be provided.

        Examples:
            - search_tasks(query="deposition") - find tasks mentioning "deposition"
            - search_tasks(status="Blocked") - find all blocked tasks
            - search_tasks(urgency=5) - find critical tasks
        """
        if not any([query, case_id, status, urgency]):
            return validation_error("Provide at least one search parameter")

        tasks = db.search_tasks(query, case_id, status, urgency)
        return {"tasks": tasks, "total": len(tasks)}

    @mcp.tool()
    def search_deadlines(
        query: Optional[str] = None,
        case_id: Optional[int] = None,
        status: Optional[str] = None,
        urgency: Optional[int] = None
    ) -> dict:
        """
        Search for deadlines by description, case, status, or urgency.

        Args:
            query: Search in deadline descriptions (partial match)
            case_id: Filter to specific case
            status: Filter by status (Pending, Met, Missed, etc.)
            urgency: Filter by urgency level (1-5)

        At least one parameter must be provided.

        Examples:
            - search_deadlines(query="discovery") - find deadlines mentioning "discovery"
            - search_deadlines(urgency=5) - find critical deadlines
        """
        if not any([query, case_id, status, urgency]):
            return validation_error("Provide at least one search parameter")

        deadlines = db.search_deadlines(query, case_id, status, urgency)
        return {"deadlines": deadlines, "total": len(deadlines)}

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

        # Default to today if no date provided
        if not date:
            from datetime import date as dt_date
            date = dt_date.today().isoformat()

        result = db.add_activity(case_id, description, activity_type, date, minutes)
        return {"success": True, "activity": result}

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
            activity_id: ID of the activity to update
            date: New date (YYYY-MM-DD)
            description: New description
            activity_type: New type (e.g., "Meeting", "Filing", "Research")
            minutes: New time spent in minutes

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

    # ===== DEADLINE TOOLS =====

    @mcp.tool()
    def add_deadline(
        case_id: int,
        date: str,
        description: str,
        urgency: int = 3,
        status: str = "Pending",
        time: Optional[str] = None,
        location: Optional[str] = None,
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
            time: Time of deadline (HH:MM format, 24-hour)
            location: Location (e.g., courtroom, address)
            document_link: URL to related document
            calculation_note: How the deadline was calculated (e.g., "Filing date + 60 days")

        Returns the created deadline with ID.
        """
        try:
            db.validate_date_format(date, "date")
            db.validate_time_format(time, "time")
            db.validate_urgency(urgency)
        except ValidationError as e:
            return validation_error(str(e))

        result = db.add_deadline(case_id, date, description, status, urgency,
                                  document_link, calculation_note, time, location)
        return {"success": True, "deadline": result}

    @mcp.tool()
    def get_deadlines(
        case_id: Optional[int] = None,
        urgency_filter: Optional[int] = None,
        status_filter: Optional[str] = None
    ) -> dict:
        """
        Get upcoming deadlines, optionally filtered by case, urgency, or status.

        Args:
            case_id: Filter by specific case
            urgency_filter: Filter by urgency level (1-5)
            status_filter: Filter by status (e.g., "Pending")

        Returns list of deadlines with case information.

        Examples:
            - get_deadlines(status_filter="Pending", urgency_filter=5) - critical pending deadlines
            - get_deadlines(case_id=5) - all deadlines for case 5
        """
        result = db.get_upcoming_deadlines(urgency_filter, status_filter)

        # Filter by case_id if provided (since db function doesn't support it directly)
        if case_id:
            result["deadlines"] = [d for d in result["deadlines"] if d["case_id"] == case_id]
            result["total"] = len(result["deadlines"])

        return {"deadlines": result["deadlines"], "total": result["total"]}

    @mcp.tool()
    def update_deadline(
        deadline_id: int,
        date: Optional[str] = None,
        description: Optional[str] = None,
        status: Optional[str] = None,
        urgency: Optional[int] = None,
        time: Optional[str] = None,
        location: Optional[str] = None,
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
            time: New time (HH:MM format)
            location: New location
            document_link: New document link
            calculation_note: New calculation note

        Returns updated deadline.
        """
        try:
            if date:
                db.validate_date_format(date, "date")
            if time:
                db.validate_time_format(time, "time")
            if urgency is not None:
                db.validate_urgency(urgency)
        except ValidationError as e:
            return validation_error(str(e))

        result = db.update_deadline_full(deadline_id, date, description, status,
                                          urgency, document_link, calculation_note,
                                          time, location)
        if not result:
            return not_found_error("Deadline or no updates provided")
        return {"success": True, "deadline": result}

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
    def get_calendar(
        days: int = 30,
        include_tasks: bool = True,
        include_deadlines: bool = True
    ) -> dict:
        """
        Get a combined calendar view of tasks and deadlines.

        This tool provides a unified view of everything due in the specified time period,
        sorted by date. Great for answering questions like "What's on my calendar this week?"

        Args:
            days: Number of days to look ahead (default 30)
            include_tasks: Include tasks in results (default True)
            include_deadlines: Include deadlines in results (default True)

        Returns combined list sorted by date.
        Each item includes: id, date, time, location, description, status, urgency,
        case_id, case_name, short_name, item_type

        Examples:
            - get_calendar(days=7) - everything due this week
            - get_calendar(days=1) - what's due today
            - get_calendar(include_tasks=False) - deadlines only
        """
        items = db.get_calendar(days, include_tasks, include_deadlines)
        return {"items": items, "total": len(items), "days": days}

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
            status: Status (Pending, Active, Done, Partially Done, Blocked, Awaiting Atty Review)
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
            urgency_filter: Filter by urgency level (1-5)

        Returns list of tasks with case and deadline information.

        Examples:
            - get_tasks(status_filter="Pending", urgency_filter=4) - urgent pending tasks
            - get_tasks(case_id=5) - all tasks for case 5
        """
        result = db.get_tasks(case_id, status_filter, urgency_filter)
        return {"tasks": result["tasks"], "total": result["total"]}

    @mcp.tool()
    def update_task(
        task_id: int,
        description: Optional[str] = None,
        status: Optional[str] = None,
        urgency: Optional[int] = None,
        due_date: Optional[str] = None,
        completion_date: Optional[str] = None
    ) -> dict:
        """
        Update a task's description, status, urgency, due date, or completion date.

        Args:
            task_id: ID of the task
            description: New description
            status: New status (Pending, Active, Done, Partially Done, Blocked, Awaiting Atty Review)
            urgency: New urgency (1-5)
            due_date: New due date (YYYY-MM-DD)
            completion_date: Date task was completed (YYYY-MM-DD)

        Returns updated task.
        """
        try:
            if status:
                db.validate_task_status(status)
            if urgency is not None:
                db.validate_urgency(urgency)
            if due_date:
                db.validate_date_format(due_date, "due_date")
            if completion_date:
                db.validate_date_format(completion_date, "completion_date")
        except ValidationError as e:
            return validation_error(str(e))

        result = db.update_task_full(task_id, description, due_date, completion_date, status, urgency)
        if not result:
            return not_found_error("Task or no updates provided")
        return {"success": True, "task": result}

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
    def bulk_update_tasks(
        task_ids: list,
        status: str
    ) -> dict:
        """
        Update multiple tasks to the same status at once.

        Useful for marking several tasks as Done, or changing status of multiple tasks.

        Args:
            task_ids: List of task IDs to update
            status: New status for all tasks (Pending, Active, Done, Partially Done, Blocked, Awaiting Atty Review)

        Returns count of updated tasks.

        Example:
            bulk_update_tasks(task_ids=[1, 2, 3], status="Done")
        """
        try:
            db.validate_task_status(status)
        except ValidationError as e:
            return validation_error(str(e))

        result = db.bulk_update_tasks(task_ids, status)
        return {"success": True, "updated": result["updated"]}

    @mcp.tool()
    def bulk_update_deadlines(
        deadline_ids: list,
        status: str
    ) -> dict:
        """
        Update multiple deadlines to the same status at once.

        Useful for marking several deadlines as met/complete.

        Args:
            deadline_ids: List of deadline IDs to update
            status: New status for all deadlines (e.g., "Pending", "Met", "Missed")

        Returns count of updated deadlines.

        Example:
            bulk_update_deadlines(deadline_ids=[1, 2], status="Met")
        """
        result = db.bulk_update_deadlines(deadline_ids, status)
        return {"success": True, "updated": result["updated"]}

    @mcp.tool()
    def bulk_update_case_tasks(
        case_id: int,
        new_status: str,
        current_status: Optional[str] = None
    ) -> dict:
        """
        Update all tasks for a case to a new status.

        Useful for "mark all pending tasks on this case as done" type operations.

        Args:
            case_id: ID of the case
            new_status: New status for tasks
            current_status: Only update tasks with this current status (optional filter)

        Returns count of updated tasks.

        Examples:
            - bulk_update_case_tasks(case_id=5, new_status="Done") - mark ALL tasks done
            - bulk_update_case_tasks(case_id=5, new_status="Done", current_status="Pending") - only pending→done
        """
        try:
            db.validate_task_status(new_status)
            if current_status:
                db.validate_task_status(current_status)
        except ValidationError as e:
            return validation_error(str(e))

        result = db.bulk_update_tasks_for_case(case_id, new_status, current_status)
        return {"success": True, "updated": result["updated"]}

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
            note_id: ID of the note to update
            content: New content for the note

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

    # ===== UNIFIED PERSON TOOLS =====

    @mcp.tool()
    def manage_person(
        name: str,
        person_type: str,
        person_id: Optional[int] = None,
        phones: Optional[list] = None,
        emails: Optional[list] = None,
        address: Optional[str] = None,
        organization: Optional[str] = None,
        attributes: Optional[dict] = None,
        notes: Optional[str] = None,
        archived: Optional[bool] = None
    ) -> dict:
        """
        Create or update a person (unified person management).

        Person types are flexible - common types include: client, attorney, judge,
        expert, mediator, defendant, witness, lien_holder, interpreter, etc.

        Type-specific attributes (stored in attributes JSONB field):
        - judge: {status, jurisdiction, chambers, courtroom_number, appointed_by, initials, tenure}
        - expert: {hourly_rate, deposition_rate, trial_rate, expertises: ["Biomechanics", "..."]}
        - attorney: {bar_number}
        - mediator: {half_day_rate, full_day_rate, style}
        - client: {date_of_birth, preferred_language, emergency_contact}

        Args:
            name: Full name (required)
            person_type: Type of person (required, any string)
            person_id: ID if updating existing person (omit to create new)
            phones: List of phone objects [{value: "555-1234", label: "Cell", primary: true}]
            emails: List of email objects [{value: "email@example.com", label: "Work", primary: true}]
            address: Physical address
            organization: Firm, court, or company name
            attributes: Type-specific attributes as JSON object
            notes: General notes
            archived: Whether to archive/unarchive the person

        Returns the created/updated person.

        Examples:
            Create expert: manage_person(name="Dr. Smith", person_type="expert",
                          organization="Smith Biomechanics",
                          phones=[{"value": "555-1234", "label": "Office"}],
                          attributes={"hourly_rate": 500, "expertises": ["Biomechanics"]})
            Create judge: manage_person(name="Hon. Jane Doe", person_type="judge",
                         organization="C.D. Cal.", attributes={"courtroom_number": "5A"})
            Create witness: manage_person(name="John Doe", person_type="witness")
            Update: manage_person(name="Dr. Smith", person_type="expert", person_id=5,
                   attributes={"hourly_rate": 550})
        """
        try:
            db.validate_person_type(person_type)
        except ValidationError as e:
            return validation_error(str(e))

        if person_id:
            # Update existing person
            result = db.update_person(
                person_id,
                name=name,
                person_type=person_type,
                phones=phones,
                emails=emails,
                address=address,
                organization=organization,
                attributes=attributes,
                notes=notes,
                archived=archived
            )
            if not result:
                return not_found_error("Person")

            return {"success": True, "person": result, "action": "updated"}
        else:
            # Create new person
            result = db.create_person(
                person_type=person_type,
                name=name,
                phones=phones,
                emails=emails,
                address=address,
                organization=organization,
                attributes=attributes,
                notes=notes
            )

            return {"success": True, "person": result, "action": "created"}

    @mcp.tool()
    def search_persons(
        name: Optional[str] = None,
        person_type: Optional[str] = None,
        organization: Optional[str] = None,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        case_id: Optional[int] = None,
        include_archived: bool = False,
        limit: int = 50
    ) -> dict:
        """
        Universal search for persons by name, type, attributes, or case.

        Args:
            name: Name to search (partial match)
            person_type: Filter by type (any type string, e.g., client, attorney, judge, expert, witness)
            organization: Organization to search (partial match)
            email: Email to search (partial match in emails array)
            phone: Phone to search (partial match in phones array)
            case_id: Filter by case assignment
            include_archived: Include archived persons (default False)
            limit: Max results (default 50)

        Returns list of matching persons with basic info.

        Examples:
            search_persons(person_type="expert")
            search_persons(name="Smith", person_type="attorney")
            search_persons(case_id=5)
        """
        result = db.search_persons(
            name=name,
            person_type=person_type,
            organization=organization,
            email=email,
            phone=phone,
            case_id=case_id,
            archived=include_archived,
            limit=limit
        )
        return {
            "success": True,
            "persons": result["persons"],
            "total": result["total"],
            "filters": {
                "name": name,
                "person_type": person_type,
                "organization": organization,
                "case_id": case_id
            }
        }

    @mcp.tool()
    def get_person(person_id: int) -> dict:
        """
        Get full details for a person including all case assignments.

        Args:
            person_id: ID of the person

        Returns complete person details with:
        - Basic info (name, type, phones, emails, address, organization)
        - Type-specific attributes (in JSONB)
        - All case assignments with roles
        """
        result = db.get_person_by_id(person_id)
        if not result:
            return not_found_error("Person")
        return {"success": True, "person": result}

    @mcp.tool()
    def assign_person_to_case(
        case_id: int,
        person_id: int,
        role: str,
        side: Optional[str] = None,
        case_attributes: Optional[dict] = None,
        case_notes: Optional[str] = None,
        is_primary: bool = False,
        contact_via_person_id: Optional[int] = None,
        assigned_date: Optional[str] = None
    ) -> dict:
        """
        Link a person to a case with a specific role and case-specific data.

        Common roles: Client, Defendant, Opposing Counsel, Co-Counsel, Judge,
        Magistrate Judge, Plaintiff Expert, Defendant Expert, Mediator, Witness

        Args:
            case_id: ID of the case
            person_id: ID of the person
            role: Role in the case (e.g., 'Client', 'Defendant', 'Opposing Counsel', 'Judge')
            side: 'plaintiff', 'defendant', or 'neutral'
            case_attributes: Case-specific overrides/data as JSON
                - Expert: {case_rate, testimony_topics, report_due, deposition_date}
                - Judge: {panel_position, oral_argument_date}
                - Attorney: {billing_rate, responsible_for}
            case_notes: Case-specific notes
            is_primary: Whether this is the primary person for this role
            contact_via_person_id: ID of person to contact through (if not direct contact)
            assigned_date: Date assigned (YYYY-MM-DD)

        Returns the created assignment.

        Examples:
            assign_person_to_case(case_id=1, person_id=5, role="Plaintiff Expert",
                                 side="plaintiff", case_attributes={"case_rate": 600})
            assign_person_to_case(case_id=1, person_id=10, role="Judge", side="neutral")
            assign_person_to_case(case_id=1, person_id=2, role="Client",
                                 contact_via_person_id=3)  # Contact through person 3
        """
        try:
            if side:
                db.validate_person_side(side)
            if assigned_date:
                db.validate_date_format(assigned_date, "assigned_date")
        except ValidationError as e:
            return validation_error(str(e))

        result = db.assign_person_to_case(
            case_id=case_id,
            person_id=person_id,
            role=role,
            side=side,
            case_attributes=case_attributes,
            case_notes=case_notes,
            is_primary=is_primary,
            contact_via_person_id=contact_via_person_id,
            assigned_date=assigned_date
        )
        return {"success": True, "assignment": result}

    @mcp.tool()
    def update_case_assignment(
        case_id: int,
        person_id: int,
        role: str,
        side: Optional[str] = None,
        case_attributes: Optional[dict] = None,
        case_notes: Optional[str] = None,
        is_primary: Optional[bool] = None,
        contact_via_person_id: Optional[int] = None,
        assigned_date: Optional[str] = None
    ) -> dict:
        """
        Update case-specific attributes for a person's assignment.

        Args:
            case_id: ID of the case
            person_id: ID of the person
            role: Role to update (required to identify the assignment)
            side: Update side ('plaintiff', 'defendant', 'neutral')
            case_attributes: Update case-specific attributes
            case_notes: Update case-specific notes
            is_primary: Update primary status
            contact_via_person_id: Update contact via person (set to None for direct contact)
            assigned_date: Update assigned date

        Returns the updated assignment.
        """
        try:
            if side:
                db.validate_person_side(side)
            if assigned_date:
                db.validate_date_format(assigned_date, "assigned_date")
        except ValidationError as e:
            return validation_error(str(e))

        result = db.update_case_assignment(
            case_id=case_id,
            person_id=person_id,
            role=role,
            side=side,
            case_attributes=case_attributes,
            case_notes=case_notes,
            is_primary=is_primary,
            contact_via_person_id=contact_via_person_id,
            assigned_date=assigned_date
        )
        if not result:
            return not_found_error("Case assignment")
        return {"success": True, "assignment": result}

    @mcp.tool()
    def remove_person_from_case(
        case_id: int,
        person_id: int,
        role: Optional[str] = None
    ) -> dict:
        """
        Unlink a person from a case.

        Args:
            case_id: ID of the case
            person_id: ID of the person
            role: Specific role to remove (if None, removes all roles)

        Returns confirmation.
        """
        result = db.remove_person_from_case(case_id, person_id, role)
        if not result:
            return not_found_error("Case assignment")
        return {
            "success": True,
            "message": f"Person {person_id} removed from case {case_id}" +
                      (f" (role: {role})" if role else " (all roles)")
        }

    @mcp.tool()
    def manage_expertise_type(
        name: str = "",
        description: Optional[str] = None,
        list_all: bool = False
    ) -> dict:
        """
        Add a new expertise type or list all existing types.

        Expertise types are used to categorize expert witnesses (e.g., Biomechanics,
        Accident Reconstruction, Medical - Orthopedic).

        Args:
            name: Name of the expertise type (required unless list_all=True)
            description: Description of the expertise type
            list_all: Set to True to just list all expertise types

        Returns the created type or list of all types.

        Examples:
            manage_expertise_type(list_all=True)
            manage_expertise_type(name="Digital Forensics", description="Computer and phone forensics")
        """
        if list_all:
            types = db.get_expertise_types()
            return {"success": True, "expertise_types": types, "total": len(types)}

        if not name:
            return validation_error("Name is required when not listing")

        result = db.create_expertise_type(name, description)
        return {"success": True, "expertise_type": result, "action": "created"}

    @mcp.tool()
    def manage_person_type(
        name: str = "",
        description: Optional[str] = None,
        list_all: bool = False
    ) -> dict:
        """
        Add a new person type or list all existing types.

        Person types categorize people in the system (e.g., client, attorney, judge,
        expert, witness, lien_holder, interpreter).

        Args:
            name: Name of the person type (required unless list_all=True)
            description: Description of the person type
            list_all: Set to True to just list all person types

        Returns the created type or list of all types.

        Examples:
            manage_person_type(list_all=True)
            manage_person_type(name="paralegal", description="Paralegal or legal assistant")
        """
        if list_all:
            types = db.get_person_types()
            return {"success": True, "person_types": types, "total": len(types)}

        if not name:
            return validation_error("Name is required when not listing")

        result = db.create_person_type(name, description)
        return {"success": True, "person_type": result, "action": "created"}
