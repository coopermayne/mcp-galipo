"""
Tool registry for the chat feature.

This module provides tool definitions in Claude's tool format for the AI chat.
These tools expose the database operations to Claude for case management.
"""

from typing import Any


def get_tool_definitions() -> list[dict[str, Any]]:
    """Return all available tools in Claude tool format.

    Returns:
        List of tool definitions with name, description, and input_schema.
    """
    return [
        # ===== CASE TOOLS =====
        {
            "name": "get_case",
            "description": "Get full details for a specific case by ID or name. Returns case info including persons, tasks, events, notes, and proceedings.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "case_id": {
                        "type": "integer",
                        "description": "The case ID"
                    },
                    "case_name": {
                        "type": "string",
                        "description": "The case name (alternative to ID)"
                    }
                },
                "required": []
            }
        },
        {
            "name": "list_cases",
            "description": "List all cases with optional status filter. Returns case summaries with counts of clients, defendants, pending tasks, and upcoming events.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "status_filter": {
                        "type": "string",
                        "description": "Filter by case status (e.g., 'Active', 'Signing Up', 'Closed', 'Settl. Pend.')"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of cases to return"
                    },
                    "offset": {
                        "type": "integer",
                        "description": "Number of cases to skip (for pagination)"
                    }
                },
                "required": []
            }
        },
        {
            "name": "search_cases",
            "description": "Search cases by query text, case number, person name, or status.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search text to match against case name or summary"
                    },
                    "case_number": {
                        "type": "string",
                        "description": "Search by case number"
                    },
                    "person_name": {
                        "type": "string",
                        "description": "Search by person name associated with case"
                    },
                    "status": {
                        "type": "string",
                        "description": "Filter by case status"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of results (default 50)"
                    }
                },
                "required": []
            }
        },
        {
            "name": "get_dashboard_stats",
            "description": "Get dashboard statistics including total cases, active cases, pending tasks, upcoming events, and cases by status.",
            "input_schema": {
                "type": "object",
                "properties": {},
                "required": []
            }
        },

        # ===== TASK TOOLS =====
        {
            "name": "get_tasks",
            "description": "Get tasks with optional filters by case, status, or urgency.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "case_id": {
                        "type": "integer",
                        "description": "Filter by case ID"
                    },
                    "status_filter": {
                        "type": "string",
                        "description": "Filter by status ('Pending', 'Done')"
                    },
                    "urgency_filter": {
                        "type": "integer",
                        "description": "Filter by urgency level (1-4, where 1 is highest)"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of tasks to return"
                    },
                    "offset": {
                        "type": "integer",
                        "description": "Number of tasks to skip (for pagination)"
                    }
                },
                "required": []
            }
        },
        {
            "name": "create_task",
            "description": "Create a new task for a case.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "case_id": {
                        "type": "integer",
                        "description": "The case ID to add the task to"
                    },
                    "description": {
                        "type": "string",
                        "description": "Task description"
                    },
                    "due_date": {
                        "type": "string",
                        "description": "Due date in YYYY-MM-DD format"
                    },
                    "status": {
                        "type": "string",
                        "description": "Task status ('Pending' or 'Done', default 'Pending')"
                    },
                    "urgency": {
                        "type": "integer",
                        "description": "Urgency level 1-4 (1=highest, default 2)"
                    }
                },
                "required": ["case_id", "description"]
            }
        },
        {
            "name": "update_task",
            "description": "Update a task's status and/or urgency.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "task_id": {
                        "type": "integer",
                        "description": "The task ID to update"
                    },
                    "status": {
                        "type": "string",
                        "description": "New status ('Pending' or 'Done')"
                    },
                    "urgency": {
                        "type": "integer",
                        "description": "New urgency level (1-4)"
                    }
                },
                "required": ["task_id"]
            }
        },
        {
            "name": "search_tasks",
            "description": "Search tasks by description, case, status, or urgency.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search text to match against task description"
                    },
                    "case_id": {
                        "type": "integer",
                        "description": "Filter by case ID"
                    },
                    "status": {
                        "type": "string",
                        "description": "Filter by status ('Pending' or 'Done')"
                    },
                    "urgency": {
                        "type": "integer",
                        "description": "Filter by urgency level (1-4)"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of results (default 50)"
                    }
                },
                "required": []
            }
        },

        # ===== EVENT TOOLS =====
        {
            "name": "get_events",
            "description": "Get calendar events (hearings, depositions, filing deadlines), optionally filtered by case.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "case_id": {
                        "type": "integer",
                        "description": "Filter by case ID"
                    }
                },
                "required": []
            }
        },
        {
            "name": "get_upcoming_events",
            "description": "Get upcoming events from today onwards.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of events to return"
                    },
                    "offset": {
                        "type": "integer",
                        "description": "Number of events to skip (for pagination)"
                    }
                },
                "required": []
            }
        },
        {
            "name": "create_event",
            "description": "Create a new calendar event for a case (hearing, deposition, filing deadline, etc.).",
            "input_schema": {
                "type": "object",
                "properties": {
                    "case_id": {
                        "type": "integer",
                        "description": "The case ID to add the event to"
                    },
                    "date": {
                        "type": "string",
                        "description": "Event date in YYYY-MM-DD format"
                    },
                    "description": {
                        "type": "string",
                        "description": "Event description"
                    },
                    "time": {
                        "type": "string",
                        "description": "Event time in HH:MM format (optional)"
                    },
                    "location": {
                        "type": "string",
                        "description": "Event location (optional)"
                    },
                    "document_link": {
                        "type": "string",
                        "description": "Link to related document (optional)"
                    },
                    "calculation_note": {
                        "type": "string",
                        "description": "Note about how date was calculated (optional)"
                    },
                    "starred": {
                        "type": "boolean",
                        "description": "Whether to star/highlight this event (default false)"
                    }
                },
                "required": ["case_id", "date", "description"]
            }
        },
        {
            "name": "get_calendar",
            "description": "Get calendar items (events and tasks with due dates) for the next N days.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "days": {
                        "type": "integer",
                        "description": "Number of days to look ahead (default 30)"
                    },
                    "include_tasks": {
                        "type": "boolean",
                        "description": "Include tasks with due dates (default true)"
                    },
                    "include_events": {
                        "type": "boolean",
                        "description": "Include calendar events (default true)"
                    }
                },
                "required": []
            }
        },

        # ===== NOTE TOOLS =====
        {
            "name": "add_note",
            "description": "Add a note to a case.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "case_id": {
                        "type": "integer",
                        "description": "The case ID to add the note to"
                    },
                    "content": {
                        "type": "string",
                        "description": "The note content"
                    }
                },
                "required": ["case_id", "content"]
            }
        },
        {
            "name": "get_notes",
            "description": "Get notes, optionally filtered by case.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "case_id": {
                        "type": "integer",
                        "description": "Filter by case ID"
                    }
                },
                "required": []
            }
        },

        # ===== PERSON TOOLS =====
        {
            "name": "search_persons",
            "description": "Search for persons/contacts by name, type, organization, email, or phone.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Search by name (partial match)"
                    },
                    "person_type": {
                        "type": "string",
                        "description": "Filter by type (e.g., 'Attorney', 'Medical Provider', 'Expert')"
                    },
                    "organization": {
                        "type": "string",
                        "description": "Search by organization name (partial match)"
                    },
                    "email": {
                        "type": "string",
                        "description": "Search by email (partial match)"
                    },
                    "phone": {
                        "type": "string",
                        "description": "Search by phone (partial match)"
                    },
                    "case_id": {
                        "type": "integer",
                        "description": "Filter to persons assigned to this case"
                    },
                    "archived": {
                        "type": "boolean",
                        "description": "Include archived persons (default false)"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of results (default 50)"
                    }
                },
                "required": []
            }
        },
        {
            "name": "get_person",
            "description": "Get full details for a person by ID, including their case assignments.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "person_id": {
                        "type": "integer",
                        "description": "The person ID"
                    }
                },
                "required": ["person_id"]
            }
        },
        {
            "name": "get_case_persons",
            "description": "Get all persons assigned to a case with optional filters.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "case_id": {
                        "type": "integer",
                        "description": "The case ID"
                    },
                    "person_type": {
                        "type": "string",
                        "description": "Filter by person type"
                    },
                    "role": {
                        "type": "string",
                        "description": "Filter by role (e.g., 'Client', 'Defendant', 'Judge', 'Attorney')"
                    },
                    "side": {
                        "type": "string",
                        "description": "Filter by side ('Plaintiff', 'Defendant', 'Neutral')"
                    }
                },
                "required": ["case_id"]
            }
        },
    ]


def get_tool_names() -> list[str]:
    """Get list of all available tool names.

    Returns:
        List of tool name strings.
    """
    return [tool["name"] for tool in get_tool_definitions()]
