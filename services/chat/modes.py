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
            "search",
            "get_details",
            "manage_task",
        ],
        "system_prompt_addition": """You are in TASKS mode - help the user add and manage tasks.

When the user wants to add tasks:
1. If they give you enough info (description, and optionally due date/priority), create the task(s) immediately
2. If info is missing, ask brief clarifying questions (e.g., "When is this due?" or "What priority - low, medium, high, or urgent?")
3. After creating, briefly confirm what was added

IMPORTANT: If the user provides MULTIPLE tasks in a single message, create ALL of them by calling add_task for each one. Do not ask for confirmation - just create them all.

Common task patterns:
- "Follow up with client" → ask about due date
- "File MSJ by Friday" → create with due date this Friday
- "Urgent: respond to discovery" → create with urgent priority

Keep responses brief and action-oriented.""",
    },
    "events": {
        "tools": [
            "search",
            "get_details",
            "manage_event",
        ],
        "system_prompt_addition": """You are in EVENTS mode - help the user add and manage calendar events.

When the user wants to add events:
1. If they give you enough info (description and date), create the event(s) immediately
2. If info is missing, ask brief clarifying questions (e.g., "What date?" or "What time?")
3. After creating, briefly confirm what was added

IMPORTANT: If the user provides MULTIPLE events in a single message, create ALL of them by calling add_event for each one. Do not ask for confirmation - just create them all.

Common event patterns:
- "MSJ on Friday" → Motion for Summary Judgment hearing this Friday
- "Depo next Tuesday at 10am" → Deposition on Tuesday at 10:00 AM
- "Mediation March 15" → Mediation on March 15

Keep responses brief and action-oriented.""",
    },
    "people": {
        "tools": [
            "search",
            "get_details",
            "manage_person",
            "manage_case_role",
        ],
        "system_prompt_addition": """You are in PEOPLE mode - help the user add and manage case participants.

When the user wants to add a person:
1. Ask for their role first (Attorney, Expert Witness, Client, Defendant, Judge, etc.)
2. Get their name and any contact info provided
3. Create the person and assign them to the case

Common patterns:
- "Add Dr. Smith as expert" → Create person, assign as Expert Witness
- "New defense attorney John Doe" → Create person, assign as Attorney on Defendant side
- "Add the client Maria Garcia" → Create person, assign as Client

Keep responses brief and action-oriented.""",
    },
    "overview": {
        "tools": [
            "search",
            "get_details",
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
