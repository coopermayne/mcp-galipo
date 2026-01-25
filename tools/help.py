"""
Help MCP Tool

Provides detailed usage information for tools on-demand.
This keeps verbose documentation out of the main tool docstrings
while still making it available when the AI needs it.
"""

from mcp.server.fastmcp import Context

# Detailed tool documentation registry
# Only loaded when get_tool_help is called
TOOL_HELP = {
    # === CASE TOOLS ===
    "list_cases": {
        "description": "List all cases with optional status filter.",
        "args": {
            "status_filter": "Filter by case status (optional)"
        },
        "returns": "List of cases with id, name, short_name, status",
        "example": 'list_cases(status_filter="Discovery")'
    },
    "get_case": {
        "description": "Get full details for a specific case by ID or name.",
        "args": {
            "case_id": "The numeric ID of the case",
            "case_name": "The name of the case (e.g., 'Martinez v. City of Los Angeles')"
        },
        "returns": "Complete case info including persons, proceedings, events, tasks, notes",
        "tip": "Use get_case_summary() for lighter response when you just need basic info"
    },
    "get_case_summary": {
        "description": "Get basic case info without all related data.",
        "args": {
            "case_id": "The numeric ID of the case"
        },
        "returns": "Case basics (id, name, status, dates) plus counts of related items",
        "tip": "Use this for quick context; use get_case() when you need full details"
    },
    "create_case": {
        "description": "Create a new case.",
        "args": {
            "case_name": "Name of the case (e.g., 'Jones v. LAPD') - REQUIRED",
            "status": "Initial status (default: 'Signing Up')",
            "print_code": "Short code for printing/filing",
            "case_summary": "Brief description of the case",
            "result": "Case outcome/result (e.g., 'Settled', 'Verdict for plaintiff')",
            "date_of_injury": "Date of injury (YYYY-MM-DD format)",
            "short_name": "Short display name (defaults to first word of case_name)"
        },
        "next_steps": [
            "assign_person_to_case() to add clients, defendants, counsel",
            "add_proceeding() to add court filings with jurisdiction",
            "add_event() to add deadlines and hearings"
        ],
        "example": 'create_case(case_name="Martinez v. City of LA", status="Signing Up")'
    },
    "update_case": {
        "description": "Update case fields. Only provided fields are updated.",
        "args": {
            "case_id": "ID of the case to update - REQUIRED",
            "case_name": "New case name",
            "short_name": "New short display name",
            "status": "New status",
            "print_code": "New print code",
            "case_summary": "New summary",
            "result": "Case outcome/result",
            "date_of_injury": "Date of injury (YYYY-MM-DD)"
        },
        "tip": "Court/jurisdiction is managed through proceedings, not directly on the case"
    },
    "search": {
        "description": "Universal search across cases, tasks, events, or persons.",
        "args": {
            "entity": "What to search: 'cases', 'tasks', 'events', or 'persons' - REQUIRED",
            "query": "Text search in name/description",
            "case_id": "Filter by case (tasks, events, persons)",
            "status": "Filter by status (cases, tasks)",
            "person_type": "Filter persons by type (e.g., 'expert', 'attorney')",
            "person_name": "Filter cases by person name",
            "case_number": "Filter cases by case number",
            "urgency": "Filter tasks by urgency (1-4)",
            "organization": "Filter persons by organization"
        },
        "examples": [
            'search(entity="cases", query="Martinez")',
            'search(entity="tasks", status="Pending", urgency=4)',
            'search(entity="persons", person_type="expert")',
            'search(entity="events", case_id=5)'
        ]
    },

    # === TASK TOOLS ===
    "add_task": {
        "description": "Add an internal task/to-do to a case.",
        "args": {
            "case_id": "ID of the case - REQUIRED",
            "description": "What needs to be done - REQUIRED",
            "due_date": "Due date (YYYY-MM-DD)",
            "urgency": "1=Low, 2=Medium (default), 3=High, 4=Urgent",
            "status": "Task status (default: 'Pending')",
            "event_id": "Link to an event this task supports"
        },
        "when_to_use": "Task = work YOU need to do to prepare (draft complaint, review docs, prepare outline)",
        "vs_event": "Event = something HAPPENING on a date (hearing, deposition, deadline)",
        "example": 'add_task(case_id=5, description="Draft motion for summary judgment", urgency=3)'
    },
    "get_tasks": {
        "description": "Get tasks, optionally filtered by case, status, or urgency.",
        "args": {
            "case_id": "Filter by specific case",
            "status_filter": "Filter by status",
            "urgency_filter": "Filter by urgency level (1-4)"
        },
        "tip": "Use search(entity='tasks', ...) for more flexible searching"
    },
    "update_task": {
        "description": "Update a task's fields.",
        "args": {
            "task_id": "ID of the task - REQUIRED",
            "description": "New description (cannot be empty)",
            "status": "New status",
            "urgency": "New urgency (1-4)",
            "due_date": "New due date (YYYY-MM-DD), pass '' to clear",
            "completion_date": "Date completed (YYYY-MM-DD), pass '' to clear"
        },
        "clearing_fields": "Pass empty string '' to clear optional date fields"
    },
    "bulk_update_tasks": {
        "description": "Update multiple tasks to the same status at once.",
        "args": {
            "task_ids": "List of task IDs to update - REQUIRED",
            "status": "New status for all tasks - REQUIRED"
        },
        "example": 'bulk_update_tasks(task_ids=[1, 2, 3], status="Done")'
    },

    # === EVENT TOOLS ===
    "add_event": {
        "description": "Add an event to a case - deadlines, hearings, depositions, etc.",
        "args": {
            "case_id": "ID of the case - REQUIRED",
            "date": "Event date (YYYY-MM-DD) - REQUIRED",
            "description": "What is due/happening - REQUIRED",
            "time": "Time of event (HH:MM, 24-hour)",
            "location": "Location (courtroom, address)",
            "document_link": "URL to related document",
            "calculation_note": "How date was calculated (e.g., 'Filing date + 60 days')",
            "starred": "Highlight in case overview (default: False)"
        },
        "when_to_use": "Event = it's happening whether you're ready or not (hearing, deadline, depo)",
        "vs_task": "Task = internal work to prepare for events",
        "examples": [
            'add_event(case_id=5, date="2024-06-15", description="MSJ hearing", time="09:00")',
            'add_event(case_id=5, date="2024-05-01", description="Discovery cutoff", starred=True)'
        ]
    },
    "get_calendar": {
        "description": "Get combined calendar view of tasks and events.",
        "args": {
            "days": "Number of days to look ahead (default: 30)",
            "include_tasks": "Include tasks (default: True)",
            "include_events": "Include events (default: True)"
        },
        "returns": "Combined list sorted by date with item_type field",
        "examples": [
            'get_calendar(days=7)  # This week',
            'get_calendar(days=1)  # Today only',
            'get_calendar(include_tasks=False)  # Events only'
        ]
    },

    # === PERSON TOOLS ===
    "manage_person": {
        "description": "Create or update a person (client, attorney, judge, expert, etc.).",
        "args": {
            "name": "Full name - REQUIRED",
            "person_type": "Type of person - REQUIRED",
            "person_id": "ID if updating existing (omit to create new)",
            "phones": "List of phone objects: [{value, label, primary}]",
            "emails": "List of email objects: [{value, label, primary}]",
            "address": "Physical address",
            "organization": "Firm, court, or company name",
            "attributes": "Type-specific attributes (see below)",
            "notes": "General notes",
            "archived": "Archive/unarchive the person"
        },
        "type_attributes": {
            "judge": ["courtroom", "department", "initials"],
            "expert": ["hourly_rate", "deposition_rate", "trial_rate", "expertises"],
            "attorney": ["bar_number"],
            "mediator": ["half_day_rate", "full_day_rate", "style"],
            "client": ["date_of_birth", "preferred_language", "emergency_contact"]
        },
        "examples": [
            'manage_person(name="Dr. Smith", person_type="expert", attributes={"hourly_rate": 500})',
            'manage_person(name="Hon. Jane Doe", person_type="judge", organization="C.D. Cal.")'
        ]
    },
    "assign_person_to_case": {
        "description": "Link a person to a case with a specific role.",
        "args": {
            "case_id": "ID of the case - REQUIRED",
            "person_id": "ID of the person - REQUIRED",
            "role": "Role in the case - REQUIRED",
            "side": "Which side: 'plaintiff', 'defendant', or 'neutral'",
            "case_attributes": "Case-specific overrides (e.g., special rate for this case)",
            "case_notes": "Case-specific notes",
            "is_primary": "Primary person for this role (default: False)",
            "contact_via_person_id": "Contact through another person"
        },
        "common_roles": [
            "Client", "Defendant", "Opposing Counsel", "Co-Counsel",
            "Plaintiff Expert", "Defendant Expert", "Mediator", "Witness"
        ],
        "note": "Judges go on PROCEEDINGS, not cases. Use add_proceeding_judge() instead.",
        "example": 'assign_person_to_case(case_id=1, person_id=5, role="Plaintiff Expert", side="plaintiff")'
    },

    # === PROCEEDING TOOLS ===
    "add_proceeding": {
        "description": "Add a court proceeding to a case.",
        "args": {
            "case_id": "ID of the case - REQUIRED",
            "case_number": "Court case number - REQUIRED",
            "jurisdiction_id": "ID of the court (use list_jurisdictions)",
            "is_primary": "Primary proceeding for the case (default: False)",
            "notes": "Notes about this proceeding"
        },
        "when_to_use": "A case can have multiple proceedings: state court, federal after removal, appeal, etc.",
        "next_steps": ["add_proceeding_judge() to assign judges"],
        "example": 'add_proceeding(case_id=5, case_number="2:24-cv-01234", jurisdiction_id=1, is_primary=True)'
    },
    "add_proceeding_judge": {
        "description": "Add a judge to a proceeding.",
        "args": {
            "proceeding_id": "ID of the proceeding - REQUIRED",
            "person_id": "ID of the judge - REQUIRED",
            "role": "Role: 'Judge', 'Presiding', 'Panel', or 'Magistrate Judge'",
            "sort_order": "Display order"
        },
        "note": "A proceeding can have multiple judges (panel, magistrate+judge)",
        "example": 'add_proceeding_judge(proceeding_id=1, person_id=5, role="Magistrate Judge")'
    },

    # === OTHER TOOLS ===
    "list_jurisdictions": {
        "description": "List all jurisdictions (courts).",
        "returns": "List with id, name, local_rules_link, notes",
        "tip": "Use jurisdiction IDs when creating proceedings"
    },
    "log_activity": {
        "description": "Log a time/activity entry to a case.",
        "args": {
            "case_id": "ID of the case - REQUIRED",
            "description": "Description of the activity - REQUIRED",
            "activity_type": "Type of activity - REQUIRED",
            "minutes": "Time spent in minutes",
            "date": "Date of activity (YYYY-MM-DD), defaults to today"
        },
        "activity_types": [
            "Meeting", "Filing", "Research", "Drafting", "Document Review",
            "Phone Call", "Email", "Court Appearance", "Deposition", "Other"
        ]
    }
}


