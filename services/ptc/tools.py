"""
PTC tool definitions.

Each tool is a JSON schema dict with `allowed_callers` set so Claude
can only invoke them from within the code execution sandbox.
"""

from schemas.common import CASE_STATUS_LIST, TASK_STATUS_LIST, URGENCY_LIST

ALLOWED_CALLERS = ["code_execution_20260120"]


def _defer(tool: dict) -> dict:
    """Mark a tool for deferred loading (discovered via tool search)."""
    return {**tool, "defer_loading": True}


def get_tool_definitions() -> list[dict]:
    """Return all PTC tool schemas with deferred loading via BM25 tool search.

    Only get_current_time is eagerly loaded. All other custom tools are
    deferred — Claude discovers them on-demand via the tool_search server
    tool, keeping the context lean.
    """
    deferred_tools = [
        # Search / read
        _search_cases(),
        _get_case_detail(),
        _search_tasks(),
        _search_events(),
        _search_persons(),
        _search_judges(),
        # Tasks
        _create_task(),
        _update_task(),
        _delete_task(),
        _bulk_update_tasks(),
        # Events
        _create_event(),
        _update_event(),
        _delete_event(),
        # Cases
        _create_case(),
        _update_case(),
        _delete_case(),
        _assign_attorney(),
        _remove_attorney(),
        _assign_paralegal(),
        _remove_paralegal(),
        # Persons & roles
        _list_staff(),
        _list_roles(),
        _create_person(),
        _update_person(),
        _delete_person(),
        _assign_person_to_case(),
        _remove_person_from_case(),
        _change_person_role(),
        # Proceedings & judges
        _list_jurisdictions(),
        _create_proceeding(),
        _update_proceeding(),
        _delete_proceeding(),
        _create_judge(),
        _update_judge(),
        _delete_judge(),
        _add_judge_to_proceeding(),
        _remove_judge_from_proceeding(),
    ]

    # Toggle: set USE_DEFERRED=False to load all tools eagerly (for benchmarking)
    USE_DEFERRED = True

    if USE_DEFERRED:
        return [
            # Server tools
            {"type": "code_execution_20260120", "name": "code_execution"},
            {"type": "tool_search_tool_bm25_20251119", "name": "tool_search_tool_bm25"},
            # Eager tools (always in context)
            _get_current_time(),
            # Deferred tools (discovered via tool search)
            *[_defer(t) for t in deferred_tools],
        ]
    else:
        return [
            # Server tools
            {"type": "code_execution_20260120", "name": "code_execution"},
            # All tools eager
            _get_current_time(),
            *deferred_tools,
        ]


def _search_cases() -> dict:
    return {
        "name": "search_cases",
        "description": (
            "Search legal cases. Call with no filters to get ALL cases. "
            "Optionally filter by name, status, case number, or person name. "
            "Returns a list of dicts with keys: id, case_name, short_name, status, "
            "attorney_ids, paralegal_ids. "
            "Tip: to count by status, fetch all cases once and group in Python."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Text search on case name or summary",
                },
                "status": {
                    "type": "string",
                    "description": "Filter by case status",
                    "enum": list(CASE_STATUS_LIST),
                },
                "person_name": {
                    "type": "string",
                    "description": "Filter by a person's name on the case",
                },
                "case_number": {
                    "type": "string",
                    "description": "Filter by court case number",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max results (default 50)",
                    "default": 50,
                },
            },
        },
        "allowed_callers": ALLOWED_CALLERS,
    }


