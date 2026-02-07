"""
Shared Pydantic schemas and type definitions.

Single source of truth for Literal types, derived list constants,
and Pydantic input models used by both MCP tools and REST routes.
"""

from typing import Optional, Literal, get_args
from datetime import date as date_type, datetime, datetime as datetime_type
from pydantic import BaseModel, ConfigDict, Field


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


# =============================================================================
# Route Input Models — Cases
# =============================================================================

class CreateCaseInput(BaseModel):
    case_name: str
    status: Optional[CaseStatus] = "Signing Up"
    short_name: Optional[str] = None
    print_code: Optional[str] = None
    case_summary: Optional[str] = None
    result: Optional[str] = None
    date_of_injury: Optional[str] = None


class UpdateCaseInput(BaseModel):
    case_name: Optional[str] = None
    short_name: Optional[str] = None
    status: Optional[CaseStatus] = None
    print_code: Optional[str] = None
    case_summary: Optional[str] = None
    result: Optional[str] = None
    date_of_injury: Optional[str] = None


# =============================================================================
# Route Input Models — Tasks
# =============================================================================

class CreateTaskInput(BaseModel):
    case_id: int
    description: str
    due_date: Optional[str] = None
    status: Optional[TaskStatus] = "Pending"
    urgency: Optional[Urgency] = "Medium"
    event_id: Optional[int] = None
    assignee_id: Optional[int] = None


class UpdateTaskInput(BaseModel):
    description: Optional[str] = None
    due_date: Optional[str] = None
    completion_date: Optional[str] = None
    status: Optional[TaskStatus] = None
    urgency: Optional[Urgency] = None
    event_id: Optional[int] = None
    assignee_id: Optional[int] = None


# =============================================================================
# Route Input Models — Events
# =============================================================================

class CreateEventInput(BaseModel):
    case_id: int
    date: str
    description: str
    time: Optional[str] = None
    location: Optional[str] = None
    document_link: Optional[str] = None
    calculation_note: Optional[str] = None
    starred: Optional[bool] = False


class UpdateEventInput(BaseModel):
    date: Optional[str] = None
    description: Optional[str] = None
    time: Optional[str] = None
    location: Optional[str] = None
    document_link: Optional[str] = None
    calculation_note: Optional[str] = None
    starred: Optional[bool] = None


# =============================================================================
# Route Input Models — Activities
# =============================================================================

class CreateActivityInput(BaseModel):
    case_id: int
    description: str
    activity_type: ActivityType
    date: str
    minutes: Optional[int] = None


class UpdateActivityInput(BaseModel):
    description: Optional[str] = None
    activity_type: Optional[ActivityType] = None
    date: Optional[str] = None
    minutes: Optional[int] = None


class ActivityOut(BaseModel):
    """Output schema for Activity ORM objects."""
    model_config = {"from_attributes": True}

    id: int
    case_id: Optional[int] = None
    date: date_type
    description: str
    type: str
    minutes: Optional[int] = None
    created_at: Optional[datetime_type] = None


# =============================================================================
# Route Input Models — Notes
# =============================================================================

class CreateNoteInput(BaseModel):
    case_id: int
    content: str


class UpdateNoteInput(BaseModel):
    content: str


# =============================================================================
# Output Models (for SQLAlchemy → API serialization)
# =============================================================================

class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str
    sort_order: Optional[int] = None
    description: Optional[str] = None
    created_at: Optional[datetime] = None


class RoleWithCountOut(RoleOut):
    usage_count: int = 0


class ExpertiseTypeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None


class JurisdictionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    local_rules_link: Optional[str] = None
    notes: Optional[str] = None


class NoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    case_id: Optional[int] = None
    content: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class JudgeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    phones: Optional[list] = None
    emails: Optional[list] = None
    jurisdiction_id: Optional[int] = None
    chambers: Optional[str] = None
    courtroom_number: Optional[str] = None
    appointed_by: Optional[str] = None
    appointed_date: Optional[date_type] = None
    initials: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ProceedingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    case_number: str
    case_id: Optional[int] = None
    jurisdiction_id: Optional[int] = None
    sort_order: Optional[int] = None
    is_primary: Optional[bool] = None
    notes: Optional[str] = None
    courtlistener_docket_id: Optional[int] = None
    pacer_case_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ProceedingJudgeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    proceeding_id: int
    judge_id: int
    role: Optional[str] = None
    sort_order: Optional[int] = None
    created_at: Optional[datetime] = None


class PersonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    phones: Optional[list] = None
    emails: Optional[list] = None
    address: Optional[str] = None
    organization: Optional[str] = None
    notes: Optional[str] = None
    archived: Optional[bool] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class PersonRoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    person_id: int
    role_id: int
    case_id: Optional[int] = None
    attributes: Optional[dict] = None
    notes: Optional[str] = None
    is_primary: Optional[bool] = None
    grouped_under_id: Optional[int] = None
    assigned_date: Optional[date_type] = None
    created_at: Optional[datetime] = None