def register_help_tools(mcp):
    """Register help-related MCP tools."""

    @mcp.tool()
    def get_tool_help(context: Context, tool_name: str) -> dict:
        """Get detailed usage info for a specific tool."""
        context.info(f"Getting help for tool: {tool_name}")

        # Normalize tool name
        tool_name = tool_name.lower().strip()

        # Check for exact match
        if tool_name in TOOL_HELP:
            return {"success": True, "tool": tool_name, "help": TOOL_HELP[tool_name]}

        # Check for partial match
        matches = [name for name in TOOL_HELP.keys() if tool_name in name]
        if len(matches) == 1:
            return {"success": True, "tool": matches[0], "help": TOOL_HELP[matches[0]]}
        elif len(matches) > 1:
            return {
                "success": False,
                "error": f"Multiple matches for '{tool_name}'",
                "matches": matches,
                "hint": "Be more specific or use exact tool name"
            }

        # No match - list available tools
        available = sorted(TOOL_HELP.keys())
        return {
            "success": False,
            "error": f"No help found for '{tool_name}'",
            "available_tools": available,
            "hint": "Use one of the available tool names"
        }

    @mcp.tool()
    def list_tools(context: Context, category: str = None) -> dict:
        """List available tools, optionally filtered by category."""
        context.info(f"Listing tools{' for category ' + category if category else ''}")

        categories = {
            "cases": ["list_cases", "get_case", "get_case_summary", "create_case", "update_case", "delete_case"],
            "tasks": ["add_task", "get_tasks", "update_task", "delete_task", "reorder_task", "bulk_update_tasks", "bulk_update_case_tasks"],
            "events": ["add_event", "get_events", "update_event", "delete_event", "get_calendar"],
            "persons": ["manage_person", "get_person", "assign_person_to_case", "update_case_assignment", "remove_person_from_case"],
            "proceedings": ["add_proceeding", "get_proceedings", "update_proceeding", "delete_proceeding", "add_proceeding_judge", "remove_proceeding_judge", "get_judges", "update_proceeding_judge"],
            "search": ["search"],
            "other": ["list_jurisdictions", "manage_jurisdiction", "delete_jurisdiction", "log_activity", "get_activities", "update_activity", "delete_activity", "get_notes", "add_note", "update_note", "delete_note"]
        }

        if category:
            category = category.lower()
            if category in categories:
                return {
                    "success": True,
                    "category": category,
                    "tools": categories[category]
                }
            else:
                return {
                    "success": False,
                    "error": f"Unknown category '{category}'",
                    "available_categories": list(categories.keys())
                }

        return {
            "success": True,
            "categories": categories,
            "tip": "Use get_tool_help(tool_name) for detailed usage info"
        }