def _search_tasks() -> dict:
    return {
        "name": "search_tasks",
        "description": (
            "Search tasks across all cases. Call with no filters to get ALL tasks. "
            "Returns a list of dicts with keys: id, description, due_date, "
            "completion_date, status, urgency, assignee_id, assignee (dict with name), "
            "case_name, short_name, event_description, event_date."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Text search on task description",
                },
                "case_id": {
                    "type": "integer",
                    "description": "Filter by case ID",
                },
                "status": {
                    "type": "string",
                    "description": "Filter by task status",
                    "enum": list(TASK_STATUS_LIST),
                },
                "urgency": {
                    "type": "string",
                    "description": "Filter by urgency level",
                    "enum": list(URGENCY_LIST),
                },
                "assignee_id": {
                    "type": "integer",
                    "description": "Filter by assignee user ID",
                },
                "due_date_before": {
                    "type": "string",
                    "description": "Filter tasks due on or before this date (YYYY-MM-DD)",
                },
                "due_date_after": {
                    "type": "string",
                    "description": "Filter tasks due on or after this date (YYYY-MM-DD)",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max results (default 50)",
                    "default": 50,
                },
            },
        },
        "allowed_callers": ALLOWED_CALLERS,
    }


def _search_events() -> dict:
    return {
        "name": "search_events",
        "description": (
            "Search events/deadlines across all cases. Call with no filters to get ALL events. "
            "Returns a list of dicts with keys: id, case_id, case_name, short_name, "
            "date, time, location, description, starred."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Text search on event description",
                },
                "case_id": {
                    "type": "integer",
                    "description": "Filter by case ID",
                },
                "date_before": {
                    "type": "string",
                    "description": "Filter events on or before this date (YYYY-MM-DD)",
                },
                "date_after": {
                    "type": "string",
                    "description": "Filter events on or after this date (YYYY-MM-DD)",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max results (default 50)",
                    "default": 50,
                },
            },
        },
        "allowed_callers": ALLOWED_CALLERS,
    }


def _search_persons() -> dict:
    return {
        "name": "search_persons",
        "description": (
            "Search persons/contacts across all cases. Call with no filters to get ALL persons. "
            "Returns a dict with keys: persons (list of dicts with id, name, phones, emails, "
            "organization, notes, archived), total (int). "
            "To find persons on a specific case, use case_id filter — returns richer data "
            "including role, assignment details, and attributes."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Search by person name",
                },
                "case_id": {
                    "type": "integer",
                    "description": "Filter by case ID (returns case-specific assignment data)",
                },
                "role_name": {
                    "type": "string",
                    "description": "Filter by role name (e.g. 'Client', 'Defense Counsel', 'Expert Witness')",
                },
                "category": {
                    "type": "string",
                    "description": "Filter by role category",
                    "enum": ["client", "internal_team", "opposing_team", "third_party"],
                },
                "organization": {
                    "type": "string",
                    "description": "Search by organization name",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max results (default 50)",
                    "default": 50,
                },
            },
        },
        "allowed_callers": ALLOWED_CALLERS,
    }


def _create_task() -> dict:
    return {
        "name": "create_task",
        "description": (
            "Create a new task on a case. Returns the created task dict with id."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "case_id": {
                    "type": "integer",
                    "description": "The case ID to create the task on",
                },
                "description": {
                    "type": "string",
                    "description": "Task description",
                },
                "due_date": {
                    "type": "string",
                    "description": "Due date (YYYY-MM-DD)",
                },
                "status": {
                    "type": "string",
                    "description": "Task status (default: Pending)",
                    "enum": list(TASK_STATUS_LIST),
                    "default": "Pending",
                },
                "urgency": {
                    "type": "string",
                    "description": "Urgency level (default: Medium)",
                    "enum": list(URGENCY_LIST),
                    "default": "Medium",
                },
                "assignee_id": {
                    "type": "integer",
                    "description": "User ID to assign the task to",
                },
            },
            "required": ["case_id", "description"],
        },
        "allowed_callers": ALLOWED_CALLERS,
    }


def _create_event() -> dict:
    return {
        "name": "create_event",
        "description": (
            "Create a new event/deadline on a case. Returns the created event dict with id."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "case_id": {
                    "type": "integer",
                    "description": "The case ID to create the event on",
                },
                "date": {
                    "type": "string",
                    "description": "Event date (YYYY-MM-DD)",
                },
                "description": {
                    "type": "string",
                    "description": "Event description",
                },
                "time": {
                    "type": "string",
                    "description": "Event time (HH:MM, 24-hour format)",
                },
                "location": {
                    "type": "string",
                    "description": "Event location",
                },
                "starred": {
                    "type": "boolean",
                    "description": "Whether to star/highlight the event",
                    "default": False,
                },
            },
            "required": ["case_id", "date", "description"],
        },
        "allowed_callers": ALLOWED_CALLERS,
    }


