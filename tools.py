"""
MCP Tools for Legal Case Management

All MCP tools in one file to encourage keeping the tool count small.
"""

import asyncio
from datetime import datetime
from zoneinfo import ZoneInfo
from typing import Optional, Literal
from fastmcp import Context
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


def _get_roles_summary() -> str:
    """Get current roles grouped by category from the database."""
    roles = db.get_roles()
    by_cat = {}
    for r in roles:
        by_cat.setdefault(r["category"], []).append(r["name"])
    return "; ".join(f"{cat}: {', '.join(names)}" for cat, names in sorted(by_cat.items()))


def _get_expertise_types_list() -> list[str]:
    """Get current expertise type names from the database."""
    return [t["name"] for t in db.get_expertise_types()]


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


def judge_role_error() -> dict:
    return validation_error(
        "Judges cannot be assigned via person_roles",
        hint="Judges are standalone entities assigned to proceedings.",
        suggestion="Use create_judge() then add_judge_to_proceeding()"
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
    # STAFF / ATTORNEYS
    # =========================================================================

    @mcp.tool()
    async def list_attorneys(context: Context) -> dict:
        """List all active attorneys and their default paralegals.

        Call this BEFORE import_case to find out which attorneys are available
        for assignment. Each attorney has an id, name, initials, bar_number,
        and their default paralegal (if set).

        When assigning attorneys to a case via import_case, pass their IDs in
        the "attorney_ids" field. Their default paralegals will be auto-assigned.
        """
        context.info("Listing attorneys")
        try:
            attorneys = await asyncio.to_thread(db.get_attorneys)
            return {"success": True, "attorneys": attorneys}
        except Exception as e:
            return error_response(f"Failed to list attorneys: {str(e)}", "QUERY_ERROR")

    # =========================================================================
    # BULK IMPORT
    # =========================================================================

    @mcp.tool()
    async def import_case(
        context: Context,
        data: dict
    ) -> dict:
        """Import a complete case with all related entities in a single transaction.

        This is the primary tool for bulk case import. Pass a structured JSON object
        containing the case and all related data. Everything is created atomically -
        if any part fails, nothing is created.

        VALID VALUES:

        case.status (default "Signing Up"):
            "Signing Up", "Prospective", "Pre-Filing", "Pleadings", "Discovery",
            "Expert Discovery", "Pre-trial", "Trial", "Post-Trial", "Appeal",
            "Settl. Pend.", "Stayed", "Closed"

        persons[].role (determines case assignment - looked up from roles table):
            Client category: "Client"
            Internal team: "Lead Attorney", "Co-Counsel", "Paralegal", "Case Manager"
            Opposing team: "Defendant", "Defense Counsel", "Defense Paralegal", "Defense Expert"
            Third party: "Plaintiff Expert", "Mediator", "Witness", "Lien Holder",
                         "Court Reporter", "Interpreter", "Process Server"
            Note: Judges are standalone entities - NOT assigned via persons[].role.
                  Pass judges in proceedings[].judges instead.

        persons[].attributes (JSONB - varies by role):

        persons[].phones (array of contact objects):
            [{"value": "555-123-4567", "label": "Mobile", "primary": true}]
            Shortcut: Use "phone": "555-1234" for a single primary phone.

        persons[].emails (array of contact objects):
            [{"value": "jane@firm.com", "label": "Work", "primary": true}]
            Shortcut: Use "email": "jane@firm.com" for a single primary email.

        persons[].attributes (JSONB - stored on person_roles, varies by role):
            Attorneys: {"bar_number": "123456"}
            Experts: {"specialties": ["Biomechanics"], "hourly_rate": 500}
            Mediators: {"style": "evaluative", "half_day_rate": 2500}
            Clients: {"date_of_birth": "1980-01-01", "preferred_language": "Spanish"}

        proceedings[].jurisdiction (matched by name, or created if new):
            Default courts: "C.D. Cal.", "E.D. Cal.", "N.D. Cal.", "S.D. Cal.",
            "9th Cir.", "Los Angeles Superior", "Orange County Superior",
            "San Diego Superior", "Riverside Superior", "San Bernardino Superior"
            Any other name will create a new jurisdiction.

        proceedings[].judges (multiple judges per proceeding):
            Each proceeding can have multiple judges (e.g. district judge + magistrate,
            or appellate panel). Specify as an array of objects with explicit roles:
            [
                {"name": "Hon. Jane Wilson", "role": "Judge"},
                {"name": "Mag. Robert Chen", "role": "Magistrate Judge"}
            ]
            For appellate panels:
            [
                {"name": "Hon. Smith", "role": "Presiding"},
                {"name": "Hon. Jones", "role": "Panel"},
                {"name": "Hon. Davis", "role": "Panel"}
            ]
            Valid roles: "Judge", "Magistrate Judge", "Presiding", "Panel"
            Shortcut: "judge_name": "Hon. Smith" for a single judge.

        events[] - encompasses ALL calendar items: hearings, deadlines,
            depositions, CMCs, mediations, trial dates, filing deadlines, etc.
            Use the description to indicate the type of event.

        activities[].type (default "Other"):
            "Meeting", "Filing", "Research", "Drafting", "Document Review",
            "Phone Call", "Email", "Court Appearance", "Deposition", "Other"

        attorney_ids (optional, top-level):
            Array of user IDs (from list_attorneys) to assign as case attorneys.
            Each attorney's default paralegal is auto-assigned to the case.
            Example: "attorney_ids": [1, 3]

        INPUT SCHEMA:
        {
            "attorney_ids": [1, 3],  // optional - call list_attorneys() first
            "case": {
                "case_name": "Smith v. Jones" (REQUIRED),
                "short_name": "Smith v. Jones",
                "status": "Discovery",
                "date_of_injury": "2024-01-15",
                "case_summary": "Motor vehicle accident...",
                "print_code": "SMJ-001",
                "color": "blue"  // auto-assigned if omitted
            },
            "persons": [
                {
                    "name": "John Smith" (REQUIRED),
                    "role": "Client",
                    "is_primary": true,
                    "phones": [{"value": "555-123-4567", "label": "Cell", "primary": true}],
                    "emails": [{"value": "john@example.com", "label": "Personal", "primary": true}],
                    "organization": "Self-employed",
                    "attributes": {"date_of_birth": "1980-01-01", "preferred_language": "English"},
                    "case_notes": "Prefers email contact"
                },
                {
                    "name": "Bob Attorney",
                    "role": "Defense Counsel",
                    "organization": "Smith & Associates LLP",
                    "phones": [{"value": "555-987-6543", "label": "Office", "primary": true}],
                    "emails": [{"value": "battorney@smithlaw.com", "label": "Work", "primary": true}],
                    "attributes": {"bar_number": "123456"}
                }
            ],
            "proceedings": [
                {
                    "case_number": "24STCV12345" (REQUIRED),
                    "jurisdiction": "Los Angeles Superior",
                    "judges": [
                        {"name": "Hon. Jane Wilson", "role": "Judge"},
                        {"name": "Mag. Robert Chen", "role": "Magistrate Judge"}
                    ],
                    "is_primary": true
                }
            ],
            "events": [
                {
                    "date": "2024-06-15" (REQUIRED, YYYY-MM-DD),
                    "description": "Case Management Conference" (REQUIRED),
                    "time": "09:00",
                    "location": "Dept 5, Stanley Mosk Courthouse"
                },
                {
                    "date": "2024-07-01",
                    "description": "Deadline: Respond to Form Interrogatories",
                    "calculation_note": "CCP 2030.260(a), 35 days from service"
                }
            ],
            "notes": [
                {"content": "Client prefers email. Spanish speaker."}
            ],
            "activities": [
                {
                    "description": "Initial client intake meeting",
                    "type": "Meeting",
                    "date": "2024-01-20",
                    "minutes": 60
                }
            ]
        }

        Returns all created IDs for verification.
        """
        context.info(f"Importing case: {data.get('case', {}).get('case_name', 'unknown')}")
        try:
            result = await asyncio.to_thread(db.import_case, data)
            return result
        except ValidationError as e:
            return validation_error(str(e))
        except Exception as e:
            return error_response(f"Import failed: {str(e)}", "IMPORT_ERROR")

    # =========================================================================
    # COMMENTED OUT TOOLS - uncomment as needed
    # See git history for full implementations of:
    # - list_cases, get_case, get_case_summary, create_case, update_case, delete_case
    # - get_case_team, assign_user_to_case, remove_user_from_case, get_user_cases
    # - add_task, get_tasks, update_task, delete_task, bulk_update_tasks, reorder_task
    # - add_event, get_events, update_event, delete_event, get_calendar, manage_event_attendees
    # - manage_person, get_person, assign_person_to_case, remove_person_from_case
    # - list_persons, archive_person, delete_person, get_case_persons, update_case_assignment
    # - get_notes, add_note, update_note, delete_note
    # - get_activities, log_activity, delete_activity, update_activity
    # - list_jurisdictions, manage_jurisdiction, delete_jurisdiction
    # - add_proceeding, get_proceedings, update_proceeding, delete_proceeding
    # - add_proceeding_judge, remove_proceeding_judge, get_judges
    # - manage_expertise_type, manage_person_type
    # - search
    # - list_users, get_user, create_user, update_user, reset_user_password, delete_user
    # - get_stats, get_constants, export_all_data
    # =========================================================================
