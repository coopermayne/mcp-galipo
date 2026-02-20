"""
Pydantic output models for SQLAlchemy ORM → API serialization.

Each model uses `from_attributes=True` so it can be populated directly
from ORM objects via `Model.model_validate(obj).model_dump(mode="json")`.
"""

import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_serializer


# =============================================================================
# Shared Sub-Models (nested in other output models)
# =============================================================================

class UserBriefOut(BaseModel):
    """Minimal user info for nested display (assignee, paralegal, attendee)."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    first_name: str
    last_name: str
    initials: str


class CaseStaffUserOut(BaseModel):
    """User info for case staff (attorneys/paralegals) lists."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    first_name: str
    last_name: str
    initials: str
    position: str
    paralegal_id: Optional[int] = None


class RoleBriefOut(BaseModel):
    """Minimal role info nested in person assignments."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str


# =============================================================================
# Entity Output Models
# =============================================================================

# --- Roles ---

class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str
    sort_order: Optional[int] = None
    description: Optional[str] = None
    created_at: Optional[datetime.datetime] = None


class RoleWithCountOut(RoleOut):
    usage_count: int = 0


# --- Expertise Types ---

class ExpertiseTypeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None


# --- Jurisdictions ---

class JurisdictionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    aliases: Optional[list[str]] = None
    local_rules_link: Optional[str] = None
    notes: Optional[str] = None


# --- Notes ---

class NoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    case_id: Optional[int] = None
    content: str
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None


class NoteWithCaseOut(NoteOut):
    """Note with joined case info."""
    case_name: Optional[str] = None
    short_name: Optional[str] = None


# --- Webhooks ---

class WebhookOut(BaseModel):
    """Output schema for WebhookLog ORM objects."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    source: str
    event_type: Optional[str] = None
    idempotency_key: Optional[UUID] = None
    payload: Optional[dict] = None
    headers: Optional[dict] = None
    proceeding_id: Optional[int] = None
    task_id: Optional[int] = None
    event_id: Optional[int] = None
    processing_status: str
    processing_error: Optional[str] = None
    created_at: Optional[datetime.datetime] = None
    processed_at: Optional[datetime.datetime] = None


# --- Users ---

class UserOut(BaseModel):
    """Output schema for User ORM objects."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    first_name: str
    last_name: str
    initials: str
    bar_number: Optional[str] = None
    position: str
    is_admin: Optional[bool] = None
    must_change_password: Optional[bool] = None
    is_active: Optional[bool] = None
    paralegal_id: Optional[int] = None
    visible_features: Optional[dict] = None
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None
    paralegal: Optional[UserBriefOut] = None


class UserWithPasswordOut(UserOut):
    """UserOut + password_hash (for auth flows only)."""
    password_hash: str


class AttorneyOut(BaseModel):
    """Attorney with paralegal info."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    first_name: str
    last_name: str
    initials: str
    bar_number: Optional[str] = None
    paralegal_id: Optional[int] = None
    paralegal: Optional[UserBriefOut] = None


# --- Judges ---

class JudgeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    title: Optional[str] = None
    phones: Optional[list] = None
    emails: Optional[list] = None
    jurisdiction_id: Optional[int] = None
    chambers: Optional[str] = None
    courtroom_number: Optional[str] = None
    appointed_by: Optional[str] = None
    appointed_date: Optional[datetime.date] = None
    initials: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None
    jurisdiction_name: Optional[str] = None


class JudgeDetailOut(JudgeOut):
    """Judge with local_rules_link and proceeding assignments."""
    local_rules_link: Optional[str] = None
    proceedings: list[dict] = []


class ProceedingJudgeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    proceeding_id: int
    judge_id: int
    role: Optional[str] = None
    sort_order: Optional[int] = None
    created_at: Optional[datetime.datetime] = None
    name: Optional[str] = None
    judge_name: Optional[str] = None
    jurisdiction_id: Optional[int] = None
    jurisdiction_name: Optional[str] = None


