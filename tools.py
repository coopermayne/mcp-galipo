"""
MCP Tools for Legal Case Management

All MCP tools in one file to encourage keeping the tool count small.
"""

import asyncio
import logging
from datetime import datetime
from zoneinfo import ZoneInfo
from typing import Optional, Literal
from pydantic import BaseModel, Field
from fastmcp import Context
import db
from db import ValidationError
from schemas import (
    CaseStatus, TaskStatus, Urgency,
    SearchEntity, JudgeRole, ContactInfo,
)


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
        "Case": "Use search(entity='cases') to find valid case IDs",
        "Task": "Use search(entity='tasks', case_id=N) to see tasks for a case",
        "Event": "Use search(entity='events', case_id=N) to see events for a case",
        "Person": "Use search(entity='persons', query='...') to find the person_id",
        "Note": "Use get_details(entity='case', id=N) to see notes in the case summary",
        "Jurisdiction": "Specify jurisdiction_id when creating a proceeding",
        "Proceeding": "Use get_details(entity='case', id=N) to see proceedings",
        "Assignment": "Use search(entity='persons', case_id=N) to see current assignments",
        "Proceeding Judge": "Use get_details(entity='proceeding', id=N) to see assigned judges",
    }
    return error_response(
        f"{resource} not found", "NOT_FOUND",
        hint=hint, suggestion=suggestion or default_suggestions.get(resource)
    )


def judge_role_error() -> dict:
    return validation_error(
        "Judges cannot be assigned via person_roles",
        hint="Judges are standalone entities assigned to proceedings.",
        suggestion="Use create_judge() then add_judge_to_proceeding()"
    )


# =============================================================================
# Role Name Resolution
# =============================================================================

def resolve_role(name: str, auto_create: bool = False) -> dict | None:
    """Resolve a role name to a role dict, handling multiple formats.

    Accepts: 'plaintiff_expert', 'Plaintiff Expert', 'plaintiff expert', etc.
    If auto_create=True and the role doesn't exist, creates it with category 'other'.
    """
    # Try exact match first (case-insensitive)
    role = db.get_role_by_name(name)
    if role:
        return role
    # Try converting spaces/hyphens to underscores
    normalized = name.strip().lower().replace(" ", "_").replace("-", "_")
    role = db.get_role_by_name(normalized)
    if role:
        return role
    # Try converting underscores to spaces (for display names)
    spaced = name.strip().lower().replace("_", " ")
    role = db.get_role_by_name(spaced)
    if role:
        return role
    # Role doesn't exist
    if auto_create:
        return db.create_role(name=normalized, category="other")
    return None


# =============================================================================
# Pydantic Input Models
# =============================================================================

class SearchInput(BaseModel):
    """Universal search across all entities."""
    entity: Literal["cases", "persons", "events", "tasks", "judges"] = Field(..., description="What to search: cases, persons, events, tasks, or judges")
    query: Optional[str] = Field(None, description="Text search (name, description, case number)")
    case_id: Optional[int] = Field(None, description="Filter to a specific case")
    status: Optional[str] = Field(None, description="Filter by status (valid values depend on entity)")
    # Person-specific filters
    role: Optional[str] = Field(None, description="(persons) Filter by role name (requires case_id)")
    organization: Optional[str] = Field(None, description="(persons) Filter by org/firm")
    # Task-specific filters
    urgency: Optional[Urgency] = Field(None, description="(tasks) Filter by urgency")
    assignee_id: Optional[int] = Field(None, description="(tasks) Filter by assigned user")
    # Event-specific filters
    include_past: Optional[bool] = Field(False, description="(events) Include past events")
    # Date filters (tasks use due_date, events use event date)
    date_before: Optional[str] = Field(None, description="(tasks/events) Only results on or before this date YYYY-MM-DD")
    date_after: Optional[str] = Field(None, description="(tasks/events) Only results on or after this date YYYY-MM-DD")
    # Scoping
    my_cases_only: bool = Field(True, description="Limit to cases assigned to the current user. Set false to search all cases.")
    # Pagination
    limit: int = Field(50, description="Max results (1-200)", ge=1, le=200)
    offset: int = Field(0, description="Pagination offset", ge=0)


class ManageCaseInput(BaseModel):
    """Create, update, or delete a case."""
    action: Literal["create", "update", "delete"] = Field(..., description="Action to perform")
    case_id: Optional[int] = Field(None, description="Required for update/delete")
    case_name: Optional[str] = Field(None, description="Case name (required for create)")
    short_name: Optional[str] = Field(None, description="Short display name")
    status: Optional[CaseStatus] = Field(None, description="Case status")
    print_code: Optional[str] = Field(None, description="Short code for printing/filing")
    case_summary: Optional[str] = Field(None, description="Case summary text")
    result: Optional[str] = Field(None, description="Case result/outcome")
    date_of_injury: Optional[str] = Field(None, description="Date of injury (YYYY-MM-DD)")


class ManagePersonInput(BaseModel):
    """Create, update, or delete a person."""
    action: Literal["create", "update", "delete"] = Field(..., description="Action to perform")
    person_id: Optional[int] = Field(None, description="Required for update/delete")
    name: Optional[str] = Field(None, description="Full name (required for create)")
    phones: Optional[list[ContactInfo]] = Field(None, description="Phone numbers")
    emails: Optional[list[ContactInfo]] = Field(None, description="Email addresses")
    address: Optional[str] = Field(None, description="Mailing address")
    organization: Optional[str] = Field(None, description="Company, law firm, or organization")
    notes: Optional[str] = Field(None, description="Free-text notes")
    # Optional: auto-assign to a case on create (saves a separate manage_case_role call)
    case_id: Optional[int] = Field(None, description="If provided on create, auto-assign this person to the case")
    role: Optional[str] = Field(None, description="Role name for auto-assign (e.g. 'plaintiff_expert', 'opposing_counsel'). Requires case_id.")


