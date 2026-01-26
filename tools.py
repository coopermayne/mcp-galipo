"""
MCP Tools for Legal Case Management

All MCP tools in one file to encourage keeping the tool count small.
"""

from datetime import datetime
from zoneinfo import ZoneInfo
from typing import Optional, Literal
from mcp.server.fastmcp import Context
import database as db
from database import ValidationError


# =============================================================================
# Type Definitions
# =============================================================================

CaseStatus = Literal[
    "Signing Up", "Prospective", "Pre-Filing", "Pleadings", "Discovery",
    "Expert Discovery", "Pre-trial", "Trial", "Post-Trial", "Appeal",
    "Settl. Pend.", "Stayed", "Closed"
]

TaskStatus = Literal[
    "Pending", "Active", "Done", "Partially Done", "Blocked", "Awaiting Atty Review"
]

ActivityType = Literal[
    "Meeting", "Filing", "Research", "Drafting", "Document Review",
    "Phone Call", "Email", "Court Appearance", "Deposition", "Other"
]

PersonSide = Literal["plaintiff", "defendant", "neutral"]
Urgency = Literal[1, 2, 3, 4]
SearchEntity = Literal["cases", "tasks", "events", "persons"]


# =============================================================================
# Reference Data
# =============================================================================

CASE_STATUS_LIST = [
    "Signing Up", "Prospective", "Pre-Filing", "Pleadings", "Discovery",
    "Expert Discovery", "Pre-trial", "Trial", "Post-Trial", "Appeal",
    "Settl. Pend.", "Stayed", "Closed"
]

TASK_STATUS_LIST = [
    "Pending", "Active", "Done", "Partially Done", "Blocked", "Awaiting Atty Review"
]

ACTIVITY_TYPE_LIST = [
    "Meeting", "Filing", "Research", "Drafting", "Document Review",
    "Phone Call", "Email", "Court Appearance", "Deposition", "Other"
]

PERSON_SIDE_LIST = ["plaintiff", "defendant", "neutral"]

COMMON_PERSON_TYPES = [
    "client", "attorney", "judge", "expert", "mediator", "defendant",
    "witness", "lien_holder", "interpreter"
]

COMMON_ROLES = [
    "Client", "Defendant", "Opposing Counsel", "Co-Counsel", "Judge",
    "Magistrate Judge", "Plaintiff Expert", "Defendant Expert", "Mediator",
    "Witness", "Lien Holder"
]


# =============================================================================
# Error Helpers
# =============================================================================

def error_response(message: str, code: str, valid_values=None, hint=None, suggestion=None, example=None) -> dict:
    error = {"message": message, "code": code}
    if valid_values:
        error["valid_values"] = valid_values
    if hint:
        error["hint"] = hint
    if suggestion:
        error["suggestion"] = suggestion
    if example:
        error["example"] = example
    return {"success": False, "error": error}


def validation_error(message: str, valid_values=None, hint=None, suggestion=None, example=None) -> dict:
    return error_response(message, "VALIDATION_ERROR", valid_values, hint, suggestion, example)


def not_found_error(resource: str, hint=None, suggestion=None) -> dict:
    default_suggestions = {
        "Case": "Use search(entity='cases') or list_cases() to find valid case IDs",
        "Task": "Use get_tasks(case_id=N) to see tasks for a case",
        "Event": "Use get_events(case_id=N) to see events for a case",
        "Person": "Use search(entity='persons', query='...') to find the person_id",
        "Note": "Use get_notes(case_id=N) to see notes for a case",
        "Activity": "Use get_activities(case_id=N) to see activities for a case",
        "Jurisdiction": "Use list_jurisdictions() to see available jurisdictions",
        "Proceeding": "Use get_proceedings(case_id=N) to see proceedings for a case",
    }
    return error_response(
        f"{resource} not found", "NOT_FOUND",
        hint=hint, suggestion=suggestion or default_suggestions.get(resource)
    )


def invalid_status_error(status: str, status_type: str) -> dict:
    valid = CASE_STATUS_LIST if status_type == "case" else TASK_STATUS_LIST
    return validation_error(f"Invalid {status_type} status: '{status}'", valid_values=valid)


