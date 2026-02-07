"""
Validation helper functions for database operations.
"""

import re
from schemas import (
    CASE_STATUS_LIST, TASK_STATUS_LIST, ACTIVITY_TYPE_LIST, URGENCY_LIST,
)

# Backwards-compatible aliases (used throughout db/ and routes/)
CASE_STATUSES = CASE_STATUS_LIST
TASK_STATUSES = TASK_STATUS_LIST
ACTIVITY_TYPES = ACTIVITY_TYPE_LIST

# Role categories for the unified roles system
ROLE_CATEGORIES = ["expert", "counsel", "mediator", "client", "defendant", "other"]

# Valid user positions
USER_POSITIONS = ["attorney", "paralegal", "manager", "admin"]

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

# Default roles for the unified roles system (must match migration 013)
DEFAULT_ROLES = [
    # Category: client
    {"name": "plaintiff", "category": "client", "sort_order": 1},
    {"name": "contact", "category": "client", "sort_order": 2},
    {"name": "guardian_ad_litem", "category": "client", "sort_order": 3},
    {"name": "decedent", "category": "client", "sort_order": 4},
    # Category: counsel
    {"name": "co_counsel", "category": "counsel", "sort_order": 1},
    {"name": "referring_attorney", "category": "counsel", "sort_order": 2},
    {"name": "opposing_counsel", "category": "counsel", "sort_order": 3},
    {"name": "criminal_defense_attorney", "category": "counsel", "sort_order": 4},
    {"name": "prosecutor", "category": "counsel", "sort_order": 5},
    {"name": "public_defender", "category": "counsel", "sort_order": 6},
    # Category: defendant
    {"name": "municipality_defendant", "category": "defendant", "sort_order": 1},
    {"name": "individual_defendant", "category": "defendant", "sort_order": 2},
    # Category: expert
    {"name": "plaintiff_expert", "category": "expert", "sort_order": 1},
    {"name": "defense_expert", "category": "expert", "sort_order": 2},
    # Category: mediator
    {"name": "mediator", "category": "mediator", "sort_order": 1},
    # Category: other
    {"name": "lien_holder", "category": "other", "sort_order": 1},
    {"name": "witness", "category": "other", "sort_order": 2},
    {"name": "claims_adjuster", "category": "other", "sort_order": 3},
    {"name": "special_needs_consultant", "category": "other", "sort_order": 4},
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


URGENCY_VALUES = URGENCY_LIST


def validate_urgency(urgency: str) -> str:
    """Validate urgency is one of: Low, Medium, High, Urgent."""
    if urgency not in URGENCY_VALUES:
        raise ValidationError(f"Invalid urgency '{urgency}'. Must be one of: {', '.join(URGENCY_VALUES)}")
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


def validate_role_category(category: str) -> str:
    """Validate role category against allowed values."""
    if category not in ROLE_CATEGORIES:
        raise ValidationError(f"Invalid role category '{category}'. Must be one of: {', '.join(ROLE_CATEGORIES)}")
    return category


def validate_user_position(position: str) -> str:
    """Validate user position against allowed values."""
    if position not in USER_POSITIONS:
        raise ValidationError(f"Invalid position '{position}'. Must be one of: {', '.join(USER_POSITIONS)}")
    return position
