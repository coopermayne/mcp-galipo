"""
Unified Search MCP Tool

Single search tool that replaces search_cases, search_tasks, search_events, search_persons.
Reduces tool count while maintaining full search functionality.
"""

from typing import Optional, Literal
from mcp.server.fastmcp import Context
import database as db
from database import ValidationError
from tools.utils import (
    validation_error, CaseStatus, TaskStatus, Urgency,
    invalid_status_error, invalid_urgency_error,
    CASE_STATUS_LIST, TASK_STATUS_LIST
)

SearchEntity = Literal["cases", "tasks", "events", "persons"]


def register_search_tools(mcp):
    """Register unified search MCP tool."""

    @mcp.tool()
    def search(
        context: Context,
        entity: SearchEntity,
        query: Optional[str] = None,
        case_id: Optional[int] = None,
        status: Optional[str] = None,
        urgency: Optional[Urgency] = None,
        person_type: Optional[str] = None,
        person_name: Optional[str] = None,
        case_number: Optional[str] = None,
        organization: Optional[str] = None,
        include_archived: bool = False,
        limit: int = 50
    ) -> dict:
        """Universal search across cases, tasks, events, or persons."""
        context.info(f"Searching {entity}")

        # Validate entity
        valid_entities = ["cases", "tasks", "events", "persons"]
        if entity not in valid_entities:
            return validation_error(
                f"Invalid entity: '{entity}'",
                valid_values=valid_entities,
                hint="Specify what you want to search"
            )

        # Route to appropriate search
        if entity == "cases":
            return _search_cases(context, query, case_number, person_name, status)

        elif entity == "tasks":
            return _search_tasks(context, query, case_id, status, urgency)

        elif entity == "events":
            return _search_events(context, query, case_id)

        elif entity == "persons":
            return _search_persons(context, query, person_type, organization, case_id, include_archived, limit)


def _search_cases(context: Context, query, case_number, person_name, status) -> dict:
    """Search cases."""
    if not any([query, case_number, person_name, status]):
        return validation_error(
            "No search parameters for cases",
            hint="Provide at least one of: query, case_number, person_name, status",
            example={"entity": "cases", "query": "Martinez"}
        )

    if status:
        try:
            db.validate_case_status(status)
        except ValidationError:
            return invalid_status_error(status, "case")

    cases = db.search_cases(query, case_number, person_name, status)
    context.info(f"Found {len(cases)} cases")
    return {
        "success": True,
        "entity": "cases",
        "results": cases,
        "total": len(cases)
    }


def _search_tasks(context: Context, query, case_id, status, urgency) -> dict:
    """Search tasks."""
    if not any([query, case_id, status, urgency]):
        return validation_error(
            "No search parameters for tasks",
            hint="Provide at least one of: query, case_id, status, urgency",
            example={"entity": "tasks", "status": "Pending", "urgency": 4}
        )

    if status:
        try:
            db.validate_task_status(status)
        except ValidationError:
            return invalid_status_error(status, "task")

    if urgency:
        try:
            db.validate_urgency(urgency)
        except ValidationError:
            return invalid_urgency_error(urgency)

    tasks = db.search_tasks(query, case_id, status, urgency)
    context.info(f"Found {len(tasks)} tasks")
    return {
        "success": True,
        "entity": "tasks",
        "results": tasks,
        "total": len(tasks)
    }


def _search_events(context: Context, query, case_id) -> dict:
    """Search events."""
    if not any([query, case_id]):
        return validation_error(
            "No search parameters for events",
            hint="Provide at least one of: query, case_id",
            example={"entity": "events", "query": "deposition"}
        )

    events = db.search_events(query, case_id)
    context.info(f"Found {len(events)} events")
    return {
        "success": True,
        "entity": "events",
        "results": events,
        "total": len(events)
    }


def _search_persons(context: Context, query, person_type, organization, case_id, include_archived, limit) -> dict:
    """Search persons."""
    # Persons search allows no params (returns all)
    result = db.search_persons(
        name=query,
        person_type=person_type,
        organization=organization,
        case_id=case_id,
        archived=include_archived,
        limit=limit
    )
    context.info(f"Found {result['total']} persons")
    return {
        "success": True,
        "entity": "persons",
        "results": result["persons"],
        "total": result["total"]
    }
