"""
Pydantic input models for create/update operations.

Used by both MCP tools and REST routes.
"""

from typing import Optional
from pydantic import BaseModel

from .common import CaseStatus, TaskStatus, Urgency, IntakeStatus


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
    completion_date: Optional[str] = None
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
# Route Input Models — Notes
# =============================================================================

class CreateNoteInput(BaseModel):
    case_id: int
    content: str


class UpdateNoteInput(BaseModel):
    content: str


# =============================================================================
# Route Input Models — Intakes
# =============================================================================

class UpdateIntakeInput(BaseModel):
    status: Optional[IntakeStatus] = None
    notes: Optional[str] = None


class CreateIntakeInput(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    referral_note: Optional[str] = None
    case_type: Optional[str] = None
    incident_date: Optional[str] = None
    incident_time: Optional[str] = None
    location: Optional[str] = None
    incident_description: Optional[str] = None
    injury_description: Optional[str] = None
    notes: Optional[str] = None


class CreateIntakeCommentInput(BaseModel):
    content: str