def _update_task() -> dict:
    return {
        "name": "update_task",
        "description": (
            "Update an existing task. Only pass the fields you want to change. "
            "Returns the updated task dict."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "task_id": {
                    "type": "integer",
                    "description": "The task ID to update",
                },
                "description": {
                    "type": "string",
                    "description": "New task description",
                },
                "due_date": {
                    "type": "string",
                    "description": "New due date (YYYY-MM-DD)",
                },
                "status": {
                    "type": "string",
                    "description": "New status",
                    "enum": list(TASK_STATUS_LIST),
                },
                "urgency": {
                    "type": "string",
                    "description": "New urgency level",
                    "enum": list(URGENCY_LIST),
                },
                "assignee_id": {
                    "type": "integer",
                    "description": "New assignee user ID",
                },
                "completion_date": {
                    "type": "string",
                    "description": "Completion date (YYYY-MM-DD)",
                },
            },
            "required": ["task_id"],
        },
        "allowed_callers": ALLOWED_CALLERS,
    }


def _get_case_detail() -> dict:
    return {
        "name": "get_case_detail",
        "description": (
            "Get full case details by ID. Returns a dict with keys: "
            "id, case_name, short_name, status, case_summary, result, "
            "date_of_injury, notes, attorneys, paralegals, "
            "persons (list with name, role, phone, email), "
            "events (list with date, description, time, location), "
            "tasks (list with description, status, urgency, due_date, assignee), "
            "proceedings (list with case_number, jurisdiction, judges), "
            "note_records (list with content, created_at)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "case_id": {
                    "type": "integer",
                    "description": "The case ID to retrieve",
                },
            },
            "required": ["case_id"],
        },
        "allowed_callers": ALLOWED_CALLERS,
    }


# ---------------------------------------------------------------------------
# Phase 2: Full CRUD for tasks, events, notes, cases
# ---------------------------------------------------------------------------


def _delete_task() -> dict:
    return {
        "name": "delete_task",
        "description": "Delete a task by ID. Returns {deleted: true} or an error.",
        "input_schema": {
            "type": "object",
            "properties": {
                "task_id": {
                    "type": "integer",
                    "description": "The task ID to delete",
                },
            },
            "required": ["task_id"],
        },
        "allowed_callers": ALLOWED_CALLERS,
    }


def _bulk_update_tasks() -> dict:
    return {
        "name": "bulk_update_tasks",
        "description": (
            "Update status for multiple tasks at once. Provide either task_ids (list of IDs) "
            "or case_id (all tasks on a case). When using case_id, optionally filter by "
            "current_status to only update tasks with that status. "
            "Returns {updated: N} with the count of tasks changed."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "task_ids": {
                    "type": "array",
                    "items": {"type": "integer"},
                    "description": "List of task IDs to update",
                },
                "case_id": {
                    "type": "integer",
                    "description": "Update all tasks on this case (alternative to task_ids)",
                },
                "status": {
                    "type": "string",
                    "description": "New status to set",
                    "enum": list(TASK_STATUS_LIST),
                },
                "current_status": {
                    "type": "string",
                    "description": "Only update tasks with this current status (case_id mode only)",
                    "enum": list(TASK_STATUS_LIST),
                },
            },
            "required": ["status"],
        },
        "allowed_callers": ALLOWED_CALLERS,
    }