class ManageCaseRoleInput(BaseModel):
    """Assign, update, change, or remove a person's role on a case."""
    action: Literal["assign", "update", "change_role", "remove"] = Field(..., description="Action to perform")
    case_id: int = Field(..., description="Case ID")
    person_id: int = Field(..., description="Person ID")
    role: str = Field(..., description="Role name: plaintiff, individual_defendant, opposing_counsel, co_counsel, plaintiff_expert, defense_expert, mediator, witness, lien_holder, etc. Accepts both snake_case and space-separated. NOT for judges (use manage_proceeding).")
    # For assign/update
    attributes: Optional[dict] = Field(None, description="Role-specific attributes: attorneys {bar_number}, experts {specialties, hourly_rate}, clients {date_of_birth}")
    case_notes: Optional[str] = Field(None, description="Notes about this person's involvement in the case")
    is_primary: Optional[bool] = Field(None, description="Whether this is the primary person in this role")
    grouped_under_id: Optional[int] = Field(None, description="Group under another person_role ID")
    assigned_date: Optional[str] = Field(None, description="Assignment date YYYY-MM-DD")
    # For change_role
    new_role: Optional[str] = Field(None, description="New role name (change_role action only)")


class ManageEventInput(BaseModel):
    """Create, update, or delete an event."""
    action: Literal["create", "update", "delete"] = Field(..., description="Action to perform")
    event_id: Optional[int] = Field(None, description="Required for update/delete")
    case_id: Optional[int] = Field(None, description="Required for create")
    date: Optional[str] = Field(None, description="Event date YYYY-MM-DD (required for create)")
    description: Optional[str] = Field(None, description="Event description (required for create)")
    time: Optional[str] = Field(None, description="Event time HH:MM (24-hour)")
    location: Optional[str] = Field(None, description="Location/courtroom")
    document_link: Optional[str] = Field(None, description="Link to related document")
    calculation_note: Optional[str] = Field(None, description="How the date was calculated (e.g. CCP 2030.260(a), 35 days from service)")
    starred: Optional[bool] = Field(None, description="Star/highlight this event")


class ManageTaskInput(BaseModel):
    """Create, update, delete, or bulk-update tasks."""
    action: Literal["create", "update", "delete", "bulk_update"] = Field(..., description="Action to perform")
    task_id: Optional[int] = Field(None, description="Required for update/delete")
    case_id: Optional[int] = Field(None, description="Required for create; for bulk_update, updates all tasks on this case")
    description: Optional[str] = Field(None, description="Task description (required for create)")
    due_date: Optional[str] = Field(None, description="Due date YYYY-MM-DD")
    completion_date: Optional[str] = Field(None, description="Completion date YYYY-MM-DD")
    status: Optional[TaskStatus] = Field(None, description="Task status")
    urgency: Optional[Urgency] = Field(None, description="Task urgency")
    event_id: Optional[int] = Field(None, description="Link task to an event")
    assignee_id: Optional[int] = Field(None, description="Assign to a user (staff member ID)")
    # For bulk_update
    task_ids: Optional[list[int]] = Field(None, description="(bulk_update) List of task IDs to update")
    current_status: Optional[TaskStatus] = Field(None, description="(bulk_update) Only update tasks with this current status")


class ManageNoteInput(BaseModel):
    """Create, update, or delete a note."""
    action: Literal["create", "update", "delete"] = Field(..., description="Action to perform")
    note_id: Optional[int] = Field(None, description="Required for update/delete")
    case_id: Optional[int] = Field(None, description="Required for create")
    content: Optional[str] = Field(None, description="Note content (required for create)")


class ManageProceedingInput(BaseModel):
    """Create, update, or delete a proceeding, or manage its judges."""
    action: Literal["create", "update", "delete", "add_judge", "remove_judge"] = Field(..., description="Action to perform")
    proceeding_id: Optional[int] = Field(None, description="Required for update/delete/add_judge/remove_judge")
    case_id: Optional[int] = Field(None, description="Required for create")
    case_number: Optional[str] = Field(None, description="Court case number (required for create)")
    jurisdiction_id: Optional[int] = Field(None, description="Jurisdiction ID")
    is_primary: Optional[bool] = Field(None, description="Whether this is the primary proceeding")
    notes: Optional[str] = Field(None, description="Proceeding notes")
    # For add_judge/remove_judge
    judge_id: Optional[int] = Field(None, description="(judge actions) Judge ID")
    judge_role: Optional[JudgeRole] = Field(None, description="(add_judge) Judge's role on this proceeding")


class ManageJudgeInput(BaseModel):
    """Create, update, or delete a judge."""
    action: Literal["create", "update", "delete"] = Field(..., description="Action to perform")
    judge_id: Optional[int] = Field(None, description="Required for update/delete")
    name: Optional[str] = Field(None, description="Judge's full name (required for create), e.g. 'Hon. Jane Wilson'")
    title: Optional[str] = Field(None, description="Title, e.g. 'Honorable', 'Magistrate'")
    jurisdiction_id: Optional[int] = Field(None, description="Jurisdiction ID (use list_jurisdictions to find)")
    phones: Optional[list[ContactInfo]] = Field(None, description="Phone numbers")
    emails: Optional[list[ContactInfo]] = Field(None, description="Email addresses")
    chambers: Optional[str] = Field(None, description="Chambers location")
    courtroom_number: Optional[str] = Field(None, description="Courtroom number")
    notes: Optional[str] = Field(None, description="Free-text notes")


