"""
Validation helper functions for database operations.
"""

import re

# Valid statuses and roles
CASE_STATUSES = [
    "Signing Up", "Prospective", "Pre-Filing", "Pleadings", "Discovery",
    "Expert Discovery", "Pre-trial", "Trial", "Post-Trial", "Appeal",
    "Settl. Pend.", "Stayed", "Closed"
]

TASK_STATUSES = [
    "Pending", "Active", "Done", "Partially Done", "Blocked", "Awaiting Atty Review"
]

ACTIVITY_TYPES = [
    "Meeting", "Filing", "Research", "Drafting", "Document Review",
    "Phone Call", "Email", "Court Appearance", "Deposition", "Other"
]

# Default person types (seeded into person_types table)
DEFAULT_PERSON_TYPES = [
    "client", "attorney", "judge", "expert", "mediator", "defendant",
    "witness", "lien_holder", "interpreter", "court_reporter",
    "process_server", "investigator", "insurance_adjuster", "guardian"
]

# Sides in a case
PERSON_SIDES = ["plaintiff", "defendant", "neutral"]

# Roles that cannot be assigned directly to cases (must go through proceedings)
JUDGE_ROLES = ["Judge", "Magistrate Judge"]

# Default expertise types for experts
DEFAULT_EXPERTISE_TYPES = [
    "Biomechanics", "Accident Reconstruction", "Medical - Orthopedic",
    "Medical - Neurology", "Medical - General", "Economics/Damages",
    "Vocational Rehabilitation", "Life Care Planning", "Forensic Accounting",
    "Engineering", "Human Factors", "Toxicology", "Psychiatry", "Psychology"
]

# Default jurisdictions
DEFAULT_JURISDICTIONS = [
    {"name": "C.D. Cal.", "local_rules_link": "https://www.cacd.uscourts.gov/court-procedures/local-rules"},
    {"name": "E.D. Cal.", "local_rules_link": "https://www.caed.uscourts.gov/caednew/index.cfm/rules/local-rules/"},
    {"name": "N.D. Cal.", "local_rules_link": "https://www.cand.uscourts.gov/rules/local-rules/"},
    {"name": "S.D. Cal.", "local_rules_link": "https://www.casd.uscourts.gov/rules.aspx"},
    {"name": "9th Cir.", "local_rules_link": "https://www.ca9.uscourts.gov/rules/"},
    {"name": "Los Angeles Superior", "local_rules_link": "https://www.lacourt.org/courtrules/ui/"},
    {"name": "Orange County Superior", "local_rules_link": None},
    {"name": "San Diego Superior", "local_rules_link": None},
    {"name": "Riverside Superior", "local_rules_link": None},
    {"name": "San Bernardino Superior", "local_rules_link": None},
]


class ValidationError(Exception):
    """Raised when input validation fails."""
    pass


def validate_case_status(status: str) -> str:
    """Validate case status against allowed values."""
    if status not in CASE_STATUSES:
        raise ValidationError(f"Invalid case status '{status}'. Must be one of: {', '.join(CASE_STATUSES)}")
    return status


def validate_task_status(status: str) -> str:
    """Validate task status against allowed values."""
    if status not in TASK_STATUSES:
        raise ValidationError(f"Invalid task status '{status}'. Must be one of: {', '.join(TASK_STATUSES)}")
    return status


def validate_urgency(urgency: int) -> int:
    """Validate urgency is between 1 and 4 (Low, Medium, High, Urgent)."""
    if not isinstance(urgency, int) or urgency < 1 or urgency > 4:
        raise ValidationError(f"Invalid urgency '{urgency}'. Must be an integer between 1 and 4.")
    return urgency


def validate_date_format(date_str: str, field_name: str = "date") -> str:
    """Validate date string is in YYYY-MM-DD format."""
    if date_str is None:
        return None
    if not re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
        raise ValidationError(f"Invalid {field_name} format '{date_str}'. Must be YYYY-MM-DD.")
    return date_str


def validate_time_format(time_str: str, field_name: str = "time") -> str:
    """Validate time string is in HH:MM format."""
    if time_str is None:
        return None
    if not re.match(r'^\d{2}:\d{2}$', time_str):
        raise ValidationError(f"Invalid {field_name} format '{time_str}'. Must be HH:MM.")
    return time_str


def validate_person_type(person_type: str) -> str:
    """Validate person type is a non-empty string. Any type is allowed."""
    if not person_type or not person_type.strip():
        raise ValidationError("Person type cannot be empty")
    return person_type.strip()


def validate_person_side(side: str) -> str:
    """Validate person side against allowed values."""
    if side and side not in PERSON_SIDES:
        raise ValidationError(f"Invalid side '{side}'. Must be one of: {', '.join(PERSON_SIDES)}")
    return side


def validate_case_person_role(role: str) -> str:
    """Validate that a case_person role is not a judge role (judges go on proceedings)."""
    if role in JUDGE_ROLES:
        raise ValidationError(
            f"Role '{role}' cannot be assigned directly to a case. "
            "Judges must be assigned to proceedings instead."
        )
    return role