# --- Proceedings ---

class ProceedingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    case_id: Optional[int] = None
    case_number: str
    jurisdiction_id: Optional[int] = None
    sort_order: Optional[int] = None
    is_primary: Optional[bool] = None
    notes: Optional[str] = None
    courtlistener_docket_id: Optional[int] = None
    pacer_case_id: Optional[str] = None
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None
    jurisdiction_name: Optional[str] = None
    local_rules_link: Optional[str] = None
    judges: list[dict] = []
    judge_name: Optional[str] = None
    judge_id: Optional[int] = None


# --- Events ---

class EventOut(BaseModel):
    """Output schema for Event ORM objects."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    case_id: Optional[int] = None
    date: datetime.date
    time: Optional[datetime.time] = None
    location: Optional[str] = None
    description: str
    document_link: Optional[str] = None
    calculation_note: Optional[str] = None
    starred: Optional[bool] = None
    created_at: Optional[datetime.datetime] = None

    @field_serializer('time')
    def serialize_time(self, val: Optional[datetime.time], _info) -> Optional[str]:
        """Output HH:MM (not HH:MM:SS) to match existing API contract."""
        if val is None:
            return None
        return val.strftime("%H:%M")


class EventWithCaseOut(EventOut):
    """Event with joined case info and task count."""
    case_name: Optional[str] = None
    short_name: Optional[str] = None
    case_color: Optional[str] = None
    task_count: int = 0


class EventDetailOut(EventWithCaseOut):
    """Event detail with attendee info."""
    attendee_ids: list[int] = []
    attendees: list[dict] = []


# --- Tasks ---

class TaskOut(BaseModel):
    """Output schema for Task ORM objects."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    case_id: Optional[int] = None
    description: str
    due_date: Optional[datetime.date] = None
    completion_date: Optional[datetime.date] = None
    status: str
    urgency: Optional[str] = None
    event_id: Optional[int] = None
    sort_order: Optional[int] = None
    assignee_id: Optional[int] = None
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None


class TaskWithRelationsOut(TaskOut):
    """Task with joined case, event, and assignee info."""
    case_name: Optional[str] = None
    short_name: Optional[str] = None
    case_color: Optional[str] = None
    event_description: Optional[str] = None
    event_date: Optional[datetime.date] = None
    has_events: bool = False
    assignee: Optional[UserBriefOut] = None


class TaskWithAssigneeOut(TaskOut):
    """Task with inline assignee dict (for update_task_full)."""
    assignee: Optional[UserBriefOut] = None


