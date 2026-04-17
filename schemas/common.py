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

PersonSide = Literal["plaintiff", "defendant", "neutral"]
Urgency = Literal["Low", "Medium", "High", "Urgent"]
IntakeStatus = Literal[
    "New", "Dave Review", "Needs Follow-Up", "Awaiting PC",
    "Atty Review",
    "Needs Rejection Letter", "Rejection Letter Sent",
    "Needs Retainer", "Retainer Sent", "Retainer Signed",
    "Archived",
]

SearchEntity = Literal["cases", "tasks", "events", "persons"]
JudgeRole = Literal["Presiding", "Magistrate", "Panel", "Other"]
ResolutionType = Literal["settlement", "verdict", "judgment", "arbitration_award"]


# =============================================================================
# Derived List Constants (from Literals — single source of truth)
# =============================================================================

CASE_STATUS_LIST: list[str] = list(get_args(CaseStatus))
TASK_STATUS_LIST: list[str] = list(get_args(TaskStatus))
PERSON_SIDE_LIST: list[str] = list(get_args(PersonSide))
URGENCY_LIST: list[str] = list(get_args(Urgency))
INTAKE_STATUS_LIST: list[str] = list(get_args(IntakeStatus))
JUDGE_ROLE_LIST: list[str] = list(get_args(JudgeRole))
RESOLUTION_TYPE_LIST: list[str] = list(get_args(ResolutionType))

# Allowed status transitions for intakes (status -> list of valid next statuses)
INTAKE_TRANSITIONS: dict[str, list[str]] = {
    "New": ["Dave Review"],
    "Dave Review": ["Needs Follow-Up", "Awaiting PC", "Atty Review", "Needs Rejection Letter", "Needs Retainer"],
    "Needs Follow-Up": ["Awaiting PC", "Dave Review"],
    "Awaiting PC": ["Needs Follow-Up", "Dave Review"],
    "Atty Review": ["Dave Review"],
    "Needs Rejection Letter": ["Rejection Letter Sent"],
    "Rejection Letter Sent": ["Archived"],
    "Needs Retainer": ["Retainer Sent"],
    "Retainer Sent": ["Retainer Signed"],
    "Retainer Signed": ["Archived"],
}


# =============================================================================
# Shared Sub-Models
# =============================================================================

class ContactInfo(BaseModel):
    """A phone number or email entry."""
    value: str = Field(..., description="The phone number or email address")
    label: str = Field("", description="Label: 'Mobile', 'Work', 'Home', 'Office', etc.")
    primary: bool = Field(False, description="Whether this is the primary contact method")
