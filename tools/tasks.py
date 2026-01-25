"""
Task MCP Tools

Tools for managing tasks/to-dos in the legal case management system.
"""

from typing import Optional
from mcp.server.fastmcp import Context
import database as db
from database import ValidationError
from tools.utils import (
    validation_error, not_found_error, TaskStatus, Urgency,
    invalid_status_error, invalid_urgency_error, invalid_date_format_error,
    check_empty_required_field, task_event_confusion_hint
)


def register_task_tools(mcp):
    """Register task-related MCP tools."""

    @mcp.tool()
    def add_task(
        context: Context,
        case_id: int,
        description: str,
        due_date: Optional[str] = None,
        urgency: Urgency = 2,
        status: TaskStatus = "Pending",
        event_id: Optional[int] = None
    ) -> dict:
        """Add an internal task/to-do to a case."""
        context.info(f"Adding task for case {case_id}: {description[:50]}...")

        try:
            db.validate_task_status(status)
        except ValidationError:
            return invalid_status_error(status, "task")

        try:
            db.validate_urgency(urgency)
        except ValidationError:
            return invalid_urgency_error(urgency)

        if due_date:
            try:
                db.validate_date_format(due_date, "due_date")
            except ValidationError:
                return invalid_date_format_error(due_date, "due_date")

        result = db.add_task(case_id, description, due_date, status, urgency, event_id)
        if not result:
            return not_found_error("Case", hint=task_event_confusion_hint())

        context.info(f"Task created with ID {result.get('id')}")
        return {"success": True, "task": result}

    @mcp.tool()
    def get_tasks(
        context: Context,
        case_id: Optional[int] = None,
        status_filter: Optional[TaskStatus] = None,
        urgency_filter: Optional[Urgency] = None
    ) -> dict:
        """Get tasks, optionally filtered by case, status, or urgency."""
        context.info(f"Fetching tasks{' for case ' + str(case_id) if case_id else ''}")
        result = db.get_tasks(case_id, status_filter, urgency_filter)
        context.info(f"Found {result['total']} tasks")
        return {"tasks": result["tasks"], "total": result["total"]}

    @mcp.tool()
    def update_task(
        context: Context,
        task_id: int,
        description: Optional[str] = None,
        status: Optional[TaskStatus] = None,
        urgency: Optional[Urgency] = None,
        due_date: Optional[str] = None,
        completion_date: Optional[str] = None
    ) -> dict:
        """Update a task's description, status, urgency, due date, or completion date."""
        context.info(f"Updating task {task_id}")

        # Build kwargs with only explicitly provided fields
        # None = not provided (don't update), "" = clear the field, other = set value
        kwargs = {}

        if description is not None:
            error = check_empty_required_field(description, "description")
            if error:
                return error
            kwargs['description'] = description

        if status is not None:
            try:
                db.validate_task_status(status)
            except ValidationError:
                return invalid_status_error(status, "task")
            kwargs['status'] = status

        if urgency is not None:
            try:
                db.validate_urgency(urgency)
            except ValidationError:
                return invalid_urgency_error(urgency)
            kwargs['urgency'] = urgency

        if due_date is not None:
            if due_date == "":
                kwargs['due_date'] = None  # Clear the date
            else:
                try:
                    db.validate_date_format(due_date, "due_date")
                except ValidationError:
                    return invalid_date_format_error(due_date, "due_date")
                kwargs['due_date'] = due_date

        if completion_date is not None:
            if completion_date == "":
                kwargs['completion_date'] = None  # Clear the date
            else:
                try:
                    db.validate_date_format(completion_date, "completion_date")
                except ValidationError:
                    return invalid_date_format_error(completion_date, "completion_date")
                kwargs['completion_date'] = completion_date

        if not kwargs:
            return validation_error(
                "No fields to update",
                hint="Provide at least one field to update: description, status, urgency, due_date, or completion_date. Pass \"\" to clear optional date fields."
            )

        result = db.update_task_full(task_id, **kwargs)
        if not result:
            return not_found_error("Task")
        context.info(f"Task {task_id} updated successfully")
        return {"success": True, "task": result}

    @mcp.tool()
    def delete_task(context: Context, task_id: int) -> dict:
        """Delete a task."""
        context.info(f"Deleting task {task_id}")
        if db.delete_task(task_id):
            context.info(f"Task {task_id} deleted successfully")
            return {"success": True, "message": "Task deleted"}
        return not_found_error("Task")

    @mcp.tool()
    def reorder_task(
        context: Context,
        task_id: int,
        sort_order: int,
        urgency: Optional[Urgency] = None
    ) -> dict:
        """Reorder a task and optionally change its urgency."""
        context.info(f"Reordering task {task_id} to sort_order={sort_order}")

        if urgency is not None:
            try:
                db.validate_urgency(urgency)
            except ValidationError:
                return invalid_urgency_error(urgency)

        result = db.reorder_task(task_id, sort_order, urgency)
        if not result:
            return not_found_error("Task")
        context.info(f"Task {task_id} reordered successfully")
        return {"success": True, "task": result}

    @mcp.tool()
    def bulk_update_tasks(
        context: Context,
        task_ids: list,
        status: TaskStatus
    ) -> dict:
        """Update multiple tasks to the same status at once."""
        context.info(f"Bulk updating {len(task_ids)} tasks to status '{status}'")

        try:
            db.validate_task_status(status)
        except ValidationError:
            return invalid_status_error(status, "task")

        result = db.bulk_update_tasks(task_ids, status)
        context.info(f"Updated {result['updated']} tasks")
        return {"success": True, "updated": result["updated"]}

    @mcp.tool()
    def bulk_update_case_tasks(
        context: Context,
        case_id: int,
        new_status: TaskStatus,
        current_status: Optional[TaskStatus] = None
    ) -> dict:
        """Update all tasks for a case to a new status."""
        context.info(f"Bulk updating tasks for case {case_id} to status '{new_status}'")

        try:
            db.validate_task_status(new_status)
        except ValidationError:
            return invalid_status_error(new_status, "task")

        if current_status:
            try:
                db.validate_task_status(current_status)
            except ValidationError:
                return invalid_status_error(current_status, "task")

        result = db.bulk_update_tasks_for_case(case_id, new_status, current_status)
        context.info(f"Updated {result['updated']} tasks for case {case_id}")
        return {"success": True, "updated": result["updated"]}
