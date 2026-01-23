"""
Tool executor for the chat feature.

This module executes tools by name, calling the appropriate database functions
and returning results in a format suitable for Claude's tool_result messages.
"""

import json
import logging
from typing import Any, Callable

from services.chat.types import ToolCall, ToolResult

# Import database modules
from db import (
    # Cases
    get_case_by_id,
    get_case_by_name,
    get_all_cases,
    search_cases,
    get_dashboard_stats,
    # Tasks
    get_tasks,
    add_task,
    update_task,
    search_tasks,
    # Events
    get_events,
    get_upcoming_events,
    add_event,
    get_calendar,
    # Notes
    add_note,
    get_notes,
    # Persons
    search_persons,
    get_person_by_id,
    get_case_persons,
)

logger = logging.getLogger(__name__)


# ===== CASE EXECUTORS =====

def _execute_get_case(args: dict[str, Any]) -> dict[str, Any]:
    """Get a case by ID or name."""
    case_id = args.get("case_id")
    case_name = args.get("case_name")

    if case_id:
        result = get_case_by_id(case_id)
    elif case_name:
        result = get_case_by_name(case_name)
    else:
        return {"error": "Provide either case_id or case_name"}

    if result is None:
        return {"error": "Case not found"}
    return result


def _execute_list_cases(args: dict[str, Any]) -> dict[str, Any]:
    """List all cases with optional filters."""
    return get_all_cases(
        status_filter=args.get("status_filter"),
        limit=args.get("limit"),
        offset=args.get("offset")
    )


def _execute_search_cases(args: dict[str, Any]) -> list[dict[str, Any]]:
    """Search cases by various criteria."""
    return search_cases(
        query=args.get("query"),
        case_number=args.get("case_number"),
        person_name=args.get("person_name"),
        status=args.get("status"),
        limit=args.get("limit", 50)
    )


def _execute_get_dashboard_stats(args: dict[str, Any]) -> dict[str, Any]:
    """Get dashboard statistics."""
    return get_dashboard_stats()


# ===== TASK EXECUTORS =====

def _execute_get_tasks(args: dict[str, Any]) -> dict[str, Any]:
    """Get tasks with optional filters."""
    return get_tasks(
        case_id=args.get("case_id"),
        status_filter=args.get("status_filter"),
        urgency_filter=args.get("urgency_filter"),
        limit=args.get("limit"),
        offset=args.get("offset")
    )


def _execute_create_task(args: dict[str, Any]) -> dict[str, Any]:
    """Create a new task."""
    case_id = args.get("case_id")
    description = args.get("description")

    if not case_id:
        return {"error": "case_id is required"}
    if not description:
        return {"error": "description is required"}

    return add_task(
        case_id=case_id,
        description=description,
        due_date=args.get("due_date"),
        status=args.get("status", "Pending"),
        urgency=args.get("urgency", 2)
    )


def _execute_update_task(args: dict[str, Any]) -> dict[str, Any]:
    """Update a task's status and/or urgency."""
    task_id = args.get("task_id")
    if not task_id:
        return {"error": "task_id is required"}

    result = update_task(
        task_id=task_id,
        status=args.get("status"),
        urgency=args.get("urgency")
    )

    if result is None:
        return {"error": "Task not found or no changes specified"}
    return result


def _execute_search_tasks(args: dict[str, Any]) -> list[dict[str, Any]]:
    """Search tasks by various criteria."""
    return search_tasks(
        query=args.get("query"),
        case_id=args.get("case_id"),
        status=args.get("status"),
        urgency=args.get("urgency"),
        limit=args.get("limit", 50)
    )


# ===== EVENT EXECUTORS =====

def _execute_get_events(args: dict[str, Any]) -> dict[str, Any]:
    """Get events, optionally filtered by case."""
    return get_events(case_id=args.get("case_id"))


def _execute_get_upcoming_events(args: dict[str, Any]) -> dict[str, Any]:
    """Get upcoming events."""
    return get_upcoming_events(
        limit=args.get("limit"),
        offset=args.get("offset")
    )


def _execute_create_event(args: dict[str, Any]) -> dict[str, Any]:
    """Create a new calendar event."""
    case_id = args.get("case_id")
    date = args.get("date")
    description = args.get("description")

    if not case_id:
        return {"error": "case_id is required"}
    if not date:
        return {"error": "date is required"}
    if not description:
        return {"error": "description is required"}

    return add_event(
        case_id=case_id,
        date=date,
        description=description,
        time=args.get("time"),
        location=args.get("location"),
        document_link=args.get("document_link"),
        calculation_note=args.get("calculation_note"),
        starred=args.get("starred", False)
    )


