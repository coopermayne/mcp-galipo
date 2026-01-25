"""
Shared utility functions for MCP tools.

Provides rich error responses with hints, valid values, and suggestions
to help the AI self-correct when tools are misused.
"""

from typing import Literal, Optional, List, Dict, Any

# Fixed enum types for MCP tool parameters
# These use Literal so the AI sees valid values in the schema upfront

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

# =============================================================================
# Reference Data for Error Guidance
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

# Person type -> typical attributes mapping for guidance
PERSON_TYPE_ATTRIBUTES = {
    "judge": {
        "common": ["courtroom", "department", "initials"],
        "example": {"courtroom": "5A", "department": "Dept. 12", "initials": "ABC"}
    },
    "expert": {
        "common": ["hourly_rate", "deposition_rate", "trial_rate", "retainer_fee", "expertises"],
        "example": {"hourly_rate": 500, "expertises": ["Biomechanics", "Accident Reconstruction"]}
    },
    "attorney": {
        "common": ["bar_number"],
        "example": {"bar_number": "123456"}
    },
    "mediator": {
        "common": ["style", "half_day_rate", "full_day_rate"],
        "example": {"half_day_rate": 2500, "full_day_rate": 4500, "style": "facilitative"}
    },
    "interpreter": {
        "common": ["languages", "hourly_rate"],
        "example": {"languages": ["Spanish", "English"], "hourly_rate": 75}
    },
    "client": {
        "common": ["date_of_birth", "preferred_language", "emergency_contact"],
        "example": {"date_of_birth": "1985-03-15", "preferred_language": "Spanish"}
    }
}

# =============================================================================
# Enhanced Error Response Builders
# =============================================================================

def error_response(
    message: str,
    code: str,
    valid_values: Optional[List[str]] = None,
    hint: Optional[str] = None,
    suggestion: Optional[str] = None,
    example: Optional[Any] = None
) -> dict:
    """Create a standardized error response with optional guidance."""
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


def validation_error(
    message: str,
    valid_values: Optional[List[str]] = None,
    hint: Optional[str] = None,
    suggestion: Optional[str] = None,
    example: Optional[Any] = None
) -> dict:
    """Create a validation error response with optional guidance."""
    return error_response(message, "VALIDATION_ERROR", valid_values, hint, suggestion, example)


def not_found_error(
    resource: str,
    hint: Optional[str] = None,
    suggestion: Optional[str] = None
) -> dict:
    """Create a not found error response with optional guidance."""
    # Default suggestions based on resource type
    default_suggestions = {
        "Case": "Use search_cases(query='...') or list_cases() to find valid case IDs",
        "Task": "Use get_tasks(case_id=N) to see tasks for a case",
        "Event": "Use get_events(case_id=N) to see events for a case",
        "Person": "Use search_persons(name='...') to find the person_id",
        "Note": "Use get_notes(case_id=N) to see notes for a case",
        "Activity": "Use get_activities(case_id=N) to see activities for a case",
        "Jurisdiction": "Use list_jurisdictions() to see available jurisdictions",
        "Proceeding": "Use get_proceedings(case_id=N) to see proceedings for a case",
        "Case assignment": "Use get_case(case_id=N) to see current person assignments",
        "Judge assignment": "Use get_judges(proceeding_id=N) to see judges on a proceeding",
        "Expertise type": "Use manage_expertise_type(list_all=True) to see expertise types",
        "Person type": "Use manage_person_type(list_all=True) to see person types"
    }

    return error_response(
        f"{resource} not found",
        "NOT_FOUND",
        hint=hint,
        suggestion=suggestion or default_suggestions.get(resource)
    )


# =============================================================================
# Common Mistake Detection Helpers
# =============================================================================

def check_empty_required_field(value: Any, field_name: str) -> Optional[dict]:
    """Check if a required field is empty and return helpful error if so."""
    if value == "":
        return validation_error(
            f"{field_name} cannot be empty (it's a required field)",
            hint=f"Provide a valid value for {field_name}, or omit the parameter to leave unchanged"
        )
    return None