class ManageIntakeInput(BaseModel):
    """Create or preview a new intake from unstructured text."""
    action: Literal["create", "preview"] = Field(..., description="Action: 'preview' to show gathered fields to user, 'create' to save")
    name: Optional[str] = Field(None, description="Name of the INJURED PERSON (not the contact or referral source). This is the case title.")
    email: Optional[str] = Field(None, description="Email of the direct contact person — whoever we can reach (injured person or family/friend). NEVER put the referral attorney's email here. Leave blank if unknown.")
    phone: Optional[str] = Field(None, description="Phone of the direct contact person — whoever we can reach (injured person or family/friend). NEVER put the referral attorney's phone here. Leave blank if unknown.")
    contact_relationship: Optional[str] = Field(None, description="Relationship of the contact to the injured person (e.g. 'brother', 'mother', 'friend', 'spouse'). Omit if the contact IS the injured person.")
    referral_name: Optional[str] = Field(None, description="Name of the referring professional (attorney, doctor, etc.) — NOT the family/friend contact")
    referral_org: Optional[str] = Field(None, description="Organization/firm of the referring professional")
    referral_email: Optional[str] = Field(None, description="Email of the referring professional")
    referral_phone: Optional[str] = Field(None, description="Phone of the referring professional")
    case_type: Optional[str] = Field(None, description="Type of case (e.g. auto accident, slip and fall)")
    incident_date: Optional[str] = Field(None, description="Date of incident YYYY-MM-DD")
    incident_time: Optional[str] = Field(None, description="Time of incident")
    location: Optional[str] = Field(None, description="Location of incident")
    incident_description: Optional[str] = Field(None, description="Description of what happened")
    injury_description: Optional[str] = Field(None, description="Description of injuries")
    notes: Optional[str] = Field(None, description="DO NOT USE — this field is reserved for office staff to enter internal notes manually. Never populate from AI.")


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
    # STAFF
    # =========================================================================

    @mcp.tool()
    async def list_staff(context: Context) -> dict:
        """List all active staff members (attorneys, paralegals, admins).

        Returns each user's id, name, initials, position, and paralegal info.
        Use this to find user IDs for task assignment (assignee_id).
        """
        context.info("Listing staff")
        try:
            users = await asyncio.to_thread(db.get_all_users)
            return {"success": True, "staff": users}
        except Exception as e:
            return error_response(f"Failed to list staff: {str(e)}", "QUERY_ERROR")

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
            client: plaintiff, contact, guardian_ad_litem, decedent
            counsel: co_counsel, referring_attorney, opposing_counsel, criminal_defense_attorney, prosecutor, public_defender
            defendant: municipality_defendant, individual_defendant
            expert: plaintiff_expert, defense_expert
            mediator: mediator
            other: lien_holder, witness, claims_adjuster, special_needs_consultant
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

            JUDGE FUZZY MATCHING: Judge names are fuzzy-matched against existing judges.
            - High-confidence match (e.g. "Hon. D. Gee" → "Dolly Gee"): auto-assigned.
              The result includes matched_name and match_score on the judge entry.
            - Ambiguous match (e.g. "Judge Smith" with multiple Smiths): NOT assigned.
              Appears in result["unresolved_judges"] with candidates to choose from.
              Use manage_proceeding(action="add_judge") to assign the correct one.
            - No match: a new judge is created (same as before).

        events[] - encompasses ALL calendar items: hearings, deadlines,
            depositions, CMCs, mediations, trial dates, filing deadlines, etc.
            Use the description to indicate the type of event.

        activities[].type (default "Other"):
            "Meeting", "Filing", "Research", "Drafting", "Document Review",
            "Phone Call", "Email", "Court Appearance", "Deposition", "Other"

        attorney_ids (optional, top-level):
            Array of user IDs (from list_staff) to assign as case attorneys.
            Each attorney's default paralegal is auto-assigned to the case.
            Example: "attorney_ids": [1, 3]

        INPUT SCHEMA:
        {
            "attorney_ids": [1, 3],  // optional - call list_staff() first
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
                    "role": "plaintiff",
                    "is_primary": true,
                    "phones": [{"value": "555-123-4567", "label": "Cell", "primary": true}],
                    "emails": [{"value": "john@example.com", "label": "Personal", "primary": true}],
                    "organization": "Self-employed",
                    "attributes": {"date_of_birth": "1980-01-01", "preferred_language": "English"},
                    "case_notes": "Prefers email contact"
                },
                {
                    "name": "Bob Attorney",
                    "role": "opposing_counsel",
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

        Returns all created IDs for verification. Check result["unresolved_judges"]
        for any judges that need manual assignment (ambiguous fuzzy matches).
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
    # SEARCH (universal)
    # =========================================================================

    @mcp.tool()
    def search(context: Context, data: SearchInput) -> dict:
        """Search across cases, persons, events, or tasks.

        Set entity to choose what to search. Combine with filters like case_id,
        status, query text, etc. Returns paginated results.

        Examples:
        - search(entity="cases", query="Smith") — find cases by name
        - search(entity="persons", case_id=1) — get all persons on a case
        - search(entity="tasks", case_id=1, status="Pending") — pending tasks
        - search(entity="events", case_id=1, include_past=true) — all events
        """
        context.info(f"Searching {data.entity}" + (f" for '{data.query}'" if data.query else ""))

        # Resolve user_id for case scoping (only when my_cases_only is True)
        # user_id is carried on the context object (set by ChatContext in chat,
        # or None when called via MCP directly)
        user_id = getattr(context, "user_id", None) if data.my_cases_only else None

        try:
            if data.entity == "cases":
                results = db.search_cases(
                    query=data.query,
                    status=data.status,
                    limit=data.limit,
                    user_id=user_id,
                )
                return {"success": True, "cases": results}

            elif data.entity == "persons":
                # Persons are not case-scoped — skip user_id filtering
                # If case_id provided with no other filters, get case roster
                if data.case_id and not data.query and not data.organization:
                    role_id = None
                    if data.role:
                        role_obj = resolve_role(data.role)
                        if not role_obj:
                            return validation_error(f"Unknown role: '{data.role}'", hint="Use a role name like 'plaintiff', 'opposing_counsel', 'plaintiff_expert', etc.")
                        role_id = role_obj["id"]
                    results = db.get_case_persons(
                        case_id=data.case_id,
                        role_id=role_id,
                    )
                    return {"success": True, "persons": results}
                # Otherwise, general person search
                role_id = None
                if data.role:
                    role_obj = resolve_role(data.role)
                    if role_obj:
                        role_id = role_obj["id"]
                results = db.search_persons(
                    name=data.query,
                    role_id=role_id,
                    organization=data.organization,
                    case_id=data.case_id,
                    limit=data.limit,
                    offset=data.offset,
                )
                return {"success": True, **results}

            elif data.entity == "events":
                if data.case_id:
                    results = db.get_upcoming_events(
                        case_id=data.case_id,
                        include_past=data.include_past or False,
                        limit=data.limit,
                        offset=data.offset,
                        user_id=user_id,
                    )
                    return {"success": True, **results}
                results = db.search_events(
                    query=data.query,
                    case_id=data.case_id,
                    limit=data.limit,
                    user_id=user_id,
                    date_before=data.date_before,
                    date_after=data.date_after,
                )
                return {"success": True, "events": results}

            elif data.entity == "tasks":
                results = db.search_tasks(
                    query=data.query,
                    case_id=data.case_id,
                    status=data.status,
                    urgency=data.urgency,
                    assignee_id=data.assignee_id,
                    limit=data.limit,
                    user_id=user_id,
                    due_date_before=data.date_before,
                    due_date_after=data.date_after,
                )
                return {"success": True, "tasks": results}

            elif data.entity == "judges":
                # Judges are not case-scoped — skip user_id filtering
                results = db.get_judges(
                    search=data.query,
                    limit=data.limit,
                    offset=data.offset,
                )
                return {"success": True, **results}

        except Exception as e:
            return error_response(f"Search failed: {str(e)}", "QUERY_ERROR")

    # =========================================================================
    # GET DETAILS (universal)
    # =========================================================================

    @mcp.tool()
    def get_details(
        context: Context,
        entity: Literal["case", "person", "event", "task", "proceeding", "judge"],
        id: int,
    ) -> dict:
        """Get full details for any entity by ID.

        Examples:
        - get_details(entity="case", id=1)
        - get_details(entity="person", id=42)
        - get_details(entity="task", id=100)
        - get_details(entity="judge", id=3)
        """
        context.info(f"Getting {entity} #{id}")
        try:
            if entity == "case":
                result = db.get_case_summary(id)
            elif entity == "person":
                result = db.get_person_by_id(id)
            elif entity == "event":
                result = db.get_event_by_id(id)
            elif entity == "task":
                result = db.get_task_detail(id)
            elif entity == "proceeding":
                result = db.get_proceeding_by_id(id)
            elif entity == "judge":
                result = db.get_judge_by_id(id)
            else:
                return validation_error(f"Unknown entity: '{entity}'", valid_values=["case", "person", "event", "task", "proceeding", "judge"])

            if not result:
                return not_found_error(entity.capitalize())
            return {"success": True, entity: result}

        except Exception as e:
            return error_response(f"Failed to get {entity}: {str(e)}", "QUERY_ERROR")

    # =========================================================================
    # MANAGE CASE
    # =========================================================================

    @mcp.tool()
    def manage_case(context: Context, data: ManageCaseInput) -> dict:
        """Create, update, or delete a case.

        Examples:
        - manage_case(action="create", case_name="Smith v. Jones", status="Pre-Filing")
        - manage_case(action="update", case_id=1, status="Discovery")
        - manage_case(action="delete", case_id=1)
        """
        context.info(f"manage_case: {data.action}")
        try:
            if data.action == "create":
                if not data.case_name:
                    return validation_error("case_name is required for create")
                result = db.create_case(
                    case_name=data.case_name,
                    status=data.status or "Signing Up",
                    print_code=data.print_code,
                    case_summary=data.case_summary,
                    result=data.result,
                    date_of_injury=data.date_of_injury,
                    short_name=data.short_name,
                )
                return {"success": True, "message": f"Case '{data.case_name}' created", "case_id": result["id"]}

            elif data.action == "update":
                if not data.case_id:
                    return validation_error("case_id is required for update")
                kwargs = {}
                for field in ["case_name", "short_name", "status", "print_code", "case_summary", "result", "date_of_injury"]:
                    val = getattr(data, field)
                    if val is not None:
                        kwargs[field] = val
                result = db.update_case(data.case_id, **kwargs)
                if not result:
                    return not_found_error("Case")
                return {"success": True, "message": f"Case #{data.case_id} updated", "case_id": data.case_id}

            elif data.action == "delete":
                if not data.case_id:
                    return validation_error("case_id is required for delete")
                deleted = db.delete_case(data.case_id)
                if not deleted:
                    return not_found_error("Case")
                return {"success": True, "message": f"Case #{data.case_id} deleted"}

        except ValidationError as e:
            return validation_error(str(e))
        except Exception as e:
            return error_response(f"manage_case failed: {str(e)}", "MUTATION_ERROR")

    # =========================================================================
    # MANAGE PERSON
    # =========================================================================

    @mcp.tool()
    def manage_person(context: Context, data: ManagePersonInput) -> dict:
        """Create, update, or delete a person (contact).

        On create, optionally pass case_id + role to auto-assign them to a case
        in one call (instead of a separate manage_case_role call).

        Examples:
        - manage_person(action="create", name="John Smith", case_id=1, role="plaintiff")
        - manage_person(action="create", name="Dr. Chen", case_id=1, role="plaintiff_expert")
        - manage_person(action="update", person_id=1, organization="New Firm LLP")
        - manage_person(action="delete", person_id=1)
        """
        context.info(f"manage_person: {data.action}")
        try:
            if data.action == "create":
                if not data.name:
                    return validation_error("name is required for create")
                result = db.create_person(
                    name=data.name,
                    phones=[p.model_dump() for p in data.phones] if data.phones else None,
                    emails=[e.model_dump() for e in data.emails] if data.emails else None,
                    address=data.address,
                    organization=data.organization,
                    notes=data.notes,
                )

                # Auto-assign to case if case_id and role provided
                assignment = None
                if data.case_id and data.role:
                    role_obj = resolve_role(data.role, auto_create=True)
                    if not role_obj:
                        # Person created but role assignment failed
                        return {
                            "success": True,
                            "message": f"Person '{data.name}' created (id={result['id']}) but role '{data.role}' not found — assign manually with manage_case_role",
                            "person_id": result["id"],
                        }
                    assignment = db.assign_person_to_case(
                        case_id=data.case_id,
                        person_id=result["id"],
                        role_id=role_obj["id"],
                    )

                msg = f"Person '{data.name}' created"
                if assignment:
                    msg += f" and assigned as {data.role} on case #{data.case_id}"
                return {"success": True, "message": msg, "person_id": result["id"]}

            elif data.action == "update":
                if not data.person_id:
                    return validation_error("person_id is required for update")
                kwargs = {}
                if data.name is not None:
                    kwargs["name"] = data.name
                if data.phones is not None:
                    kwargs["phones"] = [p.model_dump() for p in data.phones]
                if data.emails is not None:
                    kwargs["emails"] = [e.model_dump() for e in data.emails]
                for field in ["address", "organization", "notes"]:
                    val = getattr(data, field)
                    if val is not None:
                        kwargs[field] = val
                result = db.update_person(data.person_id, **kwargs)
                if not result:
                    return not_found_error("Person")
                return {"success": True, "message": f"Person #{data.person_id} updated", "person_id": data.person_id}

            elif data.action == "delete":
                if not data.person_id:
                    return validation_error("person_id is required for delete")
                deleted = db.delete_person(data.person_id)
                if not deleted:
                    return not_found_error("Person")
                return {"success": True, "message": f"Person #{data.person_id} deleted"}

        except ValidationError as e:
            return validation_error(str(e))
        except Exception as e:
            return error_response(f"manage_person failed: {str(e)}", "MUTATION_ERROR")

    # =========================================================================
    # MANAGE CASE ROLE
    # =========================================================================

    @mcp.tool()
    def manage_case_role(context: Context, data: ManageCaseRoleInput) -> dict:
        """Assign, update, change, or remove a person's role on a case.

        Role is specified by NAME (e.g. "plaintiff", "opposing_counsel") — resolved
        to role_id internally. NOT for judges — use manage_proceeding instead.

        Examples:
        - manage_case_role(action="assign", case_id=1, person_id=5, role="plaintiff", is_primary=true)
        - manage_case_role(action="update", case_id=1, person_id=5, role="plaintiff", case_notes="Prefers email")
        - manage_case_role(action="change_role", case_id=1, person_id=5, role="witness", new_role="plaintiff_expert")
        - manage_case_role(action="remove", case_id=1, person_id=5, role="plaintiff")
        """
        context.info(f"manage_case_role: {data.action} person #{data.person_id} on case #{data.case_id}")
        try:
            # Resolve role name to role_id (auto-creates if new)
            role_obj = resolve_role(data.role, auto_create=True)
            if not role_obj:
                return validation_error(
                    f"Unknown role: '{data.role}'",
                    hint="Use a role name like 'plaintiff', 'opposing_counsel', 'plaintiff_expert', etc.",
                    suggestion="Use search(entity='persons', case_id=N) to see current assignments"
                )
            role_id = role_obj["id"]

            # Block judge roles
            role_category = role_obj.get("category", "")
            if data.role.lower() in ("judge", "magistrate judge"):
                return judge_role_error()

            if data.action == "assign":
                result = db.assign_person_to_case(
                    case_id=data.case_id,
                    person_id=data.person_id,
                    role_id=role_id,
                    attributes=data.attributes,
                    notes=data.case_notes,
                    is_primary=data.is_primary or False,
                    grouped_under_id=data.grouped_under_id,
                    assigned_date=data.assigned_date,
                )
                return {"success": True, "message": f"Person #{data.person_id} assigned as {data.role} on case #{data.case_id}"}

            elif data.action == "update":
                # Find the assignment first
                persons = db.get_case_persons(data.case_id, role_id=role_id)
                assignment_id = None
                for p in persons:
                    if p.get("person_id") == data.person_id:
                        assignment_id = p.get("assignment_id") or p.get("person_role_id")
                        break
                if not assignment_id:
                    return not_found_error("Assignment", hint=f"Person #{data.person_id} not found with role '{data.role}' on case #{data.case_id}")

                kwargs = {}
                if data.attributes is not None:
                    kwargs["attributes"] = data.attributes
                if data.case_notes is not None:
                    kwargs["notes"] = data.case_notes
                if data.is_primary is not None:
                    kwargs["is_primary"] = data.is_primary
                if data.grouped_under_id is not None:
                    kwargs["grouped_under_id"] = data.grouped_under_id
                if data.assigned_date is not None:
                    kwargs["assigned_date"] = data.assigned_date
                result = db.update_case_assignment(assignment_id, **kwargs)
                if not result:
                    return not_found_error("Assignment")
                return {"success": True, "message": f"Assignment updated for person #{data.person_id} on case #{data.case_id}"}

            elif data.action == "change_role":
                if not data.new_role:
                    return validation_error("new_role is required for change_role action")
                new_role_obj = resolve_role(data.new_role, auto_create=True)
                if not new_role_obj:
                    return validation_error(f"Unknown new_role: '{data.new_role}'")
                result = db.change_person_role_on_case(
                    case_id=data.case_id,
                    person_id=data.person_id,
                    old_role_id=role_id,
                    new_role_id=new_role_obj["id"],
                )
                if not result:
                    return not_found_error("Assignment")
                return {"success": True, "message": f"Role changed from {data.role} to {data.new_role} for person #{data.person_id} on case #{data.case_id}"}

            elif data.action == "remove":
                removed = db.remove_person_from_case(
                    case_id=data.case_id,
                    person_id=data.person_id,
                    role_id=role_id,
                )
                if not removed:
                    return not_found_error("Assignment")
                return {"success": True, "message": f"Person #{data.person_id} removed from case #{data.case_id}"}

        except ValidationError as e:
            return validation_error(str(e))
        except Exception as e:
            return error_response(f"manage_case_role failed: {str(e)}", "MUTATION_ERROR")

    # =========================================================================
    # MANAGE EVENT
    # =========================================================================

    @mcp.tool()
    def manage_event(context: Context, data: ManageEventInput) -> dict:
        """Create, update, or delete a calendar event (hearing, deadline, deposition, etc.).

        Examples:
        - manage_event(action="create", case_id=1, date="2026-03-15", description="CMC", time="09:00")
        - manage_event(action="update", event_id=10, date="2026-03-20")
        - manage_event(action="delete", event_id=10)
        """
        context.info(f"manage_event: {data.action}")
        try:
            if data.action == "create":
                if not data.case_id:
                    return validation_error("case_id is required for create")
                if not data.date:
                    return validation_error("date is required for create")
                if not data.description:
                    return validation_error("description is required for create")
                result = db.add_event(
                    case_id=data.case_id,
                    date=data.date,
                    description=data.description,
                    document_link=data.document_link,
                    calculation_note=data.calculation_note,
                    time=data.time,
                    location=data.location,
                    starred=data.starred or False,
                )
                return {"success": True, "message": f"Event created: {data.description}", "event_id": result["id"]}

            elif data.action == "update":
                if not data.event_id:
                    return validation_error("event_id is required for update")
                kwargs = {}
                for field in ["date", "description", "time", "location", "document_link", "calculation_note", "starred"]:
                    val = getattr(data, field)
                    if val is not None:
                        kwargs[field] = val
                result = db.update_event_full(data.event_id, **kwargs)
                if not result:
                    return not_found_error("Event")
                return {"success": True, "message": f"Event #{data.event_id} updated", "event_id": data.event_id}

            elif data.action == "delete":
                if not data.event_id:
                    return validation_error("event_id is required for delete")
                deleted = db.delete_event(data.event_id)
                if not deleted:
                    return not_found_error("Event")
                return {"success": True, "message": f"Event #{data.event_id} deleted"}

        except ValidationError as e:
            return validation_error(str(e))
        except Exception as e:
            return error_response(f"manage_event failed: {str(e)}", "MUTATION_ERROR")

    # =========================================================================
    # MANAGE TASK
    # =========================================================================

    @mcp.tool()
    def manage_task(context: Context, data: ManageTaskInput) -> dict:
        """Create, update, delete, or bulk-update tasks.

        Examples:
        - manage_task(action="create", case_id=1, description="File MSJ", due_date="2026-03-01", urgency="High")
        - manage_task(action="update", task_id=5, status="Done", completion_date="2026-02-06")
        - manage_task(action="delete", task_id=5)
        - manage_task(action="bulk_update", task_ids=[1,2,3], status="Done")
        - manage_task(action="bulk_update", case_id=1, status="Done", current_status="Pending")
        """
        context.info(f"manage_task: {data.action}")
        try:
            if data.action == "create":
                if not data.case_id:
                    return validation_error("case_id is required for create")
                if not data.description:
                    return validation_error("description is required for create")
                result = db.add_task(
                    case_id=data.case_id,
                    description=data.description,
                    due_date=data.due_date,
                    status=data.status or "Pending",
                    urgency=data.urgency or "Medium",
                    event_id=data.event_id,
                    assignee_id=data.assignee_id,
                    completion_date=data.completion_date,
                )
                return {"success": True, "message": f"Task created: {data.description}", "task_id": result["id"]}

            elif data.action == "update":
                if not data.task_id:
                    return validation_error("task_id is required for update")
                kwargs = {}
                for field in ["description", "due_date", "completion_date", "status", "urgency", "event_id", "assignee_id"]:
                    val = getattr(data, field)
                    if val is not None:
                        kwargs[field] = val
                result = db.update_task_full(data.task_id, **kwargs)
                if not result:
                    return not_found_error("Task")
                return {"success": True, "message": f"Task #{data.task_id} updated", "task_id": data.task_id}

            elif data.action == "delete":
                if not data.task_id:
                    return validation_error("task_id is required for delete")
                deleted = db.delete_task(data.task_id)
                if not deleted:
                    return not_found_error("Task")
                return {"success": True, "message": f"Task #{data.task_id} deleted"}

            elif data.action == "bulk_update":
                if not data.status:
                    return validation_error("status is required for bulk_update")
                if data.task_ids:
                    result = db.bulk_update_tasks(data.task_ids, data.status)
                elif data.case_id:
                    result = db.bulk_update_tasks_for_case(data.case_id, data.status, current_status=data.current_status)
                else:
                    return validation_error("Either task_ids or case_id is required for bulk_update")
                return {"success": True, "message": f"Bulk update complete", **result}

        except ValidationError as e:
            return validation_error(str(e))
        except Exception as e:
            return error_response(f"manage_task failed: {str(e)}", "MUTATION_ERROR")

    # =========================================================================
    # MANAGE NOTE
    # =========================================================================

    @mcp.tool()
    def manage_note(context: Context, data: ManageNoteInput) -> dict:
        """Create, update, or delete a case note.

        Examples:
        - manage_note(action="create", case_id=1, content="Client prefers email contact")
        - manage_note(action="update", note_id=5, content="Updated note text")
        - manage_note(action="delete", note_id=5)
        """
        context.info(f"manage_note: {data.action}")
        try:
            if data.action == "create":
                if not data.case_id:
                    return validation_error("case_id is required for create")
                if not data.content:
                    return validation_error("content is required for create")
                result = db.add_note(case_id=data.case_id, content=data.content)
                return {"success": True, "message": "Note created", "note_id": result["id"]}

            elif data.action == "update":
                if not data.note_id:
                    return validation_error("note_id is required for update")
                if not data.content:
                    return validation_error("content is required for update")
                result = db.update_note(data.note_id, content=data.content)
                if not result:
                    return not_found_error("Note")
                return {"success": True, "message": f"Note #{data.note_id} updated", "note_id": data.note_id}

            elif data.action == "delete":
                if not data.note_id:
                    return validation_error("note_id is required for delete")
                deleted = db.delete_note(data.note_id)
                if not deleted:
                    return not_found_error("Note")
                return {"success": True, "message": f"Note #{data.note_id} deleted"}

        except ValidationError as e:
            return validation_error(str(e))
        except Exception as e:
            return error_response(f"manage_note failed: {str(e)}", "MUTATION_ERROR")

    # =========================================================================
    # MANAGE PROCEEDING
    # =========================================================================

    @mcp.tool()
    def manage_proceeding(context: Context, data: ManageProceedingInput) -> dict:
        """Create, update, or delete a court proceeding, or add/remove judges.

        CREATING A PROCEEDING:
        Only case_number is required. Put court name, jurisdiction, and any other
        details in the notes field — they'll be sorted out later.

        After creating, try to assign the judge:
        1. search(entity="judges", query="judge name") to find existing judge
        2. If found → manage_proceeding(action="add_judge", proceeding_id=X, judge_id=Y)
        3. If NOT found → do NOT create a new judge. Instead, add judge name to
           the proceeding notes so it can be assigned manually later.

        Examples:
        - manage_proceeding(action="create", case_id=1, case_number="24STCV12345", notes="Court: C.D. Cal.")
        - manage_proceeding(action="add_judge", proceeding_id=1, judge_id=3, judge_role="Judge")
        - manage_proceeding(action="update", proceeding_id=1, notes="Court: C.D. Cal., Judge: Hon. Smith (not in system)")
        - manage_proceeding(action="remove_judge", proceeding_id=1, judge_id=3)
        - manage_proceeding(action="delete", proceeding_id=1)
        """
        context.info(f"manage_proceeding: {data.action}")
        try:
            if data.action == "create":
                if not data.case_id:
                    return validation_error("case_id is required for create")
                if not data.case_number:
                    return validation_error("case_number is required for create")
                result = db.add_proceeding(
                    case_id=data.case_id,
                    case_number=data.case_number,
                    jurisdiction_id=data.jurisdiction_id,
                    is_primary=data.is_primary or False,
                    notes=data.notes,
                )
                return {"success": True, "message": f"Proceeding created: {data.case_number}", "proceeding_id": result["id"]}

            elif data.action == "update":
                if not data.proceeding_id:
                    return validation_error("proceeding_id is required for update")
                kwargs = {}
                for field in ["case_number", "jurisdiction_id", "is_primary", "notes"]:
                    val = getattr(data, field)
                    if val is not None:
                        kwargs[field] = val
                result = db.update_proceeding(data.proceeding_id, **kwargs)
                if not result:
                    return not_found_error("Proceeding")
                return {"success": True, "message": f"Proceeding #{data.proceeding_id} updated", "proceeding_id": data.proceeding_id}

            elif data.action == "delete":
                if not data.proceeding_id:
                    return validation_error("proceeding_id is required for delete")
                deleted = db.delete_proceeding(data.proceeding_id)
                if not deleted:
                    return not_found_error("Proceeding")
                return {"success": True, "message": f"Proceeding #{data.proceeding_id} deleted"}

            elif data.action == "add_judge":
                if not data.proceeding_id:
                    return validation_error("proceeding_id is required for add_judge")
                if not data.judge_id:
                    return validation_error("judge_id is required for add_judge")
                result = db.add_judge_to_proceeding(
                    proceeding_id=data.proceeding_id,
                    judge_id=data.judge_id,
                    role=data.judge_role or "Judge",
                )
                return {"success": True, "message": f"Judge #{data.judge_id} added to proceeding #{data.proceeding_id}", "proceeding_judge": result}

            elif data.action == "remove_judge":
                if not data.proceeding_id:
                    return validation_error("proceeding_id is required for remove_judge")
                if not data.judge_id:
                    return validation_error("judge_id is required for remove_judge")
                removed = db.remove_judge_from_proceeding(
                    proceeding_id=data.proceeding_id,
                    judge_id=data.judge_id,
                )
                if not removed:
                    return not_found_error("Proceeding Judge")
                return {"success": True, "message": f"Judge #{data.judge_id} removed from proceeding #{data.proceeding_id}"}

        except ValidationError as e:
            return validation_error(str(e))
        except Exception as e:
            return error_response(f"manage_proceeding failed: {str(e)}", "MUTATION_ERROR")

    # =========================================================================
    # MANAGE JUDGE (proceedings mode)
    # =========================================================================

    @mcp.tool()
    def manage_judge(context: Context, data: ManageJudgeInput) -> dict:
        """Create, update, or delete a judge.

        Before creating a new judge, ALWAYS search first:
        search(entity="judges", query="judge name") to check if they already exist.

        Examples:
        - manage_judge(action="create", name="Hon. Jane Wilson", jurisdiction_id=1)
        - manage_judge(action="update", judge_id=3, courtroom_number="Dept 5")
        - manage_judge(action="delete", judge_id=3)
        """
        context.info(f"manage_judge: {data.action}")
        try:
            if data.action == "create":
                if not data.name:
                    return validation_error("name is required for create")
                result = db.create_judge(
                    name=data.name,
                    title=data.title,
                    jurisdiction_id=data.jurisdiction_id,
                    phones=[p.model_dump() for p in data.phones] if data.phones else None,
                    emails=[e.model_dump() for e in data.emails] if data.emails else None,
                    chambers=data.chambers,
                    courtroom_number=data.courtroom_number,
                    notes=data.notes,
                )
                return {"success": True, "message": f"Judge '{data.name}' created", "judge_id": result["id"]}

            elif data.action == "update":
                if not data.judge_id:
                    return validation_error("judge_id is required for update")
                kwargs = {}
                for field in ["name", "title", "jurisdiction_id", "chambers", "courtroom_number", "notes"]:
                    val = getattr(data, field)
                    if val is not None:
                        kwargs[field] = val
                if data.phones is not None:
                    kwargs["phones"] = [p.model_dump() for p in data.phones]
                if data.emails is not None:
                    kwargs["emails"] = [e.model_dump() for e in data.emails]
                result = db.update_judge(data.judge_id, **kwargs)
                if not result:
                    return not_found_error("Judge")
                return {"success": True, "message": f"Judge #{data.judge_id} updated", "judge_id": data.judge_id}

            elif data.action == "delete":
                if not data.judge_id:
                    return validation_error("judge_id is required for delete")
                result = db.delete_judge(data.judge_id)
                if not result.get("success"):
                    return error_response(result.get("error", "Delete failed"), "MUTATION_ERROR")
                return {"success": True, "message": f"Judge #{data.judge_id} deleted"}

        except ValidationError as e:
            return validation_error(str(e))
        except Exception as e:
            return error_response(f"manage_judge failed: {str(e)}", "MUTATION_ERROR")

    # =========================================================================
    # LIST JURISDICTIONS (proceedings mode)
    # =========================================================================

    @mcp.tool()
    def list_jurisdictions(context: Context) -> dict:
        """List all available jurisdictions (courts).

        Returns all jurisdictions with their IDs and names.
        Use this to find a valid jurisdiction_id when creating proceedings or judges.
        """
        context.info("Listing jurisdictions")
        try:
            jurisdictions = db.get_jurisdictions()
            return {"success": True, "jurisdictions": jurisdictions}
        except Exception as e:
            return error_response(f"Failed to list jurisdictions: {str(e)}", "QUERY_ERROR")

    # =========================================================================
    # MANAGE INTAKE
    # =========================================================================

    @mcp.tool()
    def manage_intake(context: Context, data: ManageIntakeInput) -> dict:
        """Create or preview a new intake from parsed contact/incident information.

        Use action="preview" while still gathering info from the user — this
        shows a visual card of what's been collected so far (no database write).
        Use action="create" once you have enough info to save the intake.

        Extract fields from unstructured text (voicemail notes, emails, etc.)
        and create an intake record. All fields are optional but try to extract
        at least name, phone, and incident_date.

        Examples:
        - manage_intake(action="preview", name="John Smith", phone="555-1234")
        - manage_intake(action="create", name="John Smith", phone="555-1234", incident_date="2026-01-15", case_type="auto accident", incident_description="Rear-ended at intersection")
        """
        context.info(f"manage_intake: {data.action}")
        try:
            if data.action == "preview":
                fields = {}
                for field in ["name", "email", "phone", "contact_relationship", "referral_name", "referral_org", "referral_email", "referral_phone", "case_type", "incident_date", "incident_time", "location", "incident_description", "injury_description", "notes"]:
                    val = getattr(data, field)
                    if val is not None:
                        fields[field] = val
                return {"success": True, "preview": True, "fields": fields}

            if data.action == "create":
                kwargs = {}
                for field in ["name", "email", "phone", "contact_relationship", "referral_name", "referral_org", "referral_email", "referral_phone", "case_type", "incident_date", "incident_time", "location", "incident_description", "injury_description", "notes"]:
                    val = getattr(data, field)
                    if val is not None:
                        kwargs[field] = val
                result = db.create_intake(**kwargs)

                # Notify UI of the new intake
                from routes.sse import broadcast
                broadcast({"entity": "intake", "action": "created", "id": result["id"], "intake_id": result["id"]})

                # AI analysis is auto-triggered by the SQLAlchemy after_insert event listener
                return {"success": True, "message": "Intake created (AI analysis running in background)", "intake_id": result["id"], "intake": result}

        except Exception as e:
            return error_response(f"manage_intake failed: {str(e)}", "MUTATION_ERROR")