def invalid_urgency_error(urgency) -> dict:
    return validation_error(
        f"Invalid urgency: '{urgency}'",
        valid_values=["1 (Low)", "2 (Medium)", "3 (High)", "4 (Urgent)"],
        hint="Urgency must be an integer 1-4"
    )


def invalid_date_format_error(value: str, field_name: str) -> dict:
    return validation_error(f"Invalid {field_name} format: '{value}'", hint="Use YYYY-MM-DD format")


def invalid_time_format_error(value: str, field_name: str) -> dict:
    return validation_error(f"Invalid {field_name} format: '{value}'", hint="Use HH:MM format (24-hour)")


def invalid_side_error(side: str) -> dict:
    return validation_error(f"Invalid side: '{side}'", valid_values=PERSON_SIDE_LIST)


def check_empty_required_field(value, field_name: str):
    if value == "":
        return validation_error(f"{field_name} cannot be empty")
    return None


def judge_role_on_case_error(role: str) -> dict:
    return validation_error(
        f"Cannot assign '{role}' directly to a case",
        hint="Judges are assigned to proceedings, not cases.",
        suggestion="Use add_proceeding() then add_proceeding_judge()"
    )


# =============================================================================
# Tool Registration
# =============================================================================

def register_tools(mcp):
    """Register all MCP tools."""

    # =========================================================================
    # TIME
    # =========================================================================

    @mcp.tool()
    def get_current_time(context: Context) -> dict:
        """Get current date/time in Pacific Time. Call at session start."""
        context.info("Getting current Pacific Time")
        pacific = ZoneInfo("America/Los_Angeles")
        now = datetime.now(pacific)
        return {
            "success": True,
            "date": now.strftime("%A, %B %d, %Y"),
            "time": now.strftime("%I:%M %p"),
            "year": now.year,
            "iso_date": now.strftime("%Y-%m-%d"),
            "timezone": "Pacific Time"
        }

    # =========================================================================
    # CASES
    # =========================================================================

    @mcp.tool()
    def list_cases(context: Context, status_filter: Optional[CaseStatus] = None) -> dict:
        """List all cases with optional status filter."""
        context.info(f"Listing cases{' with status=' + status_filter if status_filter else ''}")
        result = db.get_all_cases(status_filter)
        return {"cases": result["cases"], "total": result["total"]}

    @mcp.tool()
    def get_case(context: Context, case_id: Optional[int] = None, case_name: Optional[str] = None) -> dict:
        """Get full details for a case by ID or name."""
        if case_id:
            case = db.get_case_by_id(case_id)
        elif case_name:
            case = db.get_case_by_name(case_name)
        else:
            return validation_error("Must provide either case_id or case_name")
        if not case:
            return not_found_error("Case")
        return case

    @mcp.tool()
    def get_case_summary(context: Context, case_id: int) -> dict:
        """Get basic case info without full related data."""
        summary = db.get_case_summary(case_id)
        if not summary:
            return not_found_error("Case")
        return {"success": True, "case": summary}

    @mcp.tool()
    def create_case(
        context: Context,
        case_name: str,
        status: CaseStatus = "Signing Up",
        print_code: Optional[str] = None,
        case_summary: Optional[str] = None,
        result: Optional[str] = None,
        date_of_injury: Optional[str] = None,
        case_numbers: Optional[list] = None,
        short_name: Optional[str] = None
    ) -> dict:
        """Create a new case."""
        try:
            db.validate_case_status(status)
        except ValidationError:
            return invalid_status_error(status, "case")
        if date_of_injury:
            try:
                db.validate_date_format(date_of_injury, "date_of_injury")
            except ValidationError:
                return invalid_date_format_error(date_of_injury, "date_of_injury")
        case = db.create_case(case_name, status, print_code, case_summary, result, date_of_injury, case_numbers, short_name)
        return {"success": True, "case": case}

    @mcp.tool()
    def update_case(
        context: Context,
        case_id: int,
        case_name: Optional[str] = None,
        short_name: Optional[str] = None,
        status: Optional[CaseStatus] = None,
        print_code: Optional[str] = None,
        case_summary: Optional[str] = None,
        result: Optional[str] = None,
        date_of_injury: Optional[str] = None,
        case_numbers: Optional[list] = None
    ) -> dict:
        """Update case fields."""
        if status:
            try:
                db.validate_case_status(status)
            except ValidationError:
                return invalid_status_error(status, "case")
        if date_of_injury:
            try:
                db.validate_date_format(date_of_injury, "date_of_injury")
            except ValidationError:
                return invalid_date_format_error(date_of_injury, "date_of_injury")
        updated = db.update_case(case_id, case_name=case_name, short_name=short_name, status=status,
                                  print_code=print_code, case_summary=case_summary,
                                  result=result, date_of_injury=date_of_injury, case_numbers=case_numbers)
        if not updated:
            return not_found_error("Case")
        return {"success": True, "case": updated}

    @mcp.tool()
    def delete_case(context: Context, case_id: int) -> dict:
        """Delete a case and all related data."""
        if db.delete_case(case_id):
            return {"success": True, "message": "Case deleted"}
        return not_found_error("Case")

    # =========================================================================
    # TASKS
    # =========================================================================

    @mcp.tool()
    def add_task(
        context: Context,
        case_id: int,
        description: str,
        due_date: Optional[str] = None,
        urgency: Urgency = 2,
        status: TaskStatus = "Pending",
        event_id: Optional[int] = None
    ) -> dict:
        """Add a task to a case. Tasks are internal work (vs events which are calendar items)."""
        try:
            db.validate_task_status(status)
        except ValidationError:
            return invalid_status_error(status, "task")
        try:
            db.validate_urgency(urgency)
        except ValidationError:
            return invalid_urgency_error(urgency)
        if due_date:
            try:
                db.validate_date_format(due_date, "due_date")
            except ValidationError:
                return invalid_date_format_error(due_date, "due_date")
        result = db.add_task(case_id, description, due_date, status, urgency, event_id)
        if not result:
            return not_found_error("Case")
        return {"success": True, "task": result}

    @mcp.tool()
    def get_tasks(
        context: Context,
        case_id: Optional[int] = None,
        status_filter: Optional[TaskStatus] = None,
        urgency_filter: Optional[Urgency] = None
    ) -> dict:
        """Get tasks, optionally filtered by case, status, or urgency."""
        result = db.get_tasks(case_id, status_filter, urgency_filter)
        return {"tasks": result["tasks"], "total": result["total"]}

    @mcp.tool()
    def update_task(
        context: Context,
        task_id: int,
        description: Optional[str] = None,
        status: Optional[TaskStatus] = None,
        urgency: Optional[Urgency] = None,
        due_date: Optional[str] = None,
        completion_date: Optional[str] = None
    ) -> dict:
        """Update a task. Pass '' to clear optional date fields."""
        kwargs = {}
        if description is not None:
            if description == "":
                return validation_error("description cannot be empty")
            kwargs['description'] = description
        if status is not None:
            try:
                db.validate_task_status(status)
            except ValidationError:
                return invalid_status_error(status, "task")
            kwargs['status'] = status
        if urgency is not None:
            try:
                db.validate_urgency(urgency)
            except ValidationError:
                return invalid_urgency_error(urgency)
            kwargs['urgency'] = urgency
        if due_date is not None:
            if due_date == "":
                kwargs['due_date'] = None
            else:
                try:
                    db.validate_date_format(due_date, "due_date")
                except ValidationError:
                    return invalid_date_format_error(due_date, "due_date")
                kwargs['due_date'] = due_date
        if completion_date is not None:
            if completion_date == "":
                kwargs['completion_date'] = None
            else:
                try:
                    db.validate_date_format(completion_date, "completion_date")
                except ValidationError:
                    return invalid_date_format_error(completion_date, "completion_date")
                kwargs['completion_date'] = completion_date
        if not kwargs:
            return validation_error("No fields to update")
        result = db.update_task_full(task_id, **kwargs)
        if not result:
            return not_found_error("Task")
        return {"success": True, "task": result}

    @mcp.tool()
    def delete_task(context: Context, task_id: int) -> dict:
        """Delete a task."""
        if db.delete_task(task_id):
            return {"success": True, "message": "Task deleted"}
        return not_found_error("Task")

    @mcp.tool()
    def bulk_update_tasks(context: Context, task_ids: list, status: TaskStatus) -> dict:
        """Update multiple tasks to the same status."""
        try:
            db.validate_task_status(status)
        except ValidationError:
            return invalid_status_error(status, "task")
        result = db.bulk_update_tasks(task_ids, status)
        return {"success": True, "updated": result["updated"]}

    # =========================================================================
    # EVENTS
    # =========================================================================

    @mcp.tool()
    def add_event(
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
        """Add an event (deadline, hearing, deposition) to a case."""
        try:
            db.validate_date_format(date, "date")
        except ValidationError:
            return invalid_date_format_error(date, "date")
        if time:
            try:
                db.validate_time_format(time, "time")
            except ValidationError:
                return invalid_time_format_error(time, "time")
        result = db.add_event(case_id, date, description, document_link, calculation_note, time, location, starred)
        if not result:
            return not_found_error("Case")
        return {"success": True, "event": result}

    @mcp.tool()
    def get_events(context: Context, case_id: Optional[int] = None) -> dict:
        """Get upcoming events, optionally filtered by case."""
        result = db.get_upcoming_events()
        if case_id:
            result["events"] = [e for e in result["events"] if e["case_id"] == case_id]
            result["total"] = len(result["events"])
        return {"events": result["events"], "total": result["total"]}

    @mcp.tool()
    def update_event(
        context: Context,
        event_id: int,
        date: Optional[str] = None,
        description: Optional[str] = None,
        time: Optional[str] = None,
        location: Optional[str] = None,
        document_link: Optional[str] = None,
        calculation_note: Optional[str] = None,
        starred: Optional[bool] = None
    ) -> dict:
        """Update an event. Pass '' to clear optional fields."""
        kwargs = {}
        if date is not None:
            if date == "":
                return validation_error("date cannot be empty")
            try:
                db.validate_date_format(date, "date")
            except ValidationError:
                return invalid_date_format_error(date, "date")
            kwargs['date'] = date
        if description is not None:
            if description == "":
                return validation_error("description cannot be empty")
            kwargs['description'] = description
        if time is not None:
            if time == "":
                kwargs['time'] = None
            else:
                try:
                    db.validate_time_format(time, "time")
                except ValidationError:
                    return invalid_time_format_error(time, "time")
                kwargs['time'] = time
        if location is not None:
            kwargs['location'] = location if location != "" else None
        if document_link is not None:
            kwargs['document_link'] = document_link if document_link != "" else None
        if calculation_note is not None:
            kwargs['calculation_note'] = calculation_note if calculation_note != "" else None
        if starred is not None:
            kwargs['starred'] = starred
        if not kwargs:
            return validation_error("No fields to update")
        result = db.update_event_full(event_id, **kwargs)
        if not result:
            return not_found_error("Event")
        return {"success": True, "event": result}

    @mcp.tool()
    def delete_event(context: Context, event_id: int) -> dict:
        """Delete an event."""
        if db.delete_event(event_id):
            return {"success": True, "message": "Event deleted"}
        return not_found_error("Event")

    @mcp.tool()
    def get_calendar(context: Context, days: int = 30, include_tasks: bool = True, include_events: bool = True) -> dict:
        """Get combined calendar view of tasks and events."""
        items = db.get_calendar(days, include_tasks, include_events)
        return {"items": items, "total": len(items), "days": days}

    # =========================================================================
    # PERSONS
    # =========================================================================

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
        """Create or update a person (client, attorney, judge, expert, etc.)."""
        try:
            db.validate_person_type(person_type)
        except ValidationError as e:
            return validation_error(str(e), hint=f"Common types: {', '.join(COMMON_PERSON_TYPES)}")

        if person_id:
            result = db.update_person(person_id, name=name, person_type=person_type, phones=phones,
                                       emails=emails, address=address, organization=organization,
                                       attributes=attributes, notes=notes, archived=archived)
            if not result:
                return not_found_error("Person")
            return {"success": True, "person": result, "action": "updated"}
        else:
            result = db.create_person(person_type=person_type, name=name, phones=phones, emails=emails,
                                       address=address, organization=organization, attributes=attributes, notes=notes)
            return {"success": True, "person": result, "action": "created"}

    @mcp.tool()
    def get_person(context: Context, person_id: int) -> dict:
        """Get full details for a person including case assignments."""
        result = db.get_person_by_id(person_id)
        if not result:
            return not_found_error("Person")
        return {"success": True, "person": result}

    @mcp.tool()
    def assign_person_to_case(
        context: Context,
        case_id: int,
        person_id: int,
        role: str,
        side: Optional[PersonSide] = None,
        case_attributes: Optional[dict] = None,
        case_notes: Optional[str] = None,
        is_primary: bool = False,
        contact_via_person_id: Optional[int] = None,
        assigned_date: Optional[str] = None
    ) -> dict:
        """Link a person to a case with a role. Note: judges go on proceedings, not cases."""
        if role in ["Judge", "Magistrate Judge"]:
            return judge_role_on_case_error(role)
        if side:
            try:
                db.validate_person_side(side)
            except ValidationError:
                return invalid_side_error(side)
        if assigned_date:
            try:
                db.validate_date_format(assigned_date, "assigned_date")
            except ValidationError:
                return invalid_date_format_error(assigned_date, "assigned_date")
        result = db.assign_person_to_case(case_id=case_id, person_id=person_id, role=role, side=side,
                                           case_attributes=case_attributes, case_notes=case_notes,
                                           is_primary=is_primary, contact_via_person_id=contact_via_person_id,
                                           assigned_date=assigned_date)
        if not result:
            return validation_error("Could not create assignment", hint="Verify both case_id and person_id exist")
        return {"success": True, "assignment": result}

    @mcp.tool()
    def remove_person_from_case(context: Context, case_id: int, person_id: int, role: Optional[str] = None) -> dict:
        """Remove a person from a case."""
        result = db.remove_person_from_case(case_id, person_id, role)
        if not result:
            return not_found_error("Case assignment")
        return {"success": True, "message": "Person removed from case"}

    # =========================================================================
    # NOTES
    # =========================================================================

    @mcp.tool()
    def get_notes(context: Context, case_id: Optional[int] = None) -> dict:
        """Get notes, optionally filtered by case."""
        result = db.get_notes(case_id)
        return {"success": True, "notes": result["notes"], "total": result["total"]}

    @mcp.tool()
    def add_note(context: Context, case_id: int, content: str) -> dict:
        """Add a note to a case."""
        if content == "":
            return validation_error("content cannot be empty")
        result = db.add_note(case_id, content)
        if not result:
            return not_found_error("Case")
        return {"success": True, "note": result}

    @mcp.tool()
    def update_note(context: Context, note_id: int, content: str) -> dict:
        """Update a note."""
        if content == "":
            return validation_error("content cannot be empty")
        result = db.update_note(note_id, content)
        if not result:
            return not_found_error("Note")
        return {"success": True, "note": result}

    @mcp.tool()
    def delete_note(context: Context, note_id: int) -> dict:
        """Delete a note."""
        if db.delete_note(note_id):
            return {"success": True, "message": "Note deleted"}
        return not_found_error("Note")

    # =========================================================================
    # ACTIVITIES
    # =========================================================================

    @mcp.tool()
    def get_activities(context: Context, case_id: Optional[int] = None) -> dict:
        """Get activities/time entries, optionally filtered by case."""
        result = db.get_activities(case_id)
        return {"success": True, "activities": result["activities"], "total": result["total"]}

    @mcp.tool()
    def log_activity(
        context: Context,
        case_id: int,
        description: str,
        activity_type: ActivityType,
        minutes: Optional[int] = None,
        date: Optional[str] = None
    ) -> dict:
        """Log a time/activity entry to a case."""
        if activity_type not in ACTIVITY_TYPE_LIST:
            return validation_error(f"Invalid activity_type: '{activity_type}'", valid_values=ACTIVITY_TYPE_LIST)
        if date:
            try:
                db.validate_date_format(date, "date")
            except ValidationError:
                return invalid_date_format_error(date, "date")
        if not date:
            from datetime import date as dt_date
            date = dt_date.today().isoformat()
        result = db.add_activity(case_id, description, activity_type, date, minutes)
        if not result:
            return not_found_error("Case")
        return {"success": True, "activity": result}

    @mcp.tool()
    def delete_activity(context: Context, activity_id: int) -> dict:
        """Delete an activity."""
        if db.delete_activity(activity_id):
            return {"success": True, "message": "Activity deleted"}
        return not_found_error("Activity")

    # =========================================================================
    # JURISDICTIONS
    # =========================================================================

    @mcp.tool()
    def list_jurisdictions(context: Context) -> dict:
        """List all jurisdictions (courts)."""
        jurisdictions = db.get_jurisdictions()
        return {"success": True, "jurisdictions": jurisdictions, "total": len(jurisdictions)}

    @mcp.tool()
    def manage_jurisdiction(
        context: Context,
        name: str,
        jurisdiction_id: Optional[int] = None,
        local_rules_link: Optional[str] = None,
        notes: Optional[str] = None
    ) -> dict:
        """Create or update a jurisdiction (court)."""
        if name == "":
            return validation_error("name cannot be empty")
        if jurisdiction_id:
            result = db.update_jurisdiction(jurisdiction_id, name, local_rules_link, notes)
            if not result:
                return not_found_error("Jurisdiction")
            return {"success": True, "jurisdiction": result, "action": "updated"}
        else:
            result = db.create_jurisdiction(name, local_rules_link, notes)
            return {"success": True, "jurisdiction": result, "action": "created"}

    @mcp.tool()
    def delete_jurisdiction(context: Context, jurisdiction_id: int) -> dict:
        """Delete a jurisdiction."""
        if db.delete_jurisdiction(jurisdiction_id):
            return {"success": True, "message": "Jurisdiction deleted"}
        return not_found_error("Jurisdiction")

    # =========================================================================
    # PROCEEDINGS
    # =========================================================================

    @mcp.tool()
    def add_proceeding(
        context: Context,
        case_id: int,
        case_number: str,
        jurisdiction_id: Optional[int] = None,
        is_primary: bool = False,
        notes: Optional[str] = None
    ) -> dict:
        """Add a court proceeding to a case. Cases can have multiple proceedings (state, federal, appeal)."""
        if case_number == "":
            return validation_error("case_number cannot be empty")
        result = db.add_proceeding(case_id=case_id, case_number=case_number.strip(),
                                    jurisdiction_id=jurisdiction_id, is_primary=is_primary, notes=notes)
        if not result:
            return not_found_error("Case")
        return {"success": True, "proceeding": result}

    @mcp.tool()
    def get_proceedings(context: Context, case_id: int) -> dict:
        """Get all proceedings for a case."""
        proceedings = db.get_proceedings(case_id)
        return {"proceedings": proceedings, "total": len(proceedings)}

    @mcp.tool()
    def update_proceeding(
        context: Context,
        proceeding_id: int,
        case_number: Optional[str] = None,
        jurisdiction_id: Optional[int] = None,
        is_primary: Optional[bool] = None,
        notes: Optional[str] = None
    ) -> dict:
        """Update a proceeding. Pass jurisdiction_id=0 to clear it."""
        kwargs = {}
        if case_number is not None:
            if case_number == "":
                return validation_error("case_number cannot be empty")
            kwargs['case_number'] = case_number
        if jurisdiction_id is not None:
            kwargs['jurisdiction_id'] = jurisdiction_id if jurisdiction_id != 0 else None
        if is_primary is not None:
            kwargs['is_primary'] = is_primary
        if notes is not None:
            kwargs['notes'] = notes if notes != "" else None
        if not kwargs:
            return validation_error("No fields to update")
        result = db.update_proceeding(proceeding_id, **kwargs)
        if not result:
            return not_found_error("Proceeding")
        return {"success": True, "proceeding": result}

    @mcp.tool()
    def delete_proceeding(context: Context, proceeding_id: int) -> dict:
        """Delete a proceeding."""
        if db.delete_proceeding(proceeding_id):
            return {"success": True, "message": "Proceeding deleted"}
        return not_found_error("Proceeding")

    @mcp.tool()
    def add_proceeding_judge(
        context: Context,
        proceeding_id: int,
        person_id: int,
        role: str = "Judge",
        sort_order: Optional[int] = None
    ) -> dict:
        """Add a judge to a proceeding."""
        valid_roles = ["Judge", "Presiding", "Panel", "Magistrate Judge"]
        if role not in valid_roles:
            return validation_error(f"Invalid judge role: '{role}'", valid_values=valid_roles)
        result = db.add_judge_to_proceeding(proceeding_id=proceeding_id, person_id=person_id,
                                             role=role, sort_order=sort_order)
        if not result:
            return validation_error("Could not add judge", hint="Verify proceeding_id and person_id exist")
        return {"success": True, "judge": result}

    @mcp.tool()
    def remove_proceeding_judge(context: Context, proceeding_id: int, person_id: int) -> dict:
        """Remove a judge from a proceeding."""
        if db.remove_judge_from_proceeding(proceeding_id, person_id):
            return {"success": True, "message": "Judge removed"}
        return not_found_error("Judge assignment")

    @mcp.tool()
    def get_judges(context: Context, proceeding_id: int) -> dict:
        """Get all judges for a proceeding."""
        judges = db.get_judges(proceeding_id)
        return {"judges": judges, "total": len(judges)}

    # =========================================================================
    # TYPES
    # =========================================================================

    @mcp.tool()
    def manage_expertise_type(
        context: Context,
        name: str = "",
        description: Optional[str] = None,
        expertise_type_id: Optional[int] = None,
        list_all: bool = False
    ) -> dict:
        """Create, update, or list expertise types."""
        if list_all:
            types = db.get_expertise_types()
            return {"success": True, "expertise_types": types, "total": len(types)}
        if expertise_type_id:
            result = db.update_expertise_type(expertise_type_id, name if name else None, description)
            if not result:
                return not_found_error("Expertise type")
            return {"success": True, "expertise_type": result, "action": "updated"}
        if not name:
            return validation_error("Name required when creating", hint="Use list_all=True to see existing types")
        result = db.create_expertise_type(name, description)
        return {"success": True, "expertise_type": result, "action": "created"}

    @mcp.tool()
    def manage_person_type(
        context: Context,
        name: str = "",
        description: Optional[str] = None,
        person_type_id: Optional[int] = None,
        list_all: bool = False
    ) -> dict:
        """Create, update, or list person types."""
        if list_all:
            types = db.get_person_types()
            return {"success": True, "person_types": types, "total": len(types)}
        if person_type_id:
            result = db.update_person_type(person_type_id, name if name else None, description)
            if not result:
                return not_found_error("Person type")
            return {"success": True, "person_type": result, "action": "updated"}
        if not name:
            return validation_error("Name required when creating", hint="Use list_all=True to see existing types")
        result = db.create_person_type(name, description)
        return {"success": True, "person_type": result, "action": "created"}

    # =========================================================================
    # SEARCH
    # =========================================================================

    @mcp.tool()
    def search(
        context: Context,
        entity: SearchEntity,
        query: Optional[str] = None,
        case_id: Optional[int] = None,
        status: Optional[str] = None,
        urgency: Optional[Urgency] = None,
        person_type: Optional[str] = None,
        organization: Optional[str] = None,
        include_archived: bool = False,
        limit: int = 50
    ) -> dict:
        """Universal search across cases, tasks, events, or persons."""
        if entity == "cases":
            if not any([query, status]):
                return validation_error("Provide query or status for case search")
            if status:
                try:
                    db.validate_case_status(status)
                except ValidationError:
                    return invalid_status_error(status, "case")
            cases = db.search_cases(query, None, None, status)
            return {"success": True, "entity": "cases", "results": cases, "total": len(cases)}

        elif entity == "tasks":
            if not any([query, case_id, status, urgency]):
                return validation_error("Provide at least one filter for task search")
            if status:
                try:
                    db.validate_task_status(status)
                except ValidationError:
                    return invalid_status_error(status, "task")
            if urgency:
                try:
                    db.validate_urgency(urgency)
                except ValidationError:
                    return invalid_urgency_error(urgency)
            tasks = db.search_tasks(query, case_id, status, urgency)
            return {"success": True, "entity": "tasks", "results": tasks, "total": len(tasks)}

        elif entity == "events":
            if not any([query, case_id]):
                return validation_error("Provide query or case_id for event search")
            events = db.search_events(query, case_id)
            return {"success": True, "entity": "events", "results": events, "total": len(events)}

        elif entity == "persons":
            result = db.search_persons(name=query, person_type=person_type, organization=organization,
                                        case_id=case_id, archived=include_archived, limit=limit)
            return {"success": True, "entity": "persons", "results": result["persons"], "total": result["total"]}

        return validation_error(f"Invalid entity: '{entity}'", valid_values=["cases", "tasks", "events", "persons"])
