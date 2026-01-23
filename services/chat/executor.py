"""
Tool executor for the chat feature.

This module executes tools by name, calling the appropriate database functions
and returning results in a format suitable for Claude's tool_result messages.
"""

import json
import logging
import time
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

# Maximum characters for result content before truncation
MAX_RESULT_CHARS = 4000


def _truncate_result(result: Any, tool_name: str) -> tuple[str, bool]:
    """Truncate large results intelligently.

    Args:
        result: The result to potentially truncate
        tool_name: Name of the tool (for context-aware truncation)

    Returns:
        Tuple of (json_string, was_truncated)
    """
    json_str = json.dumps(result, default=str)

    if len(json_str) <= MAX_RESULT_CHARS:
        return json_str, False

    # Handle list results - show first N items + count of remaining
    if isinstance(result, list):
        total_count = len(result)
        # Try progressively smaller slices until we fit
        for take in [10, 5, 3, 1]:
            truncated = result[:take]
            truncated_json = json.dumps({
                "items": truncated,
                "truncated": True,
                "showing": take,
                "total": total_count,
                "note": f"Showing first {take} of {total_count} items"
            }, default=str)
            if len(truncated_json) <= MAX_RESULT_CHARS:
                return truncated_json, True
        # If even 1 item is too large, just return metadata
        return json.dumps({
            "truncated": True,
            "total": total_count,
            "note": f"Result too large. Contains {total_count} items."
        }), True

    # Handle dict results with 'items' or 'data' list
    if isinstance(result, dict):
        for key in ['items', 'data', 'cases', 'tasks', 'events', 'notes', 'persons']:
            if key in result and isinstance(result[key], list):
                total_count = len(result[key])
                for take in [10, 5, 3, 1]:
                    truncated_result = {**result, key: result[key][:take]}
                    truncated_result['truncated'] = True
                    truncated_result['showing'] = take
                    truncated_result['total_items'] = total_count
                    truncated_json = json.dumps(truncated_result, default=str)
                    if len(truncated_json) <= MAX_RESULT_CHARS:
                        return truncated_json, True

    # Fallback: simple character truncation
    truncated_json = json_str[:MAX_RESULT_CHARS - 100]
    return json.dumps({
        "partial_result": truncated_json,
        "truncated": True,
        "note": "Result truncated due to size"
    }), True


