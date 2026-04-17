"""
PTC tool dispatcher.

Maps tool_use blocks from the Anthropic API to db/ function calls.
Auth (user_id) is injected server-side — Claude never sees it.
"""

import datetime
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


def _delete_task(args: dict, user_id: int | None) -> Any:
    task_id = args["task_id"]
    ok = db.delete_task(task_id)
    if not ok:
        return {"error": f"Task {task_id} not found"}
    return {"deleted": True, "task_id": task_id}


def _bulk_update_tasks(args: dict, user_id: int | None) -> Any:
    status = args["status"]
    task_ids = args.get("task_ids")
    case_id = args.get("case_id")

    if task_ids:
        return db.bulk_update_tasks(task_ids, status)
    elif case_id:
        return db.bulk_update_tasks_for_case(
            case_id, status, current_status=args.get("current_status"),
        )
    else:
        return {"error": "Provide either task_ids or case_id"}


def _update_event(args: dict, user_id: int | None) -> Any:
    event_id = args["event_id"]
    kwargs = {}
    for key in ("date", "description", "time", "location", "starred"):
        if key in args:
            kwargs[key] = args[key]
    result = db.update_event_full(event_id, **kwargs)
    if result is None:
        return {"error": f"Event {event_id} not found or no changes"}
    return result


def _delete_event(args: dict, user_id: int | None) -> Any:
    event_id = args["event_id"]
    ok = db.delete_event(event_id)
    if not ok:
        return {"error": f"Event {event_id} not found"}
    return {"deleted": True, "event_id": event_id}



def _update_case(args: dict, user_id: int | None) -> Any:
    case_id = args["case_id"]
    kwargs = {}
    for key in (
        "case_name", "short_name", "status", "case_summary", "result",
        "date_of_injury", "trial_date", "claim_deadline",
        "complaint_deadline",
    ):
        if key in args:
            kwargs[key] = args[key]
    result = db.update_case(case_id, **kwargs)
    if result is None:
        return {"error": f"Case {case_id} not found"}
    return result


def _create_case(args: dict, user_id: int | None) -> Any:
    kwargs = {}
    for key in ("case_name", "short_name", "status", "case_summary", "date_of_injury"):
        if key in args:
            kwargs[key] = args[key]
    return db.create_case(**kwargs)


def _delete_case(args: dict, user_id: int | None) -> Any:
    case_id = args["case_id"]
    if db.delete_case(case_id):
        return {"deleted": True, "case_id": case_id}
    return {"error": f"Case {case_id} not found"}


def _assign_attorney(args: dict, user_id: int | None) -> Any:
    return db.assign_attorney_to_case(args["case_id"], args["user_id"])


def _remove_attorney(args: dict, user_id: int | None) -> Any:
    return db.remove_attorney_from_case(args["case_id"], args["user_id"])


def _assign_paralegal(args: dict, user_id: int | None) -> Any:
    return db.assign_paralegal_to_case(args["case_id"], args["user_id"])


def _remove_paralegal(args: dict, user_id: int | None) -> Any:
    return db.remove_paralegal_from_case(args["case_id"], args["user_id"])


# ---------------------------------------------------------------------------
# Persons & roles
# ---------------------------------------------------------------------------


def _list_staff(args: dict, user_id: int | None) -> Any:
    return db.get_all_users()


def _list_roles(args: dict, user_id: int | None) -> Any:
    return db.get_roles()


def _create_person(args: dict, user_id: int | None) -> Any:
    return db.create_person(
        name=args["name"],
        phones=args.get("phones"),
        emails=args.get("emails"),
        organization=args.get("organization"),
        notes=args.get("notes"),
    )


def _update_person(args: dict, user_id: int | None) -> Any:
    person_id = args["person_id"]
    kwargs = {}
    for key in ("name", "phones", "emails", "organization", "notes"):
        if key in args:
            kwargs[key] = args[key]
    result = db.update_person(person_id, **kwargs)
    if result is None:
        return {"error": f"Person {person_id} not found"}
    return result


def _delete_person(args: dict, user_id: int | None) -> Any:
    person_id = args["person_id"]
    if db.delete_person(person_id):
        return {"deleted": True, "person_id": person_id}
    return {"error": f"Person {person_id} not found"}


def _assign_person_to_case(args: dict, user_id: int | None) -> Any:
    return db.assign_person_to_case(
        person_id=args["person_id"],
        case_id=args["case_id"],
        role_id=args["role_id"],
        notes=args.get("notes"),
        attributes=args.get("attributes"),
    )


def _remove_person_from_case(args: dict, user_id: int | None) -> Any:
    if db.remove_person_from_case(case_id=args["case_id"], person_id=args["person_id"]):
        return {"removed": True}
    return {"error": "Assignment not found"}


def _change_person_role(args: dict, user_id: int | None) -> Any:
    result = db.change_person_role_on_case(
        case_id=args["case_id"],
        person_id=args["person_id"],
        new_role_id=args["new_role_id"],
    )
    if result is None:
        return {"error": "Assignment not found or no changes"}
    return result


# ---------------------------------------------------------------------------
# Proceedings & judges
# ---------------------------------------------------------------------------