def _execute_get_calendar(args: dict[str, Any]) -> list[dict[str, Any]]:
    """Get calendar items for the next N days."""
    return get_calendar(
        days=args.get("days", 30),
        include_tasks=args.get("include_tasks", True),
        include_events=args.get("include_events", True)
    )


# ===== NOTE EXECUTORS =====

def _execute_add_note(args: dict[str, Any]) -> dict[str, Any]:
    """Add a note to a case."""
    case_id = args.get("case_id")
    content = args.get("content")

    if not case_id:
        return {"error": "case_id is required"}
    if not content:
        return {"error": "content is required"}

    return add_note(case_id=case_id, content=content)


def _execute_get_notes(args: dict[str, Any]) -> dict[str, Any]:
    """Get notes, optionally filtered by case."""
    return get_notes(case_id=args.get("case_id"))


# ===== PERSON EXECUTORS =====

def _execute_search_persons(args: dict[str, Any]) -> dict[str, Any]:
    """Search for persons by various criteria."""
    return search_persons(
        name=args.get("name"),
        person_type=args.get("person_type"),
        organization=args.get("organization"),
        email=args.get("email"),
        phone=args.get("phone"),
        case_id=args.get("case_id"),
        archived=args.get("archived", False),
        limit=args.get("limit", 50)
    )


def _execute_get_person(args: dict[str, Any]) -> dict[str, Any]:
    """Get a person by ID."""
    person_id = args.get("person_id")
    if not person_id:
        return {"error": "person_id is required"}

    result = get_person_by_id(person_id)
    if result is None:
        return {"error": "Person not found"}
    return result


def _execute_get_case_persons(args: dict[str, Any]) -> list[dict[str, Any]]:
    """Get all persons assigned to a case."""
    case_id = args.get("case_id")
    if not case_id:
        return {"error": "case_id is required"}

    return get_case_persons(
        case_id=case_id,
        person_type=args.get("person_type"),
        role=args.get("role"),
        side=args.get("side")
    )


# ===== TOOL REGISTRY =====

TOOL_REGISTRY: dict[str, Callable[[dict[str, Any]], Any]] = {
    # Cases
    "get_case": _execute_get_case,
    "list_cases": _execute_list_cases,
    "search_cases": _execute_search_cases,
    "get_dashboard_stats": _execute_get_dashboard_stats,
    # Tasks
    "get_tasks": _execute_get_tasks,
    "create_task": _execute_create_task,
    "update_task": _execute_update_task,
    "search_tasks": _execute_search_tasks,
    # Events
    "get_events": _execute_get_events,
    "get_upcoming_events": _execute_get_upcoming_events,
    "create_event": _execute_create_event,
    "get_calendar": _execute_get_calendar,
    # Notes
    "add_note": _execute_add_note,
    "get_notes": _execute_get_notes,
    # Persons
    "search_persons": _execute_search_persons,
    "get_person": _execute_get_person,
    "get_case_persons": _execute_get_case_persons,
}


def execute_tool(tool_call: ToolCall) -> ToolResult:
    """Execute a tool and return the result.

    Args:
        tool_call: The tool call to execute, containing name, id, and arguments.

    Returns:
        ToolResult with the execution result or error message.
    """
    logger.info(f"Executing tool: {tool_call.name} with args: {tool_call.arguments}")

    try:
        # Check if tool exists
        if tool_call.name not in TOOL_REGISTRY:
            logger.warning(f"Unknown tool requested: {tool_call.name}")
            return ToolResult(
                tool_use_id=tool_call.id,
                content=f"Unknown tool: {tool_call.name}",
                is_error=True
            )

        # Execute the tool
        executor = TOOL_REGISTRY[tool_call.name]
        result = executor(tool_call.arguments)

        # Serialize the result to JSON
        content = json.dumps(result, default=str)

        logger.info(f"Tool {tool_call.name} executed successfully")
        return ToolResult(
            tool_use_id=tool_call.id,
            content=content,
            is_error=False
        )

    except Exception as e:
        logger.exception(f"Error executing tool {tool_call.name}: {e}")
        return ToolResult(
            tool_use_id=tool_call.id,
            content=f"Error executing {tool_call.name}: {str(e)}",
            is_error=True
        )


def get_available_tools() -> list[str]:
    """Get list of all available tool names.

    Returns:
        List of tool name strings.
    """
    return list(TOOL_REGISTRY.keys())