def _update_event() -> dict:
    return {
        "name": "update_event",
        "description": (
            "Update an existing event. Only pass the fields you want to change. "
            "Returns the updated event dict."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "event_id": {
                    "type": "integer",
                    "description": "The event ID to update",
                },
                "date": {
                    "type": "string",
                    "description": "New date (YYYY-MM-DD)",
                },
                "description": {
                    "type": "string",
                    "description": "New description",
                },
                "time": {
                    "type": "string",
                    "description": "New time (HH:MM, 24-hour format)",
                },
                "location": {
                    "type": "string",
                    "description": "New location",
                },
                "starred": {
                    "type": "boolean",
                    "description": "Whether to star/highlight the event",
                },
            },
            "required": ["event_id"],
        },
        "allowed_callers": ALLOWED_CALLERS,
    }


def _delete_event() -> dict:
    return {
        "name": "delete_event",
        "description": (
            "Delete an event by ID. Also deletes any tasks linked to the event. "
            "Returns {deleted: true} or an error."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "event_id": {
                    "type": "integer",
                    "description": "The event ID to delete",
                },
            },
            "required": ["event_id"],
        },
        "allowed_callers": ALLOWED_CALLERS,
    }



def _update_case() -> dict:
    return {
        "name": "update_case",
        "description": (
            "Update case fields. Only pass the fields you want to change. "
            "Notes field is read-only and cannot be updated here. "
            "Returns the full updated case dict."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "case_id": {
                    "type": "integer",
                    "description": "The case ID to update",
                },
                "case_name": {
                    "type": "string",
                    "description": "New case name",
                },
                "short_name": {
                    "type": "string",
                    "description": "New short name",
                },
                "status": {
                    "type": "string",
                    "description": "New case status",
                    "enum": list(CASE_STATUS_LIST),
                },
                "case_summary": {
                    "type": "string",
                    "description": "New case summary text",
                },
                "result": {
                    "type": "string",
                    "description": "Case result/outcome",
                },
                "date_of_injury": {
                    "type": "string",
                    "description": "Date of injury (YYYY-MM-DD)",
                },
                "trial_date": {
                    "type": "string",
                    "description": "Trial date (YYYY-MM-DD)",
                },
                "claim_deadline": {
                    "type": "string",
                    "description": "Claim deadline (YYYY-MM-DD)",
                },
                "complaint_deadline": {
                    "type": "string",
                    "description": "Complaint deadline (YYYY-MM-DD)",
                },
            },
            "required": ["case_id"],
        },
        "allowed_callers": ALLOWED_CALLERS,
    }


# ---------------------------------------------------------------------------
# Cases — create, delete, staff assignments
# ---------------------------------------------------------------------------


def _create_case() -> dict:
    return {
        "name": "create_case",
        "description": (
            "Create a new case. Returns the created case dict with id. "
            "Only case_name is required; all other fields are optional."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "case_name": {
                    "type": "string",
                    "description": "Name of the case (required)",
                },
                "short_name": {
                    "type": "string",
                    "description": "Short display name for the case",
                },
                "status": {
                    "type": "string",
                    "description": "Case status (default: Pre-Litigation)",
                    "enum": list(CASE_STATUS_LIST),
                    "default": "Pre-Litigation",
                },
                "case_summary": {
                    "type": "string",
                    "description": "Summary of the case",
                },
                "date_of_injury": {
                    "type": "string",
                    "description": "Date of injury (YYYY-MM-DD)",
                },
            },
            "required": ["case_name"],
        },
        "allowed_callers": ALLOWED_CALLERS,
    }


def _delete_case() -> dict:
    return {
        "name": "delete_case",
        "description": (
            "Delete a case and ALL related data (tasks, events, persons, proceedings, etc.). "
            "This action is irreversible."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "case_id": {
                    "type": "integer",
                    "description": "The case ID to delete",
                },
            },
            "required": ["case_id"],
        },
        "allowed_callers": ALLOWED_CALLERS,
    }


def _assign_attorney() -> dict:
    return {
        "name": "assign_attorney",
        "description": (
            "Assign an attorney (user) to a case. "
            "Auto-assigns their default paralegal if one is set. "
            "Returns updated case staff."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "case_id": {
                    "type": "integer",
                    "description": "The case ID",
                },
                "user_id": {
                    "type": "integer",
                    "description": "The attorney's user ID",
                },
            },
            "required": ["case_id", "user_id"],
        },
        "allowed_callers": ALLOWED_CALLERS,
    }