def _generate_summary(result: Any, tool_name: str, args: dict[str, Any]) -> str:
    """Generate a human-readable summary of the tool result.

    Args:
        result: The tool execution result
        tool_name: Name of the tool that was executed
        args: Arguments passed to the tool

    Returns:
        Human-readable summary string
    """
    # Handle errors
    if isinstance(result, dict) and 'error' in result:
        return f"Error: {result['error']}"

    # Case-related summaries
    if tool_name == "get_case":
        if isinstance(result, dict) and 'case_name' in result:
            return f"Retrieved case: {result['case_name']}"
        return "Case not found"

    if tool_name == "list_cases":
        if isinstance(result, dict) and 'cases' in result:
            count = len(result['cases'])
            total = result.get('total', count)
            return f"Listed {count} cases (total: {total})"
        return "Listed cases"

    if tool_name == "search_cases":
        if isinstance(result, list):
            count = len(result)
            query = args.get('query', args.get('person_name', ''))
            if query:
                return f"Found {count} cases matching '{query}'"
            return f"Found {count} cases"
        return "Searched cases"

    if tool_name == "get_dashboard_stats":
        return "Retrieved dashboard statistics"

    # Task-related summaries
    if tool_name == "get_tasks":
        if isinstance(result, dict) and 'tasks' in result:
            count = len(result['tasks'])
            case_id = args.get('case_id')
            if case_id:
                return f"Found {count} tasks for case #{case_id}"
            return f"Found {count} tasks"
        return "Retrieved tasks"

    if tool_name == "create_task":
        if isinstance(result, dict) and 'description' in result:
            desc = result['description'][:50]
            due = result.get('due_date', '')
            if due:
                return f"Created task: {desc}... (due {due})"
            return f"Created task: {desc}..."
        return "Created task"

    if tool_name == "update_task":
        if isinstance(result, dict) and 'id' in result:
            status = result.get('status', '')
            return f"Updated task #{result['id']} (status: {status})"
        return "Updated task"

    if tool_name == "search_tasks":
        if isinstance(result, list):
            count = len(result)
            query = args.get('query', '')
            if query:
                return f"Found {count} tasks matching '{query}'"
            return f"Found {count} tasks"
        return "Searched tasks"

    # Event-related summaries
    if tool_name == "get_events":
        if isinstance(result, dict) and 'events' in result:
            count = len(result['events'])
            return f"Found {count} events"
        return "Retrieved events"

    if tool_name == "get_upcoming_events":
        if isinstance(result, dict) and 'events' in result:
            count = len(result['events'])
            return f"Found {count} upcoming events"
        return "Retrieved upcoming events"

    if tool_name == "create_event":
        if isinstance(result, dict) and 'description' in result:
            desc = result['description'][:50]
            date = result.get('date', '')
            return f"Created event: {desc}... on {date}"
        return "Created event"

    if tool_name == "get_calendar":
        if isinstance(result, list):
            count = len(result)
            days = args.get('days', 30)
            return f"Found {count} calendar items for next {days} days"
        return "Retrieved calendar"

    # Note-related summaries
    if tool_name == "add_note":
        if isinstance(result, dict) and 'content' in result:
            content = result['content'][:50]
            return f"Added note: {content}..."
        return "Added note"

    if tool_name == "get_notes":
        if isinstance(result, dict) and 'notes' in result:
            count = len(result['notes'])
            return f"Found {count} notes"
        return "Retrieved notes"

    # Person-related summaries
    if tool_name == "search_persons":
        if isinstance(result, dict) and 'persons' in result:
            count = len(result['persons'])
            name = args.get('name', '')
            if name:
                return f"Found {count} persons named '{name}'"
            return f"Found {count} persons"
        return "Searched persons"

    if tool_name == "get_person":
        if isinstance(result, dict) and 'name' in result:
            return f"Retrieved person: {result['name']}"
        return "Person not found"

    if tool_name == "get_case_persons":
        if isinstance(result, list):
            count = len(result)
            return f"Found {count} persons for case"
        return "Retrieved case persons"

    # Generic fallback
    if isinstance(result, list):
        return f"Retrieved {len(result)} items"
    if isinstance(result, dict):
        return "Retrieved data"
    return "Operation completed"


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

    start_time = time.time()

    try:
        # Check if tool exists
        if tool_call.name not in TOOL_REGISTRY:
            duration_ms = int((time.time() - start_time) * 1000)
            logger.warning(f"Unknown tool requested: {tool_call.name}")
            return ToolResult(
                tool_use_id=tool_call.id,
                content=f"Unknown tool: {tool_call.name}",
                is_error=True,
                duration_ms=duration_ms,
                summary=f"Error: Unknown tool '{tool_call.name}'"
            )

        # Execute the tool
        executor = TOOL_REGISTRY[tool_call.name]
        result = executor(tool_call.arguments)

        duration_ms = int((time.time() - start_time) * 1000)

        # Generate human-readable summary
        summary = _generate_summary(result, tool_call.name, tool_call.arguments)

        # Truncate large results intelligently
        content, was_truncated = _truncate_result(result, tool_call.name)

        if was_truncated:
            logger.info(f"Tool {tool_call.name} result truncated (original too large)")
            summary += " (truncated)"

        logger.info(f"Tool {tool_call.name} executed in {duration_ms}ms: {summary}")
        return ToolResult(
            tool_use_id=tool_call.id,
            content=content,
            is_error=False,
            duration_ms=duration_ms,
            summary=summary
        )

    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        logger.exception(f"Error executing tool {tool_call.name}: {e}")
        return ToolResult(
            tool_use_id=tool_call.id,
            content=f"Error executing {tool_call.name}: {str(e)}",
            is_error=True,
            duration_ms=duration_ms,
            summary=f"Error: {str(e)}"
        )


def get_available_tools() -> list[str]:
    """Get list of all available tool names.

    Returns:
        List of tool name strings.
    """
    return list(TOOL_REGISTRY.keys())
