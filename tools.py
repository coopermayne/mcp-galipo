"""
MCP Tools for Legal Case Management

All MCP tool definitions for querying and managing legal cases.
"""

from typing import Optional
from mcp.server.fastmcp import Context
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
    def list_jurisdictions(context: Context) -> dict:
        """
        List all jurisdictions (courts).

        Returns list of jurisdictions with id, name, local_rules_link, and notes.
        """
        context.info("Fetching all jurisdictions")
        jurisdictions = db.get_jurisdictions()
        context.info(f"Found {len(jurisdictions)} jurisdictions")
        return {"success": True, "jurisdictions": jurisdictions, "total": len(jurisdictions)}

    @mcp.tool()
    def manage_jurisdiction(
        context: Context,
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
            context.info(f"Updating jurisdiction {jurisdiction_id}: {name}")
            result = db.update_jurisdiction(jurisdiction_id, name, local_rules_link, notes)
            if not result:
                return not_found_error("Jurisdiction")
            context.info(f"Jurisdiction {jurisdiction_id} updated successfully")
            return {"success": True, "jurisdiction": result, "action": "updated"}
        else:
            context.info(f"Creating new jurisdiction: {name}")
            result = db.create_jurisdiction(name, local_rules_link, notes)
            context.info(f"Jurisdiction created with ID {result.get('id')}")
            return {"success": True, "jurisdiction": result, "action": "created"}

    @mcp.tool()
    def delete_jurisdiction(context: Context, jurisdiction_id: int) -> dict:
        """
        Delete a jurisdiction (court).

        Note: This will fail if any cases are still assigned to this jurisdiction.
        Reassign those cases to a different jurisdiction first.

        Args:
            jurisdiction_id: ID of the jurisdiction to delete

        Returns confirmation.
        """
        context.info(f"Deleting jurisdiction {jurisdiction_id}")
        if db.delete_jurisdiction(jurisdiction_id):
            context.info(f"Jurisdiction {jurisdiction_id} deleted")
            return {"success": True, "message": "Jurisdiction deleted"}
        return not_found_error("Jurisdiction")

    # ===== CASE TOOLS =====

    @mcp.tool()
    def list_cases(context: Context, status_filter: Optional[str] = None) -> dict:
        """
        List all cases with optional status filter.

        Args:
            status_filter: Optional status to filter by (e.g., "Discovery", "Pre-trial")
                          Valid statuses: Signing Up, Prospective, Pre-Filing, Pleadings,
                          Discovery, Expert Discovery, Pre-trial, Trial, Post-Trial,
                          Appeal, Settl. Pend., Stayed, Closed

        Returns list of cases with id, name, short_name, status, court.
        """
        context.info(f"Listing cases{' with status=' + status_filter if status_filter else ''}")
        result = db.get_all_cases(status_filter)
        context.info(f"Found {result['total']} cases")
        return {"cases": result["cases"], "total": result["total"], "filter": status_filter}

    @mcp.tool()
    def get_case(context: Context, case_id: Optional[int] = None, case_name: Optional[str] = None) -> dict:
        """
        Get full details for a specific case by ID or name.

        Args:
            case_id: The numeric ID of the case
            case_name: The name of the case (e.g., "Martinez v. City of Los Angeles")

        Returns complete case information including persons (clients, defendants, contacts),
        case numbers, activities, deadlines, tasks, and notes.
        """
        if case_id:
            context.info(f"Fetching case by ID: {case_id}")
            case = db.get_case_by_id(case_id)
        elif case_name:
            context.info(f"Fetching case by name: {case_name}")
            case = db.get_case_by_name(case_name)
        else:
            return validation_error("Provide either case_id or case_name")

        if not case:
            context.info("Case not found")
            available = db.get_all_case_names()
            result = not_found_error("Case")
            result["available_cases"] = available
            return result

        context.info(f"Retrieved case: {case.get('case_name', 'Unknown')}")
        return case

    @mcp.tool()
    def create_case(
        context: Context,
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
        context.info(f"Creating new case: {case_name}")
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
        context.info(f"Case created with ID {case.get('id')}")
        return {"success": True, "message": f"Case '{case_name}' created", "case": case}

    @mcp.tool()
    def update_case(
        context: Context,
        case_id: int,
        case_name: Optional[str] = None,
        short_name: Optional[str] = None,
        status: Optional[str] = None,
        court_id: Optional[int] = None,
        print_code: Optional[str] = None,
        case_summary: Optional[str] = None,
        result: Optional[str] = None,
        date_of_injury: Optional[str] = None,
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
            case_numbers: List of case numbers (replaces entire list).
                          Format: [{"number": "24STCV12345", "label": "State", "primary": true}]

        Returns updated case info.
        """
        context.info(f"Updating case {case_id}")
        try:
            if status:
                db.validate_case_status(status)
            if date_of_injury:
                db.validate_date_format(date_of_injury, "date_of_injury")
        except ValidationError as e:
            return validation_error(str(e))

        updated = db.update_case(
            case_id, case_name=case_name, short_name=short_name, status=status,
            court_id=court_id, print_code=print_code, case_summary=case_summary,
            result=result, date_of_injury=date_of_injury,
            case_numbers=case_numbers
        )
        if not updated:
            return not_found_error("Case or no updates provided")
        context.info(f"Case {case_id} updated successfully")
        return {"success": True, "case": updated}

    @mcp.tool()
    def delete_case(context: Context, case_id: int) -> dict:
        """
        Delete a case and all related data (persons, deadlines, tasks, notes, etc. are CASCADE deleted).

        Args:
            case_id: ID of the case to delete

        Returns confirmation.
        """
        context.info(f"Deleting case {case_id} and all related data")
        if db.delete_case(case_id):
            context.info(f"Case {case_id} deleted successfully")
            return {"success": True, "message": "Case and all related data deleted"}
        return not_found_error("Case")

    # ===== SEARCH TOOLS =====

    @mcp.tool()
    def search_cases(
        context: Context,
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

        filters = [f for f in [query, case_number, person_name, status, court_id] if f]
        context.info(f"Searching cases with {len(filters)} filter(s)")
        cases = db.search_cases(query, case_number, person_name, status, court_id)
        context.info(f"Found {len(cases)} matching cases")
        return {"cases": cases, "total": len(cases)}

    @mcp.tool()
    def search_tasks(
        context: Context,
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

        context.info(f"Searching tasks{' for query=' + query if query else ''}{' status=' + status if status else ''}")
        tasks = db.search_tasks(query, case_id, status, urgency)
        context.info(f"Found {len(tasks)} matching tasks")
        return {"tasks": tasks, "total": len(tasks)}

    @mcp.tool()
    def search_deadlines(
        context: Context,
        query: Optional[str] = None,
        case_id: Optional[int] = None
    ) -> dict:
        """
        Search for deadlines by description or case.

        Args:
            query: Search in deadline descriptions (partial match)
            case_id: Filter to specific case

        At least one parameter must be provided.

        Examples:
            - search_deadlines(query="discovery") - find deadlines mentioning "discovery"
            - search_deadlines(case_id=5) - find all deadlines for case 5
        """
        if not any([query, case_id]):
            return validation_error("Provide at least one search parameter")

        context.info(f"Searching deadlines{' for query=' + query if query else ''}")
        deadlines = db.search_deadlines(query, case_id)
        context.info(f"Found {len(deadlines)} matching deadlines")
        return {"deadlines": deadlines, "total": len(deadlines)}

    # ===== ACTIVITY TOOLS =====

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

    # ===== DEADLINE TOOLS =====

    @mcp.tool()
    def add_deadline(
        context: Context,
        case_id: int,
        date: str,
        description: str,
        time: Optional[str] = None,
        location: Optional[str] = None,
        document_link: Optional[str] = None,
        calculation_note: Optional[str] = None,
        starred: bool = False
    ) -> dict:
        """
        Add a deadline or event to a case - anything that HAS to happen on a specific date.

        This includes filing deadlines, depositions, hearings, trial dates, mediations,
        expert report due dates, discovery cutoffs, CMCs, MSJ hearings, etc.
        If it's on the calendar and must happen, it's a deadline.

        Key heuristic: Deadline = it's happening whether you're ready or not.

        Args:
            case_id: ID of the case
            date: Deadline date (YYYY-MM-DD)
            description: What is due/happening (e.g., "MSJ due", "Discovery cutoff", "Deposition of Dr. Smith")
            time: Time of deadline (HH:MM format, 24-hour)
            location: Location (e.g., courtroom, address)
            document_link: URL to related document
            calculation_note: How the deadline was calculated (e.g., "Filing date + 60 days")
            starred: Whether to star/highlight this deadline in case overview (default False)

        Returns the created deadline with ID.
        """
        context.info(f"Adding deadline for case {case_id}: {description}")
        try:
            db.validate_date_format(date, "date")
            db.validate_time_format(time, "time")
        except ValidationError as e:
            return validation_error(str(e))

        result = db.add_deadline(case_id, date, description,
                                  document_link, calculation_note, time, location, starred)
        context.info(f"Deadline created with ID {result.get('id')}")
        return {"success": True, "deadline": result}

    @mcp.tool()
    def get_deadlines(
        context: Context,
        case_id: Optional[int] = None
    ) -> dict:
        """
        Get upcoming deadlines, optionally filtered by case.

        Args:
            case_id: Filter by specific case

        Returns list of deadlines with case information.

        Examples:
            - get_deadlines() - all upcoming deadlines
            - get_deadlines(case_id=5) - all deadlines for case 5
        """
        context.info(f"Fetching deadlines{' for case ' + str(case_id) if case_id else ''}")
        result = db.get_upcoming_deadlines()

        # Filter by case_id if provided (since db function doesn't support it directly)
        if case_id:
            result["deadlines"] = [d for d in result["deadlines"] if d["case_id"] == case_id]
            result["total"] = len(result["deadlines"])

        context.info(f"Found {result['total']} deadlines")
        return {"deadlines": result["deadlines"], "total": result["total"]}

    @mcp.tool()
    def update_deadline(
        context: Context,
        deadline_id: int,
        date: Optional[str] = None,
        description: Optional[str] = None,
        time: Optional[str] = None,
        location: Optional[str] = None,
        document_link: Optional[str] = None,
        calculation_note: Optional[str] = None,
        starred: Optional[bool] = None
    ) -> dict:
        """
        Update a deadline.

        Args:
            deadline_id: ID of the deadline
            date: New date (YYYY-MM-DD)
            description: New description
            time: New time (HH:MM format)
            location: New location
            document_link: New document link
            calculation_note: New calculation note
            starred: Whether to star/highlight this deadline in case overview

        Returns updated deadline.
        """
        context.info(f"Updating deadline {deadline_id}")
        try:
            if date:
                db.validate_date_format(date, "date")
            if time:
                db.validate_time_format(time, "time")
        except ValidationError as e:
            return validation_error(str(e))

        result = db.update_deadline_full(deadline_id, date, description,
                                          document_link, calculation_note,
                                          time, location, starred)
        if not result:
            return not_found_error("Deadline or no updates provided")
        context.info(f"Deadline {deadline_id} updated successfully")
        return {"success": True, "deadline": result}

    @mcp.tool()
    def delete_deadline(context: Context, deadline_id: int) -> dict:
        """
        Delete a deadline.

        Args:
            deadline_id: ID of the deadline to delete

        Returns confirmation.
        """
        context.info(f"Deleting deadline {deadline_id}")
        if db.delete_deadline(deadline_id):
            context.info(f"Deadline {deadline_id} deleted successfully")
            return {"success": True, "message": "Deadline deleted"}
        return not_found_error("Deadline")

    @mcp.tool()
    def get_calendar(
        context: Context,
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
        Each item includes: id, date, time, location, description, status,
        case_id, case_name, short_name, item_type (tasks also include urgency)

        Examples:
            - get_calendar(days=7) - everything due this week
            - get_calendar(days=1) - what's due today
            - get_calendar(include_tasks=False) - deadlines only
        """
        context.info(f"Fetching calendar for next {days} days")
        items = db.get_calendar(days, include_tasks, include_deadlines)
        context.info(f"Found {len(items)} calendar items")
        return {"items": items, "total": len(items), "days": days}

    # ===== TASK TOOLS =====

    @mcp.tool()
    def add_task(
        context: Context,
        case_id: int,
        description: str,
        due_date: Optional[str] = None,
        urgency: int = 3,
        status: str = "Pending",
        deadline_id: Optional[int] = None
    ) -> dict:
        """
        Add an internal task/to-do to a case - work items with self-imposed deadlines to prepare for deadlines and events.

        Examples: draft complaint, prepare depo outline, review discovery, propound written discovery,
        schedule expert call. These are things YOU need to do, not things that are happening.

        Key heuristic: Task = work you need to do to get ready.

        Args:
            case_id: ID of the case
            description: What needs to be done
            due_date: Due date (YYYY-MM-DD)
            urgency: 1-5 scale (1=low, 5=critical), default 3
            status: Status (Pending, Active, Done, Partially Done, Blocked, Awaiting Atty Review)
            deadline_id: Optional ID of deadline this task is linked to (for tasks that support a specific deadline)

        Returns the created task with ID.
        """
        context.info(f"Adding task for case {case_id}: {description[:50]}...")
        try:
            db.validate_task_status(status)
            db.validate_urgency(urgency)
            if due_date:
                db.validate_date_format(due_date, "due_date")
        except ValidationError as e:
            return validation_error(str(e))

        result = db.add_task(case_id, description, due_date, status, urgency, deadline_id)
        context.info(f"Task created with ID {result.get('id')}")
        return {"success": True, "task": result}

    @mcp.tool()
    def get_tasks(
        context: Context,
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
        context.info(f"Fetching tasks{' for case ' + str(case_id) if case_id else ''}")
        result = db.get_tasks(case_id, status_filter, urgency_filter)
        context.info(f"Found {result['total']} tasks")
        return {"tasks": result["tasks"], "total": result["total"]}

    @mcp.tool()
    def update_task(
        context: Context,
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
        context.info(f"Updating task {task_id}")
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
        context.info(f"Task {task_id} updated successfully")
        return {"success": True, "task": result}

    @mcp.tool()
    def delete_task(context: Context, task_id: int) -> dict:
        """
        Delete a task.

        Args:
            task_id: ID of the task to delete

        Returns confirmation.
        """
        context.info(f"Deleting task {task_id}")
        if db.delete_task(task_id):
            context.info(f"Task {task_id} deleted successfully")
            return {"success": True, "message": "Task deleted"}
        return not_found_error("Task")

    @mcp.tool()
    def bulk_update_tasks(
        context: Context,
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
        context.info(f"Bulk updating {len(task_ids)} tasks to status '{status}'")
        try:
            db.validate_task_status(status)
        except ValidationError as e:
            return validation_error(str(e))

        result = db.bulk_update_tasks(task_ids, status)
        context.info(f"Updated {result['updated']} tasks")
        return {"success": True, "updated": result["updated"]}

    @mcp.tool()
    def bulk_update_case_tasks(
        context: Context,
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
        context.info(f"Bulk updating tasks for case {case_id} to status '{new_status}'")
        try:
            db.validate_task_status(new_status)
            if current_status:
                db.validate_task_status(current_status)
        except ValidationError as e:
            return validation_error(str(e))

        result = db.bulk_update_tasks_for_case(case_id, new_status, current_status)
        context.info(f"Updated {result['updated']} tasks for case {case_id}")
        return {"success": True, "updated": result["updated"]}

    # ===== NOTE TOOLS =====

    @mcp.tool()
    def get_notes(context: Context, case_id: Optional[int] = None) -> dict:
        """
        Get notes, optionally filtered by case.

        Args:
            case_id: Filter by specific case (optional)

        Returns list of notes with case information.

        Examples:
            get_notes() - all notes
            get_notes(case_id=5) - notes for case 5
        """
        context.info(f"Fetching notes{' for case ' + str(case_id) if case_id else ''}")
        result = db.get_notes(case_id)
        context.info(f"Found {result['total']} notes")
        return {"success": True, "notes": result["notes"], "total": result["total"]}

    @mcp.tool()
    def add_note(context: Context, case_id: int, content: str) -> dict:
        """
        Add a note to a case.

        Args:
            case_id: ID of the case
            content: Note content

        Returns the created note with timestamp.
        """
        context.info(f"Adding note to case {case_id}")
        result = db.add_note(case_id, content)
        context.info(f"Note created with ID {result.get('id')}")
        return {"success": True, "note": result}

    @mcp.tool()
    def update_note(context: Context, note_id: int, content: str) -> dict:
        """
        Update a note's content.

        Args:
            note_id: ID of the note to update
            content: New content for the note

        Returns updated note.
        """
        context.info(f"Updating note {note_id}")
        result = db.update_note(note_id, content)
        if not result:
            return not_found_error("Note")
        context.info(f"Note {note_id} updated successfully")
        return {"success": True, "note": result}

    @mcp.tool()
    def delete_note(context: Context, note_id: int) -> dict:
        """
        Delete a note.

        Args:
            note_id: ID of the note to delete

        Returns confirmation.
        """
        context.info(f"Deleting note {note_id}")
        if db.delete_note(note_id):
            context.info(f"Note {note_id} deleted successfully")
            return {"success": True, "message": "Note deleted"}
        return not_found_error("Note")

    # ===== UNIFIED PERSON TOOLS =====

    @mcp.tool()
    def manage_person(
        context: Context,
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
            context.info(f"Updating person {person_id}: {name}")
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

            context.info(f"Person {person_id} updated successfully")
            return {"success": True, "person": result, "action": "updated"}
        else:
            # Create new person
            context.info(f"Creating new {person_type}: {name}")
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

            context.info(f"Person created with ID {result.get('id')}")
            return {"success": True, "person": result, "action": "created"}

    @mcp.tool()
    def search_persons(
        context: Context,
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
        context.info(f"Searching persons{' type=' + person_type if person_type else ''}{' name=' + name if name else ''}")
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
        context.info(f"Found {result['total']} matching persons")
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
    def get_person(context: Context, person_id: int) -> dict:
        """
        Get full details for a person including all case assignments.

        Args:
            person_id: ID of the person

        Returns complete person details with:
        - Basic info (name, type, phones, emails, address, organization)
        - Type-specific attributes (in JSONB)
        - All case assignments with roles
        """
        context.info(f"Fetching person {person_id}")
        result = db.get_person_by_id(person_id)
        if not result:
            return not_found_error("Person")
        context.info(f"Retrieved person: {result.get('name', 'Unknown')}")
        return {"success": True, "person": result}

    @mcp.tool()
    def assign_person_to_case(
        context: Context,
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
        context.info(f"Assigning person {person_id} to case {case_id} as {role}")
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
        context.info(f"Person {person_id} assigned to case {case_id} successfully")
        return {"success": True, "assignment": result}

    @mcp.tool()
    def update_case_assignment(
        context: Context,
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
        context.info(f"Updating assignment for person {person_id} in case {case_id}")
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
        context.info(f"Assignment updated successfully")
        return {"success": True, "assignment": result}

    @mcp.tool()
    def remove_person_from_case(
        context: Context,
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
        context.info(f"Removing person {person_id} from case {case_id}{' role=' + role if role else ''}")
        result = db.remove_person_from_case(case_id, person_id, role)
        if not result:
            return not_found_error("Case assignment")
        context.info(f"Person {person_id} removed from case {case_id}")
        return {
            "success": True,
            "message": f"Person {person_id} removed from case {case_id}" +
                      (f" (role: {role})" if role else " (all roles)")
        }

    @mcp.tool()
    def manage_expertise_type(
        context: Context,
        name: str = "",
        description: Optional[str] = None,
        expertise_type_id: Optional[int] = None,
        list_all: bool = False
    ) -> dict:
        """
        Create, update, or list expertise types.

        Expertise types are used to categorize expert witnesses (e.g., Biomechanics,
        Accident Reconstruction, Medical - Orthopedic).

        Args:
            name: Name of the expertise type (required for create/update)
            description: Description of the expertise type
            expertise_type_id: ID if updating existing type (omit to create new)
            list_all: Set to True to just list all expertise types

        Returns the created/updated type or list of all types.

        Examples:
            manage_expertise_type(list_all=True)
            manage_expertise_type(name="Digital Forensics", description="Computer and phone forensics")
            manage_expertise_type(expertise_type_id=5, name="Digital Forensics - Updated")
        """
        if list_all:
            context.info("Fetching all expertise types")
            types = db.get_expertise_types()
            context.info(f"Found {len(types)} expertise types")
            return {"success": True, "expertise_types": types, "total": len(types)}

        if expertise_type_id:
            # Update existing
            context.info(f"Updating expertise type {expertise_type_id}")
            result = db.update_expertise_type(expertise_type_id, name if name else None, description)
            if not result:
                return not_found_error("Expertise type")
            context.info(f"Expertise type {expertise_type_id} updated")
            return {"success": True, "expertise_type": result, "action": "updated"}

        if not name:
            return validation_error("Name is required when creating")

        context.info(f"Creating expertise type: {name}")
        result = db.create_expertise_type(name, description)
        context.info(f"Expertise type created")
        return {"success": True, "expertise_type": result, "action": "created"}

    @mcp.tool()
    def delete_expertise_type(context: Context, expertise_type_id: int) -> dict:
        """
        Delete an expertise type.

        Args:
            expertise_type_id: ID of the expertise type to delete

        Returns confirmation.
        """
        context.info(f"Deleting expertise type {expertise_type_id}")
        if db.delete_expertise_type(expertise_type_id):
            context.info(f"Expertise type {expertise_type_id} deleted")
            return {"success": True, "message": "Expertise type deleted"}
        return not_found_error("Expertise type")

    @mcp.tool()
    def manage_person_type(
        context: Context,
        name: str = "",
        description: Optional[str] = None,
        person_type_id: Optional[int] = None,
        list_all: bool = False
    ) -> dict:
        """
        Create, update, or list person types.

        Person types categorize people in the system (e.g., client, attorney, judge,
        expert, witness, lien_holder, interpreter).

        Args:
            name: Name of the person type (required for create/update)
            description: Description of the person type
            person_type_id: ID if updating existing type (omit to create new)
            list_all: Set to True to just list all person types

        Returns the created/updated type or list of all types.

        Examples:
            manage_person_type(list_all=True)
            manage_person_type(name="paralegal", description="Paralegal or legal assistant")
            manage_person_type(person_type_id=3, name="attorney", description="Updated description")
        """
        if list_all:
            context.info("Fetching all person types")
            types = db.get_person_types()
            context.info(f"Found {len(types)} person types")
            return {"success": True, "person_types": types, "total": len(types)}

        if person_type_id:
            # Update existing
            context.info(f"Updating person type {person_type_id}")
            result = db.update_person_type(person_type_id, name if name else None, description)
            if not result:
                return not_found_error("Person type")
            context.info(f"Person type {person_type_id} updated")
            return {"success": True, "person_type": result, "action": "updated"}

        if not name:
            return validation_error("Name is required when creating")

        context.info(f"Creating person type: {name}")
        result = db.create_person_type(name, description)
        context.info(f"Person type created")
        return {"success": True, "person_type": result, "action": "created"}

    @mcp.tool()
    def delete_person_type(context: Context, person_type_id: int) -> dict:
        """
        Delete a person type.

        Args:
            person_type_id: ID of the person type to delete

        Returns confirmation.
        """
        context.info(f"Deleting person type {person_type_id}")
        if db.delete_person_type(person_type_id):
            context.info(f"Person type {person_type_id} deleted")
            return {"success": True, "message": "Person type deleted"}
        return not_found_error("Person type")