def _remove_attorney() -> dict:
    return {
        "name": "remove_attorney",
        "description": "Remove an attorney from a case. Returns updated case staff.",
        "input_schema": {
            "type": "object",
            "properties": {
                "case_id": {
                    "type": "integer",
                    "description": "The case ID",
                },
                "user_id": {
                    "type": "integer",
                    "description": "The attorney's user ID",
                },
            },
            "required": ["case_id", "user_id"],
        },
        "allowed_callers": ALLOWED_CALLERS,
    }


def _assign_paralegal() -> dict:
    return {
        "name": "assign_paralegal",
        "description": "Assign a paralegal (user) to a case. Returns updated case staff.",
        "input_schema": {
            "type": "object",
            "properties": {
                "case_id": {
                    "type": "integer",
                    "description": "The case ID",
                },
                "user_id": {
                    "type": "integer",
                    "description": "The paralegal's user ID",
                },
            },
            "required": ["case_id", "user_id"],
        },
        "allowed_callers": ALLOWED_CALLERS,
    }


def _remove_paralegal() -> dict:
    return {
        "name": "remove_paralegal",
        "description": "Remove a paralegal from a case. Returns updated case staff.",
        "input_schema": {
            "type": "object",
            "properties": {
                "case_id": {
                    "type": "integer",
                    "description": "The case ID",
                },
                "user_id": {
                    "type": "integer",
                    "description": "The paralegal's user ID",
                },
            },
            "required": ["case_id", "user_id"],
        },
        "allowed_callers": ALLOWED_CALLERS,
    }


# ---------------------------------------------------------------------------
# Persons & roles
# ---------------------------------------------------------------------------


def _list_staff() -> dict:
    return {
        "name": "list_staff",
        "description": "List all staff members (users) with IDs, names, and positions.",
        "input_schema": {
            "type": "object",
            "properties": {},
        },
        "allowed_callers": ALLOWED_CALLERS,
    }


def _list_roles() -> dict:
    return {
        "name": "list_roles",
        "description": (
            "List all available person roles (e.g. Client, Defense Counsel, "
            "Expert Witness). Returns list of dicts with id, name, category."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
        },
        "allowed_callers": ALLOWED_CALLERS,
    }


def _create_person() -> dict:
    return {
        "name": "create_person",
        "description": "Create a new person/contact. Returns the created person dict with id.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Full name of the person",
                },
                "phones": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of phone numbers",
                },
                "emails": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of email addresses",
                },
                "organization": {
                    "type": "string",
                    "description": "Organization or firm name",
                },
                "notes": {
                    "type": "string",
                    "description": "Free-text notes about this person",
                },
            },
            "required": ["name"],
        },
        "allowed_callers": ALLOWED_CALLERS,
    }


def _update_person() -> dict:
    return {
        "name": "update_person",
        "description": (
            "Update an existing person. Only pass the fields you want to change. "
            "Returns the updated person dict."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "person_id": {
                    "type": "integer",
                    "description": "The person ID to update",
                },
                "name": {
                    "type": "string",
                    "description": "New full name",
                },
                "phones": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "New list of phone numbers",
                },
                "emails": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "New list of email addresses",
                },
                "organization": {
                    "type": "string",
                    "description": "New organization name",
                },
                "notes": {
                    "type": "string",
                    "description": "New notes",
                },
            },
            "required": ["person_id"],
        },
        "allowed_callers": ALLOWED_CALLERS,
    }


def _delete_person() -> dict:
    return {
        "name": "delete_person",
        "description": "Delete a person by ID. Returns confirmation or error.",
        "input_schema": {
            "type": "object",
            "properties": {
                "person_id": {
                    "type": "integer",
                    "description": "The person ID to delete",
                },
            },
            "required": ["person_id"],
        },
        "allowed_callers": ALLOWED_CALLERS,
    }