def check_clear_field_convention(value: Any, field_name: str, clearable: bool = True) -> Optional[dict]:
    """
    Explain the field clearing convention if user seems confused.
    Convention: pass "" (empty string) to clear optional fields, None/omit to leave unchanged.
    """
    if value is None:
        return None  # Correct usage - leave unchanged

    if value == "" and not clearable:
        return validation_error(
            f"{field_name} is required and cannot be cleared",
            hint="This field must have a value. Omit the parameter to leave it unchanged."
        )

    return None  # Valid - either a value or "" to clear


def invalid_status_error(status: str, status_type: str) -> dict:
    """Create a helpful error for invalid status values."""
    status_lists = {
        "case": CASE_STATUS_LIST,
        "task": TASK_STATUS_LIST
    }

    valid = status_lists.get(status_type, [])

    return validation_error(
        f"Invalid {status_type} status: '{status}'",
        valid_values=valid,
        hint=f"Status values are case-sensitive"
    )


def invalid_urgency_error(urgency: Any) -> dict:
    """Create a helpful error for invalid urgency values."""
    return validation_error(
        f"Invalid urgency: '{urgency}'",
        valid_values=["1 (Low)", "2 (Medium)", "3 (High)", "4 (Urgent)"],
        hint="Urgency must be an integer 1-4",
        example={"urgency": 3}
    )


def invalid_date_format_error(value: str, field_name: str) -> dict:
    """Create a helpful error for invalid date formats."""
    return validation_error(
        f"Invalid {field_name} format: '{value}'",
        hint="Use YYYY-MM-DD format (e.g., 2024-03-15)",
        example={field_name: "2024-03-15"}
    )


def invalid_time_format_error(value: str, field_name: str) -> dict:
    """Create a helpful error for invalid time formats."""
    return validation_error(
        f"Invalid {field_name} format: '{value}'",
        hint="Use HH:MM format in 24-hour time (e.g., 14:30 for 2:30 PM)",
        example={field_name: "14:30"}
    )


def invalid_side_error(side: str) -> dict:
    """Create a helpful error for invalid person side."""
    return validation_error(
        f"Invalid side: '{side}'",
        valid_values=PERSON_SIDE_LIST,
        hint="Side indicates which party in the case this person is associated with"
    )


def missing_search_params_error(available_params: List[str]) -> dict:
    """Create a helpful error when no search parameters provided."""
    return validation_error(
        "No search parameters provided",
        hint=f"Provide at least one of: {', '.join(available_params)}",
        example={available_params[0]: "example_value"}
    )


def judge_role_on_case_error(role: str) -> dict:
    """Error when trying to assign a judge role directly to a case."""
    return validation_error(
        f"Cannot assign '{role}' directly to a case",
        hint="Judges are assigned to proceedings, not cases. A case can have multiple proceedings (state court, federal, appeal) each with their own judges.",
        suggestion="Use add_proceeding() to create a proceeding, then add_proceeding_judge() to assign the judge"
    )


def person_type_attributes_hint(person_type: str) -> Optional[dict]:
    """Get attribute guidance for a person type."""
    attrs = PERSON_TYPE_ATTRIBUTES.get(person_type.lower())
    if attrs:
        return {
            "common_attributes": attrs["common"],
            "example": attrs["example"]
        }
    return None


def suggest_person_attributes(person_type: str) -> str:
    """Get a hint string about attributes for a person type."""
    attrs = PERSON_TYPE_ATTRIBUTES.get(person_type.lower())
    if attrs:
        return f"Common attributes for {person_type}: {', '.join(attrs['common'])}"
    return f"Any attributes can be stored in the 'attributes' dict"


# =============================================================================
# Task vs Event Guidance
# =============================================================================

TASK_VS_EVENT_HINT = """
Task = internal work YOU need to do (draft complaint, prepare outline, review docs)
Event = something HAPPENING on a date (hearing, deposition, filing deadline, trial)

If it's on the calendar and happens whether you're ready or not → Event
If it's work to prepare for something → Task
"""

def task_event_confusion_hint() -> str:
    """Return guidance on task vs event distinction."""
    return TASK_VS_EVENT_HINT.strip()
