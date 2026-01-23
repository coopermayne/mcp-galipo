"""
Task MCP Tools

Tools for managing tasks/to-dos in the legal case management system.
"""

from typing import Optional
from mcp.server.fastmcp import Context
import database as db
from database import ValidationError
from tools.utils import validation_error, not_found_error, TaskStatus, Urgency


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
        """
        Add an internal task/to-do to a case - work items with self-imposed deadlines to prepare for events.

        Examples: draft complaint, prepare depo outline, review discovery, propound written discovery,
        schedule expert call. These are things YOU need to do, not things that are happening.

        Key heuristic: Task = work you need to do to get ready.

        Args:
            case_id: ID of the case
            description: What needs to be done
            due_date: Due date (YYYY-MM-DD)
            urgency: 1=Low, 2=Medium, 3=High, 4=Urgent (default 2)
            status: Task status (default Pending)
            event_id: Optional ID of event this task is linked to (for tasks that support a specific event)

        Returns the created task with ID.
        """
        context.info(f"Adding task for case {case_id}: {description[:50]}...")
        try:
            db.validate_task_status(status)
            db.validate_urgency(urgency)
            if due_date:
                db.validate_date_format(due_date, "due_date")
        except ValidationError as e:
            return validation_error(str(e))

        result = db.add_task(case_id, description, due_date, status, urgency, event_id)
        context.info(f"Task created with ID {result.get('id')}")
        return {"success": True, "task": result}

    @mcp.tool()
    def get_tasks(
        context: Context,
        case_id: Optional[int] = None,
        status_filter: Optional[TaskStatus] = None,
        urgency_filter: Optional[Urgency] = None
    ) -> dict:
        """
        Get tasks, optionally filtered by case, status, or urgency.

        Args:
            case_id: Filter by specific case
            status_filter: Filter by status
            urgency_filter: Filter by urgency level

        Returns list of tasks with case and event information.

        Examples:
            - get_tasks(status_filter="Pending", urgency_filter=4) - urgent pending tasks
            - get_tasks(case_id=5) - all tasks for case 5
        """
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
        """
        Update a task's description, status, urgency, due date, or completion date.

        Args:
            task_id: ID of the task
            description: New description - required field, cannot be empty
            status: New status
            urgency: New urgency
            due_date: New due date (YYYY-MM-DD), pass "" to clear
            completion_date: Date task was completed (YYYY-MM-DD), pass "" to clear

        Returns updated task.
        """
        context.info(f"Updating task {task_id}")

        # Build kwargs with only explicitly provided fields
        # None = not provided (don't update), "" = clear the field, other = set value
        kwargs = {}

        if description is not None:
            if description == "":
                return validation_error("Description cannot be empty")
            kwargs['description'] = description

        if status is not None:
            db.validate_task_status(status)
            kwargs['status'] = status

        if urgency is not None:
            db.validate_urgency(urgency)
            kwargs['urgency'] = urgency

        if due_date is not None:
            if due_date == "":
                kwargs['due_date'] = None  # Clear the date
            else:
                db.validate_date_format(due_date, "due_date")
                kwargs['due_date'] = due_date

        if completion_date is not None:
            if completion_date == "":
                kwargs['completion_date'] = None  # Clear the date
            else:
                db.validate_date_format(completion_date, "completion_date")
                kwargs['completion_date'] = completion_date

        if not kwargs:
            return validation_error("No fields to update")

        result = db.update_task_full(task_id, **kwargs)
        if not result:
            return not_found_error("Task not found")
        context.info(f"Task {task_id} updated successfully")
        return {"success": True, "task": result}

    @mcp.tool()
    def delete_task(context: Context, task_id: int) -> dict:
        """
        Delete a task.

        Args:
            task_id: ID of the task to delete

        Returns confirmation.
        """
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
        """
        Reorder a task and optionally change its urgency.

        Used for drag-and-drop reordering in the UI. The sort_order determines
        the position of the task in lists - lower values appear first.

        Args:
            task_id: ID of the task to reorder
            sort_order: New sort order value (lower = higher in list)
            urgency: Optional new urgency level if moving between urgency groups

        Returns the updated task.

        Example:
            reorder_task(task_id=5, sort_order=1500)  # Move task to new position
            reorder_task(task_id=5, sort_order=500, urgency=4)  # Move and change urgency
        """
        context.info(f"Reordering task {task_id} to sort_order={sort_order}")
        try:
            if urgency is not None:
                db.validate_urgency(urgency)
        except ValidationError as e:
            return validation_error(str(e))

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
        """
        Update multiple tasks to the same status at once.

        Useful for marking several tasks as Done, or changing status of multiple tasks.

        Args:
            task_ids: List of task IDs to update
            status: New status for all tasks

        Returns count of updated tasks.

        Example:
            bulk_update_tasks(task_ids=[1, 2, 3], status="Done")
        """
        context.info(f"Bulk updating {len(task_ids)} tasks to status '{status}'")
        try:
            db.validate_task_status(status)
        except ValidationError as e:
            return validation_error(str(e))

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
        """
        Update all tasks for a case to a new status.

        Useful for "mark all pending tasks on this case as done" type operations.

        Args:
            case_id: ID of the case
            new_status: New status for tasks
            current_status: Only update tasks with this current status (optional filter)

        Returns count of updated tasks.

        Examples:
            - bulk_update_case_tasks(case_id=5, new_status="Done") - mark ALL tasks done
            - bulk_update_case_tasks(case_id=5, new_status="Done", current_status="Pending") - only pending->done
        """
        context.info(f"Bulk updating tasks for case {case_id} to status '{new_status}'")
        try:
            db.validate_task_status(new_status)
            if current_status:
                db.validate_task_status(current_status)
        except ValidationError as e:
            return validation_error(str(e))

        result = db.bulk_update_tasks_for_case(case_id, new_status, current_status)
        context.info(f"Updated {result['updated']} tasks for case {case_id}")
        return {"success": True, "updated": result["updated"]}

    @mcp.tool()
    def search_tasks(
        context: Context,
        query: Optional[str] = None,
        case_id: Optional[int] = None,
        status: Optional[TaskStatus] = None,
        urgency: Optional[Urgency] = None
    ) -> dict:
        """
        Search for tasks by description, case, status, or urgency.

        Args:
            query: Search in task descriptions (partial match)
            case_id: Filter to specific case
            status: Filter by status
            urgency: Filter by urgency level

        At least one parameter must be provided.

        Examples:
            - search_tasks(query="deposition") - find tasks mentioning "deposition"
            - search_tasks(status="Blocked") - find all blocked tasks
            - search_tasks(urgency=4) - find urgent tasks
        """
        if not any([query, case_id, status, urgency]):
            return validation_error("Provide at least one search parameter")

        context.info(f"Searching tasks{' for query=' + query if query else ''}{' status=' + status if status else ''}")
        tasks = db.search_tasks(query, case_id, status, urgency)
        context.info(f"Found {len(tasks)} matching tasks")
        return {"tasks": tasks, "total": len(tasks)}