def _assign_person_to_case() -> dict:
    return {
        "name": "assign_person_to_case",
        "description": (
            "Assign a person to a case with a specific role. "
            "Use list_roles to find the role_id. Returns the assignment dict."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "person_id": {
                    "type": "integer",
                    "description": "The person ID to assign",
                },
                "case_id": {
                    "type": "integer",
                    "description": "The case ID to assign to",
                },
                "role_id": {
                    "type": "integer",
                    "description": "The role ID (from list_roles)",
                },
                "notes": {
                    "type": "string",
                    "description": "Notes about this assignment",
                },
                "attributes": {
                    "type": "object",
                    "description": "Role-specific data (e.g. hourly_rate, bar_number)",
                },
            },
            "required": ["person_id", "case_id", "role_id"],
        },
        "allowed_callers": ALLOWED_CALLERS,
    }


def _remove_person_from_case() -> dict:
    return {
        "name": "remove_person_from_case",
        "description": "Remove a person from a case. Returns confirmation or error.",
        "input_schema": {
            "type": "object",
            "properties": {
                "person_id": {
                    "type": "integer",
                    "description": "The person ID to remove",
                },
                "case_id": {
                    "type": "integer",
                    "description": "The case ID to remove from",
                },
            },
            "required": ["person_id", "case_id"],
        },
        "allowed_callers": ALLOWED_CALLERS,
    }


def _change_person_role() -> dict:
    return {
        "name": "change_person_role",
        "description": (
            "Change a person's role on a case. "
            "Use list_roles to find the new_role_id. Returns updated assignment."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "person_id": {
                    "type": "integer",
                    "description": "The person ID",
                },
                "case_id": {
                    "type": "integer",
                    "description": "The case ID",
                },
                "new_role_id": {
                    "type": "integer",
                    "description": "The new role ID (from list_roles)",
                },
            },
            "required": ["person_id", "case_id", "new_role_id"],
        },
        "allowed_callers": ALLOWED_CALLERS,
    }


# ---------------------------------------------------------------------------
# Proceedings & judges
# ---------------------------------------------------------------------------


def _list_jurisdictions() -> dict:
    return {
        "name": "list_jurisdictions",
        "description": (
            "List all courts/jurisdictions. Returns a list of dicts with keys: "
            "id, name, state, county. Use to resolve jurisdiction names to IDs."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
        },
        "allowed_callers": ALLOWED_CALLERS,
    }


def _create_proceeding() -> dict:
    return {
        "name": "create_proceeding",
        "description": "Create a proceeding (court case) on a case. Returns the created proceeding dict.",
        "input_schema": {
            "type": "object",
            "properties": {
                "case_id": {
                    "type": "integer",
                    "description": "The case ID to add the proceeding to",
                },
                "case_number": {
                    "type": "string",
                    "description": "The court case number",
                },
                "jurisdiction_id": {
                    "type": "integer",
                    "description": "Jurisdiction ID (use list_jurisdictions to find)",
                },
            },
            "required": ["case_id", "case_number"],
        },
        "allowed_callers": ALLOWED_CALLERS,
    }


def _update_proceeding() -> dict:
    return {
        "name": "update_proceeding",
        "description": (
            "Update a proceeding. Only pass the fields you want to change. "
            "Returns the updated proceeding dict."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "proceeding_id": {
                    "type": "integer",
                    "description": "The proceeding ID to update",
                },
                "case_number": {
                    "type": "string",
                    "description": "New court case number",
                },
                "jurisdiction_id": {
                    "type": "integer",
                    "description": "New jurisdiction ID",
                },
                "notes": {
                    "type": "string",
                    "description": "Proceeding notes",
                },
                "is_primary": {
                    "type": "boolean",
                    "description": "Whether this is the primary proceeding for the case",
                },
            },
            "required": ["proceeding_id"],
        },
        "allowed_callers": ALLOWED_CALLERS,
    }


