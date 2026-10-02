"""
Tools the in-app AI chat can call (intakes and tasks).

Registered on services.chat.registry.ToolRegistry. Each tool takes the chat's
ChatContext as its first argument (user_id, logging).
"""

from typing import Optional, Literal
from pydantic import BaseModel, Field
import db
from db import ValidationError
from db.existing_items import existing_tasks
from schemas import TaskStatus, Urgency


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


def review_existing_response(kind: str, existing: list[dict]) -> dict:
    """Result for a create held back so the model can check for duplicates.

    The model gets every existing item on the case and decides itself whether
    the new one is really one of them. Not an error (the chat UI shouldn't
    render it red) — nothing was created yet.
    """
    id_field = f"{kind}_id"
    return {
        "success": False,
        "status": "review_existing",
        "message": f"Checking {len(existing)} existing {kind}s on the case before creating",
        f"existing_{kind}s": existing,
        "next_step": (
            f"Nothing was created yet. Compare what you're creating against these existing {kind}s — "
            f"same real-world {kind} even if worded differently or rescheduled. "
            f"If it's already there with the same details: tell the user, don't create. "
            f"If it's already there with changed details (e.g. a new date): ask the user whether to update "
            f"the existing {kind} (show old → new); on yes call manage_{kind}(action='update', {id_field}=<id>, "
            f"<changed fields only>). If it's genuinely new: re-call create with confirmed_new=true "
            f"(this review covers every new {kind} for this case in the same turn — create those right away; only matched ones wait for the user)."
        ),
    }


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






class ManageTaskInput(BaseModel):
    """Create, update, delete, or bulk-update tasks."""
    action: Literal["create", "update", "delete", "bulk_update"] = Field(..., description="Action to perform")
    task_id: Optional[int] = Field(None, description="Required for update/delete")
    case_id: Optional[int] = Field(None, description="Required for create (case or intake); for bulk_update, updates all tasks on this case")
    intake_id: Optional[int] = Field(None, description="Link task to an intake instead of a case")
    description: Optional[str] = Field(None, description="Task description (required for create)")
    due_date: Optional[str] = Field(None, description="Due date YYYY-MM-DD")
    completion_date: Optional[str] = Field(None, description="Completion date YYYY-MM-DD")
    status: Optional[TaskStatus] = Field(None, description="Task status")
    urgency: Optional[Urgency] = Field(None, description="Task urgency")
    event_id: Optional[int] = Field(None, description="Link task to an event")
    assignee_id: Optional[int] = Field(None, description="Assign to a user (staff member ID)")
    confirmed_new: Optional[bool] = Field(None, description="(create) Set true only after reviewing the case's existing tasks (returned by a create with status=review_existing) and confirming this is not one of them.")
    # For bulk_update
    task_ids: Optional[list[int]] = Field(None, description="(bulk_update) List of task IDs to update")
    current_status: Optional[TaskStatus] = Field(None, description="(bulk_update) Only update tasks with this current status")





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
    # SEARCH (universal)
    # =========================================================================

    @mcp.tool()
    def search(context, data: SearchInput) -> dict:
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

                # Fuzzy fallback: if substring search found nothing and a
                # name query was provided, try fuzzy matching
                if data.query and not results.get("persons"):
                    fuzzy_results = db.fuzzy_search_persons_db(data.query, limit=data.limit)
                    if fuzzy_results:
                        return {"success": True, "persons": fuzzy_results, "total": len(fuzzy_results), "fuzzy_search": True}

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
        context,
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
    # MANAGE TASK
    # =========================================================================

    @mcp.tool()
    def manage_task(context, data: ManageTaskInput) -> dict:
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
                if not data.description:
                    return validation_error("description is required for create")
                # Bind to the case the user is viewing if the model omitted both
                # case_id and intake_id — otherwise an AI-created task on a case
                # page can be saved unattached. (Don't override an explicit
                # intake_id; intake tasks are intentionally case-less.)
                case_id = data.case_id
                if case_id is None and data.intake_id is None:
                    case_id = getattr(context, "case_context", None)
                if not data.confirmed_new:
                    existing = existing_tasks(case_id=case_id, intake_id=data.intake_id)
                    if existing:
                        return review_existing_response("task", existing)
                result = db.add_task(
                    case_id=case_id,
                    description=data.description,
                    due_date=data.due_date,
                    status=data.status or "Pending",
                    urgency=data.urgency or "Medium",
                    event_id=data.event_id,
                    assignee_id=data.assignee_id,
                    completion_date=data.completion_date,
                    intake_id=data.intake_id,
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
        except db.FeatureDisabled as e:
            return error_response(str(e), "FEATURE_DISABLED",
                                  hint=f"Tasks are disabled for case {e.case_id}.",
                                  suggestion="Ask the user to enable Tasks from the gear menu on the case page.")
        except Exception as e:
            return error_response(f"manage_task failed: {str(e)}", "MUTATION_ERROR")

    # =========================================================================
    # MANAGE INTAKE
    # =========================================================================

    @mcp.tool()
    def manage_intake(context, data: ManageIntakeInput) -> dict:
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
