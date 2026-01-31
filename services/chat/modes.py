"""
Chat mode configurations.

Defines tool allowlists and system prompt additions for each chat mode,
enabling focused interactions that are faster, cheaper, and more accurate.
"""

from typing import Any

# Mode configurations
# - tools: list of allowed tool names (empty list = all tools)
# - system_prompt_addition: extra context for the mode
CHAT_MODES: dict[str, dict[str, Any]] = {
    "tasks": {
        "tools": [
            "get_tasks",
            "add_task",
            "update_task",
            "delete_task",
            "bulk_update_tasks",
            "bulk_update_case_tasks",
            "reorder_task",
            "get_case_summary",
            "search",
        ],
        "system_prompt_addition": """You are in TASKS mode. Focus exclusively on task management:
- Creating, updating, and completing tasks
- Setting priorities and due dates
- Organizing task order and dependencies
- Querying task status and history

Do not attempt to manage events, contacts, or other non-task data.""",
    },
    "events": {
        "tools": [
            "get_events",
            "add_event",
            "update_event",
            "delete_event",
            "get_calendar",
            "get_case_summary",
        ],
        "system_prompt_addition": """You are in EVENTS mode. Focus exclusively on calendar and scheduling:
- Creating and updating events (hearings, depositions, meetings, deadlines)
- Managing event dates, times, and locations
- Querying the calendar and upcoming events

Do not attempt to manage tasks, contacts, or other non-event data.""",
    },
    "people": {
        "tools": [
            "manage_person",
            "get_person",
            "assign_person_to_case",
            "update_case_assignment",
            "remove_person_from_case",
            "search",
            "get_case_summary",
        ],
        "system_prompt_addition": """You are in PEOPLE mode. Focus exclusively on contact management:
- Adding and updating persons (attorneys, experts, clients, etc.)
- Assigning and removing persons from cases with roles
- Managing person attributes and contact information
- Searching for existing contacts

Do not attempt to manage tasks, events, or other non-person data.""",
    },
    "overview": {
        "tools": [
            "list_cases",
            "get_case_summary",
            "get_tasks",
            "get_events",
            "get_activities",
            "get_calendar",
            "search",
        ],
        "system_prompt_addition": """You are in OVERVIEW mode. Provide high-level insights and summaries:
- Case status and progress
- Upcoming deadlines and priorities
- Recent activity summaries
- Cross-case analytics

This is a read-only mode - do not create, update, or delete data.""",
    },
    "full": {
        "tools": [],  # Empty = all tools available
        "system_prompt_addition": "",
    },
}


def get_mode_config(mode: str | None) -> dict[str, Any] | None:
    """Get the configuration for a specific mode.

    Args:
        mode: The mode name (tasks, events, people, overview, full) or None.

    Returns:
        The mode configuration dict, or None if mode is invalid.
    """
    if not mode:
        return None
    return CHAT_MODES.get(mode)


def get_mode_tools(mode: str | None) -> list[str]:
    """Get the list of allowed tools for a mode.

    Args:
        mode: The mode name or None.

    Returns:
        List of tool names. Empty list means all tools are allowed.
    """
    config = get_mode_config(mode)
    if not config:
        return []
    return config.get("tools", [])


def get_mode_system_prompt(mode: str | None) -> str:
    """Get the system prompt addition for a mode.

    Args:
        mode: The mode name or None.

    Returns:
        The system prompt addition string, or empty string if no mode.
    """
    config = get_mode_config(mode)
    if not config:
        return ""
    return config.get("system_prompt_addition", "")
