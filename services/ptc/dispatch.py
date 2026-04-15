"""
PTC tool dispatcher.

Maps tool_use blocks from the Anthropic API to db/ function calls.
Auth (user_id) is injected server-side — Claude never sees it.
"""

import json
import logging
from typing import Any

import db

logger = logging.getLogger(__name__)


def dispatch_tool(name: str, arguments: dict, user_id: int | None = None) -> str:
    """Execute a tool and return the JSON-serialized result.

    Args:
        name: Tool name from the tool_use block.
        arguments: Tool input arguments.
        user_id: Authenticated user ID (injected server-side).

    Returns:
        JSON string of the result (for use as tool_result content).
    """
    handler = _HANDLERS.get(name)
    if not handler:
        return json.dumps({"error": f"Unknown tool: {name}"}, default=str)

    try:
        result = handler(arguments, user_id)
        return json.dumps(result, default=str)
    except Exception as e:
        logger.exception("Tool dispatch error for %s: %s", name, e)
        return json.dumps({"error": str(e)}, default=str)


# ---------------------------------------------------------------------------
# Tool handlers
# ---------------------------------------------------------------------------


def _search_cases(args: dict, user_id: int | None) -> Any:
    return db.search_cases(
        query=args.get("query"),
        status=args.get("status"),
        person_name=args.get("person_name"),
        case_number=args.get("case_number"),
        limit=args.get("limit", 50),
        user_id=user_id,
    )


def _get_case_detail(args: dict, user_id: int | None) -> Any:
    case_id = args["case_id"]
    result = db.get_case_by_id(case_id)
    if result is None:
        return {"error": f"Case {case_id} not found"}
    return result


def _search_tasks(args: dict, user_id: int | None) -> Any:
    return db.search_tasks(
        query=args.get("query"),
        case_id=args.get("case_id"),
        status=args.get("status"),
        urgency=args.get("urgency"),
        assignee_id=args.get("assignee_id"),
        due_date_before=args.get("due_date_before"),
        due_date_after=args.get("due_date_after"),
        limit=args.get("limit", 50),
        user_id=user_id,
    )


def _search_events(args: dict, user_id: int | None) -> Any:
    return db.search_events(
        query=args.get("query"),
        case_id=args.get("case_id"),
        date_before=args.get("date_before"),
        date_after=args.get("date_after"),
        limit=args.get("limit", 50),
        user_id=user_id,
    )


def _search_persons(args: dict, user_id: int | None) -> Any:
    case_id = args.get("case_id")
    if case_id:
        # Case-scoped: returns richer assignment data
        role_id = None
        role_name = args.get("role_name")
        if role_name:
            role = db.get_role_by_name(role_name)
            if role:
                role_id = role["id"]
        return db.get_case_persons(
            case_id=case_id,
            role_id=role_id,
            category=args.get("category"),
        )
    # Global search
    role_id = None
    role_name = args.get("role_name")
    if role_name:
        role = db.get_role_by_name(role_name)
        if role:
            role_id = role["id"]
    return db.search_persons(
        name=args.get("name"),
        role_id=role_id,
        category=args.get("category"),
        organization=args.get("organization"),
        limit=args.get("limit", 50),
        user_id=user_id,
    )


def _create_task(args: dict, user_id: int | None) -> Any:
    return db.add_task(
        case_id=args["case_id"],
        description=args["description"],
        due_date=args.get("due_date"),
        status=args.get("status", "Pending"),
        urgency=args.get("urgency", "Medium"),
        assignee_id=args.get("assignee_id"),
    )


def _create_event(args: dict, user_id: int | None) -> Any:
    return db.add_event(
        case_id=args["case_id"],
        date=args["date"],
        description=args["description"],
        time=args.get("time"),
        location=args.get("location"),
        starred=args.get("starred", False),
    )


def _update_task(args: dict, user_id: int | None) -> Any:
    task_id = args["task_id"]
    kwargs = {}
    for key in ("description", "due_date", "status", "urgency", "assignee_id", "completion_date"):
        if key in args:
            kwargs[key] = args[key]
    result = db.update_task_full(task_id, **kwargs)
    if result is None:
        return {"error": f"Task {task_id} not found or no changes"}
    return result


# ---------------------------------------------------------------------------
# Dispatch table
# ---------------------------------------------------------------------------

_HANDLERS: dict[str, Any] = {
    "search_cases": _search_cases,
    "get_case_detail": _get_case_detail,
    "search_tasks": _search_tasks,
    "search_events": _search_events,
    "search_persons": _search_persons,
    "create_task": _create_task,
    "create_event": _create_event,
    "update_task": _update_task,
}
