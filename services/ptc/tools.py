"""
PTC tool definitions.

Each tool is a JSON schema dict with `allowed_callers` set so Claude
can only invoke them from within the code execution sandbox.
"""

from schemas.common import CASE_STATUS_LIST, TASK_STATUS_LIST, URGENCY_LIST

ALLOWED_CALLERS = ["code_execution_20260120"]


def get_tool_definitions() -> list[dict]:
    """Return all PTC tool schemas including server tools and custom tools.

    Tool search (BM25) is available but disabled at current scale (8 tools).
    At 8 tools, tool search adds ~130% token overhead vs loading all eagerly.
    Re-enable when tool count exceeds ~15 where deferred loading pays off.
    """
    custom_tools = [
        _search_cases(),
        _get_case_detail(),
        _search_tasks(),
        _search_events(),
        _search_persons(),
        _create_task(),
        _create_event(),
        _update_task(),
    ]

    return [
        # Server tools
        {"type": "code_execution_20260120", "name": "code_execution"},
        # Custom tools (all eager at current scale)
        *custom_tools,
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