def _delete_proceeding() -> dict:
    return {
        "name": "delete_proceeding",
        "description": "Delete a proceeding by ID.",
        "input_schema": {
            "type": "object",
            "properties": {
                "proceeding_id": {
                    "type": "integer",
                    "description": "The proceeding ID to delete",
                },
            },
            "required": ["proceeding_id"],
        },
        "allowed_callers": ALLOWED_CALLERS,
    }


def _create_judge() -> dict:
    return {
        "name": "create_judge",
        "description": "Create a new judge. Returns the created judge dict with id.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Full name of the judge",
                },
                "title": {
                    "type": "string",
                    "description": "Title (e.g. 'Judge', 'Magistrate Judge', 'Justice')",
                },
                "jurisdiction_id": {
                    "type": "integer",
                    "description": "Jurisdiction ID the judge belongs to",
                },
            },
            "required": ["name"],
        },
        "allowed_callers": ALLOWED_CALLERS,
    }


def _update_judge() -> dict:
    return {
        "name": "update_judge",
        "description": "Update a judge. Only pass the fields you want to change.",
        "input_schema": {
            "type": "object",
            "properties": {
                "judge_id": {
                    "type": "integer",
                    "description": "The judge ID to update",
                },
                "name": {
                    "type": "string",
                    "description": "New name",
                },
                "title": {
                    "type": "string",
                    "description": "New title",
                },
                "jurisdiction_id": {
                    "type": "integer",
                    "description": "New jurisdiction ID",
                },
            },
            "required": ["judge_id"],
        },
        "allowed_callers": ALLOWED_CALLERS,
    }


def _delete_judge() -> dict:
    return {
        "name": "delete_judge",
        "description": "Delete a judge. Fails if the judge is assigned to any proceedings.",
        "input_schema": {
            "type": "object",
            "properties": {
                "judge_id": {
                    "type": "integer",
                    "description": "The judge ID to delete",
                },
            },
            "required": ["judge_id"],
        },
        "allowed_callers": ALLOWED_CALLERS,
    }


def _search_judges() -> dict:
    return {
        "name": "search_judges",
        "description": (
            "Search judges by name or jurisdiction. Returns a list of dicts with "
            "id, name, title, jurisdiction_id, jurisdiction_name."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search by judge name (fuzzy match)",
                },
                "jurisdiction_id": {
                    "type": "integer",
                    "description": "Filter by jurisdiction ID",
                },
            },
        },
        "allowed_callers": ALLOWED_CALLERS,
    }


def _add_judge_to_proceeding() -> dict:
    return {
        "name": "add_judge_to_proceeding",
        "description": "Link a judge to a proceeding. Returns the link dict.",
        "input_schema": {
            "type": "object",
            "properties": {
                "proceeding_id": {
                    "type": "integer",
                    "description": "The proceeding ID",
                },
                "judge_id": {
                    "type": "integer",
                    "description": "The judge ID",
                },
                "role": {
                    "type": "string",
                    "description": "Judge role (e.g. 'Presiding', 'Magistrate'). Default: 'Judge'",
                },
            },
            "required": ["proceeding_id", "judge_id"],
        },
        "allowed_callers": ALLOWED_CALLERS,
    }


def _remove_judge_from_proceeding() -> dict:
    return {
        "name": "remove_judge_from_proceeding",
        "description": "Remove a judge from a proceeding.",
        "input_schema": {
            "type": "object",
            "properties": {
                "proceeding_id": {
                    "type": "integer",
                    "description": "The proceeding ID",
                },
                "judge_id": {
                    "type": "integer",
                    "description": "The judge ID",
                },
            },
            "required": ["proceeding_id", "judge_id"],
        },
        "allowed_callers": ALLOWED_CALLERS,
    }


# ---------------------------------------------------------------------------
# System
# ---------------------------------------------------------------------------


def _get_current_time() -> dict:
    return {
        "name": "get_current_time",
        "description": (
            "Get the current date and time in Pacific timezone. "
            "Returns datetime, date (YYYY-MM-DD), time (HH:MM), and day_of_week."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
        },
        "allowed_callers": ALLOWED_CALLERS,
    }
