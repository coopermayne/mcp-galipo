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

IMPORTANT: If the user provides MULTIPLE tasks in a single message, create ALL of them by calling manage_task for EACH one in a SINGLE response (parallel tool calls). Do not ask for confirmation - just create them all at once.

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

IMPORTANT: If the user provides MULTIPLE events in a single message, create ALL of them by calling manage_event for EACH one in a SINGLE response (parallel tool calls). Do not ask for confirmation - just create them all at once.

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

When the user wants to add a person to a case, use manage_person with case_id and role to create AND assign in ONE call. Do NOT call manage_case_role separately.

Example: manage_person(action="create", name="Dr. Smith", case_id=14, role="plaintiff_expert")

Available roles (use snake_case names):
- Client side: plaintiff, contact, guardian_ad_litem, decedent
- Counsel: co_counsel, referring_attorney, opposing_counsel, criminal_defense_attorney, prosecutor, public_defender
- Defendants: individual_defendant, municipality_defendant
- Experts: plaintiff_expert, defense_expert
- Other: mediator, lien_holder, witness, claims_adjuster, special_needs_consultant

IMPORTANT: If the user provides MULTIPLE people, create ALL of them with parallel manage_person calls in a SINGLE response.

If the user mentions enough info (name + role), create immediately. Only ask clarifying questions if the role is truly ambiguous.

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