class TaskDetailOut(BaseModel):
    """Task detail view with flattened assignee fields."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    case_id: Optional[int] = None
    case_name: Optional[str] = None
    short_name: Optional[str] = None
    description: str
    due_date: Optional[datetime.date] = None
    completion_date: Optional[datetime.date] = None
    status: str
    urgency: Optional[str] = None
    event_id: Optional[int] = None
    sort_order: Optional[int] = None
    assignee_id: Optional[int] = None
    assignee_first_name: Optional[str] = None
    assignee_last_name: Optional[str] = None
    assignee_initials: Optional[str] = None


# --- Persons ---

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
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None


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
    assigned_date: Optional[datetime.date] = None
    created_at: Optional[datetime.datetime] = None


class CasePersonOut(BaseModel):
    """Person assigned to a case with role info (used by get_case_persons)."""
    id: int
    name: str
    phones: list = []
    emails: list = []
    organization: Optional[str] = None
    person_notes: Optional[str] = None
    assignment_id: int
    role_id: int
    attributes: dict = {}
    role_notes: Optional[str] = None
    is_primary: Optional[bool] = None
    grouped_under_id: Optional[int] = None
    assigned_date: Optional[str] = None
    assigned_at: Optional[str] = None
    role: RoleBriefOut
    grouped_under_name: Optional[str] = None


class RoleAssignmentOut(BaseModel):
    """Role assignment for person detail view (includes case info)."""
    assignment_id: int
    role_id: int
    case_id: Optional[int] = None
    attributes: dict = {}
    role_notes: Optional[str] = None
    is_primary: Optional[bool] = None
    grouped_under_id: Optional[int] = None
    assigned_date: Optional[str] = None
    created_at: Optional[str] = None
    role: RoleBriefOut
    case_name: Optional[str] = None
    short_name: Optional[str] = None
    color: Optional[str] = None
    grouped_under_name: Optional[str] = None


class PersonWithRolesOut(PersonOut):
    """Person with their role assignments."""
    roles: list[RoleAssignmentOut] = []


class PersonSearchOut(BaseModel):
    """Person result from search_persons."""
    id: int
    name: str
    phones: list = []
    emails: list = []
    organization: Optional[str] = None
    notes: Optional[str] = None
    archived: Optional[bool] = None
    created_at: Optional[str] = None
    roles: Optional[list[dict]] = None


# --- Cases ---

class CaseListOut(BaseModel):
    """Case row in the cases list view (from get_all_cases)."""
    id: int
    case_name: str
    short_name: Optional[str] = None
    status: str
    print_code: Optional[str] = None
    attorney_ids: Optional[list[int]] = None
    paralegal_ids: Optional[list[int]] = None
    judge: Optional[str] = None
    client_count: Optional[int] = None
    defendant_count: Optional[int] = None
    pending_task_count: Optional[int] = None
    upcoming_event_count: Optional[int] = None


class CaseDetailOut(BaseModel):
    """Full case detail (from get_case_by_id)."""
    id: int
    case_name: str
    short_name: Optional[str] = None
    status: str
    print_code: Optional[str] = None
    case_summary: Optional[str] = None
    result: Optional[str] = None
    date_of_injury: Optional[str] = None
    color: Optional[str] = None
    attorney_ids: Optional[list[int]] = None
    paralegal_ids: Optional[list[int]] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    attorneys: list[dict] = []
    paralegals: list[dict] = []
    persons: list[dict] = []
    events: list[dict] = []
    tasks: list[dict] = []
    notes: list[dict] = []
    proceedings: list[dict] = []


class CaseSearchOut(BaseModel):
    """Case result from search_cases."""
    id: int
    case_name: str
    short_name: Optional[str] = None
    status: str
    case_summary: Optional[str] = None


class CaseSummaryOut(BaseModel):
    """Lightweight case summary with counts."""
    id: int
    case_name: str
    short_name: Optional[str] = None
    status: str
    print_code: Optional[str] = None
    case_summary: Optional[str] = None
    date_of_injury: Optional[str] = None
    result: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    person_count: Optional[int] = None
    task_count: Optional[int] = None
    pending_task_count: Optional[int] = None
    event_count: Optional[int] = None
    upcoming_event_count: Optional[int] = None
    note_count: Optional[int] = None
    proceeding_count: Optional[int] = None


class CaseBriefOut(BaseModel):
    """Minimal case info (for get_cases_for_user)."""
    id: int
    case_name: str
    short_name: Optional[str] = None
    status: str


# --- Intakes ---

class IntakeOut(BaseModel):
    """Output schema for Intake ORM objects."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    submitted_on: Optional[datetime.datetime] = None
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    case_type: Optional[str] = None
    incident_date: Optional[datetime.date] = None
    incident_time: Optional[str] = None
    location: Optional[str] = None
    incident_description: Optional[str] = None
    injury_description: Optional[str] = None
    disclaimer_accepted: Optional[bool] = None
    status: str
    notes: Optional[str] = None
    ai_summary: Optional[str] = None
    ai_rating: Optional[int] = None
    ai_rating_reasoning: Optional[str] = None
    google_row_number: int
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None
