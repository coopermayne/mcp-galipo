"""
Shared Literal types, derived list constants, and common sub-models.

Single source of truth for enums and constants used across the app.
"""

from typing import Literal, get_args
from pydantic import BaseModel, Field


# =============================================================================
# Literal Type Definitions
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
Urgency = Literal["Low", "Medium", "High", "Urgent"]
SearchEntity = Literal["cases", "tasks", "events", "persons"]
JudgeRole = Literal["Judge", "Magistrate Judge", "Presiding", "Panel"]


# =============================================================================
# Derived List Constants (from Literals — single source of truth)
# =============================================================================

CASE_STATUS_LIST: list[str] = list(get_args(CaseStatus))
TASK_STATUS_LIST: list[str] = list(get_args(TaskStatus))
ACTIVITY_TYPE_LIST: list[str] = list(get_args(ActivityType))
PERSON_SIDE_LIST: list[str] = list(get_args(PersonSide))
URGENCY_LIST: list[str] = list(get_args(Urgency))
JUDGE_ROLE_LIST: list[str] = list(get_args(JudgeRole))


# =============================================================================
# Shared Sub-Models
# =============================================================================

class ContactInfo(BaseModel):
    """A phone number or email entry."""
    value: str = Field(..., description="The phone number or email address")
    label: str = Field("", description="Label: 'Mobile', 'Work', 'Home', 'Office', etc.")
    primary: bool = Field(False, description="Whether this is the primary contact method")
