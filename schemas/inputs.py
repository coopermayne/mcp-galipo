"""
Pydantic input models for create/update operations.

Used by both MCP tools and REST routes.
"""

from typing import Literal, Optional
from pydantic import BaseModel

from .common import CaseStatus, TaskStatus, Urgency, IntakeStatus, ResolutionType


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
    trial_date: Optional[str] = None
    claim_deadline: Optional[str] = None
    complaint_deadline: Optional[str] = None


class UpdateCaseInput(BaseModel):
    case_name: Optional[str] = None
    short_name: Optional[str] = None
    status: Optional[CaseStatus] = None
    print_code: Optional[str] = None
    case_summary: Optional[str] = None
    result: Optional[str] = None
    date_of_injury: Optional[str] = None
    trial_date: Optional[str] = None
    trial_likelihood: Optional[int] = None
    trial_likelihood_note: Optional[str] = None
    trial_estimated_days: Optional[int] = None
    claim_deadline: Optional[str] = None
    complaint_deadline: Optional[str] = None
    notes: Optional[str] = None


# =============================================================================
# Route Input Models — Tasks
# =============================================================================

class CreateTaskInput(BaseModel):
    case_id: Optional[int] = None
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
    case_id: Optional[int] = None
    date: str
    description: str
    time: Optional[str] = None
    location: Optional[str] = None
    document_link: Optional[str] = None
    calculation_note: Optional[str] = None
    starred: Optional[bool] = False
    event_type: Optional[str] = None
    end_date: Optional[str] = None


class UpdateEventInput(BaseModel):
    date: Optional[str] = None
    description: Optional[str] = None
    time: Optional[str] = None
    location: Optional[str] = None
    document_link: Optional[str] = None
    calculation_note: Optional[str] = None
    starred: Optional[bool] = None
    event_type: Optional[str] = None
    end_date: Optional[str] = None


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
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    contact_relationship: Optional[str] = None
    referral_name: Optional[str] = None
    referral_org: Optional[str] = None
    referral_email: Optional[str] = None
    referral_phone: Optional[str] = None
    case_type: Optional[str] = None
    incident_date: Optional[str] = None
    incident_time: Optional[str] = None
    location: Optional[str] = None


class CreateIntakeInput(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    contact_relationship: Optional[str] = None
    referral_name: Optional[str] = None
    referral_org: Optional[str] = None
    referral_email: Optional[str] = None
    referral_phone: Optional[str] = None
    case_type: Optional[str] = None
    incident_date: Optional[str] = None
    incident_time: Optional[str] = None
    location: Optional[str] = None
    incident_description: Optional[str] = None
    injury_description: Optional[str] = None
    notes: Optional[str] = None


class CreateIntakeCommentInput(BaseModel):
    content: str


class CreateInteractionInput(BaseModel):
    interaction_type: Literal["email", "phone"]
    direction: Optional[Literal["inbound", "outbound"]] = None
    content: str


class SaveInteractionInput(BaseModel):
    interaction_type: Literal["email", "phone"]
    direction: Optional[Literal["inbound", "outbound"]] = None
    content: str
    summary: str


# =============================================================================
# Route Input Models — Case Comments
# =============================================================================

class CreateCaseCommentInput(BaseModel):
    content: str


# =============================================================================
# Route Input Models — Financials
# =============================================================================

class CreateFinancialInput(BaseModel):
    case_id: int
    resolution_type: Optional[ResolutionType] = None
    resolution_date: Optional[str] = None
    gross_recovery: Optional[float] = None
    costs_advanced: Optional[float] = None
    liens_total: Optional[float] = None
    is_finalized: Optional[bool] = False
    notes: Optional[str] = None


class UpdateFinancialInput(BaseModel):
    resolution_type: Optional[ResolutionType] = None
    resolution_date: Optional[str] = None
    gross_recovery: Optional[float] = None
    costs_advanced: Optional[float] = None
    liens_total: Optional[float] = None
    is_finalized: Optional[bool] = None
    notes: Optional[str] = None


# =============================================================================
# Route Input Models — Payees
# =============================================================================

class CreatePayeeInput(BaseModel):
    name: str
    pay_to: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None


class UpdatePayeeInput(BaseModel):
    name: Optional[str] = None
    pay_to: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None


# =============================================================================
# Route Input Models — Invoices
# =============================================================================

class CreateInvoiceInput(BaseModel):
    case_id: int
    amount: float
    payee_id: Optional[int] = None
    type: Optional[Literal["cost", "advance"]] = "cost"
    case_amount: Optional[float] = None
    status: Optional[Literal["unpaid", "paid"]] = "unpaid"
    date: Optional[str] = None
    due_date: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    check_number: Optional[str] = None
    paid_by_person_id: Optional[int] = None
    transfer_to_person_id: Optional[int] = None
    advanced_to_person_id: Optional[int] = None
    paid_date: Optional[str] = None
    file_path: Optional[str] = None
    file_name: Optional[str] = None
    content_type: Optional[str] = None
    notes: Optional[str] = None
    is_transfer: Optional[bool] = False


class UpdateInvoiceInput(BaseModel):
    amount: Optional[float] = None
    case_amount: Optional[float] = None
    payee_id: Optional[int] = None
    date: Optional[str] = None
    due_date: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    paid_by_person_id: Optional[int] = None
    transfer_to_person_id: Optional[int] = None
    advanced_to_person_id: Optional[int] = None
    notes: Optional[str] = None
    check_number: Optional[str] = None
    paid_date: Optional[str] = None


class MarkInvoicePaidInput(BaseModel):
    check_number: Optional[str] = None
    paid_date: Optional[str] = None


# =============================================================================
# Route Input Models — Liens
# =============================================================================

class CreateLienInput(BaseModel):
    case_id: int
    claimed_amount: float
    payee_id: Optional[int] = None
    negotiated_amount: Optional[float] = None
    status: Optional[Literal["pending", "negotiated", "paid"]] = "pending"
    date: Optional[str] = None
    paid_date: Optional[str] = None
    check_number: Optional[str] = None
    description: Optional[str] = None
    file_path: Optional[str] = None
    file_name: Optional[str] = None
    content_type: Optional[str] = None
    notes: Optional[str] = None


class UpdateLienInput(BaseModel):
    claimed_amount: Optional[float] = None
    negotiated_amount: Optional[float] = None
    payee_id: Optional[int] = None
    status: Optional[Literal["pending", "negotiated", "paid"]] = None
    date: Optional[str] = None
    paid_date: Optional[str] = None
    check_number: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