def _list_jurisdictions(args: dict, user_id: int | None) -> Any:
    return db.get_jurisdictions()


def _create_proceeding(args: dict, user_id: int | None) -> Any:
    return db.add_proceeding(
        case_id=args["case_id"],
        case_number=args["case_number"],
        jurisdiction_id=args.get("jurisdiction_id"),
    )


def _update_proceeding(args: dict, user_id: int | None) -> Any:
    proceeding_id = args["proceeding_id"]
    kwargs = {}
    for key in ("case_number", "jurisdiction_id", "notes", "is_primary"):
        if key in args:
            kwargs[key] = args[key]
    result = db.update_proceeding(proceeding_id, **kwargs)
    if result is None:
        return {"error": f"Proceeding {proceeding_id} not found"}
    return result


def _delete_proceeding(args: dict, user_id: int | None) -> Any:
    proceeding_id = args["proceeding_id"]
    if db.delete_proceeding(proceeding_id):
        return {"deleted": True, "proceeding_id": proceeding_id}
    return {"error": f"Proceeding {proceeding_id} not found"}


def _create_judge(args: dict, user_id: int | None) -> Any:
    return db.create_judge(
        name=args["name"],
        title=args.get("title"),
        jurisdiction_id=args.get("jurisdiction_id"),
    )


def _update_judge(args: dict, user_id: int | None) -> Any:
    judge_id = args["judge_id"]
    kwargs = {}
    for key in ("name", "title", "jurisdiction_id"):
        if key in args:
            kwargs[key] = args[key]
    result = db.update_judge(judge_id, **kwargs)
    if result is None:
        return {"error": f"Judge {judge_id} not found"}
    return result


def _delete_judge(args: dict, user_id: int | None) -> Any:
    judge_id = args["judge_id"]
    result = db.delete_judge(judge_id)
    if not result.get("success"):
        return {"error": result.get("error", f"Judge {judge_id} not found")}
    return {"deleted": True, "judge_id": judge_id}


def _search_judges(args: dict, user_id: int | None) -> Any:
    return db.search_judges(
        name=args.get("query"),
        jurisdiction_id=args.get("jurisdiction_id"),
    )


def _add_judge_to_proceeding(args: dict, user_id: int | None) -> Any:
    return db.add_judge_to_proceeding(
        proceeding_id=args["proceeding_id"],
        judge_id=args["judge_id"],
        role=args.get("role", "Judge"),
    )


def _remove_judge_from_proceeding(args: dict, user_id: int | None) -> Any:
    if db.remove_judge_from_proceeding(
        proceeding_id=args["proceeding_id"],
        judge_id=args["judge_id"],
    ):
        return {"removed": True}
    return {"error": f"Judge {args['judge_id']} not linked to proceeding {args['proceeding_id']}"}


# ---------------------------------------------------------------------------
# System
# ---------------------------------------------------------------------------


def _get_current_time(args: dict, user_id: int | None) -> Any:
    pacific = datetime.timezone(datetime.timedelta(hours=-7))
    now = datetime.datetime.now(pacific)
    return {
        "datetime": now.isoformat(),
        "date": now.strftime("%Y-%m-%d"),
        "time": now.strftime("%H:%M"),
        "day_of_week": now.strftime("%A"),
    }


# ---------------------------------------------------------------------------
# Dispatch table
# ---------------------------------------------------------------------------

_HANDLERS: dict[str, Any] = {
    # Search / read
    "search_cases": _search_cases,
    "get_case_detail": _get_case_detail,
    "search_tasks": _search_tasks,
    "search_events": _search_events,
    "search_persons": _search_persons,
    "search_judges": _search_judges,
    # Tasks
    "create_task": _create_task,
    "update_task": _update_task,
    "delete_task": _delete_task,
    "bulk_update_tasks": _bulk_update_tasks,
    # Events
    "create_event": _create_event,
    "update_event": _update_event,
    "delete_event": _delete_event,
    # Cases
    "create_case": _create_case,
    "update_case": _update_case,
    "delete_case": _delete_case,
    "assign_attorney": _assign_attorney,
    "remove_attorney": _remove_attorney,
    "assign_paralegal": _assign_paralegal,
    "remove_paralegal": _remove_paralegal,
    # Persons & roles
    "list_staff": _list_staff,
    "list_roles": _list_roles,
    "create_person": _create_person,
    "update_person": _update_person,
    "delete_person": _delete_person,
    "assign_person_to_case": _assign_person_to_case,
    "remove_person_from_case": _remove_person_from_case,
    "change_person_role": _change_person_role,
    # Proceedings & judges
    "list_jurisdictions": _list_jurisdictions,
    "create_proceeding": _create_proceeding,
    "update_proceeding": _update_proceeding,
    "delete_proceeding": _delete_proceeding,
    "create_judge": _create_judge,
    "update_judge": _update_judge,
    "delete_judge": _delete_judge,
    "add_judge_to_proceeding": _add_judge_to_proceeding,
    "remove_judge_from_proceeding": _remove_judge_from_proceeding,
    # System
    "get_current_time": _get_current_time,
}
