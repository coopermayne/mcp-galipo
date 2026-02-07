"""
Task API routes.

Handles task CRUD operations and reordering.
"""

import asyncio
from fastapi.responses import JSONResponse
from pydantic import ValidationError
import db
import auth
from schemas import CreateTaskInput, UpdateTaskInput
from .common import api_error, pydantic_error, DEFAULT_PAGE_SIZE


def register_task_routes(mcp):
    """Register task management routes."""

    @mcp.custom_route("/api/v1/tasks", methods=["GET"])
    async def api_list_tasks(request):
        """List tasks with optional filtering and pagination."""
        if err := auth.require_auth(request):
            return err
        case_id = request.query_params.get("case_id")
        status = request.query_params.get("status")
        exclude_status = request.query_params.get("exclude_status")
        urgency = request.query_params.get("urgency")
        due_date_from = request.query_params.get("due_date_from")
        due_date_to = request.query_params.get("due_date_to")
        user_id = request.query_params.get("user_id")
        limit = request.query_params.get("limit")
        offset = request.query_params.get("offset", "0")
        limit = int(limit) if limit else DEFAULT_PAGE_SIZE
        offset = int(offset)

        result = await asyncio.to_thread(
            db.get_tasks,
            case_id=int(case_id) if case_id else None,
            status_filter=status,
            exclude_status=exclude_status,
            urgency_filter=urgency,
            due_date_from=due_date_from,
            due_date_to=due_date_to,
            limit=limit,
            offset=offset,
            user_id=int(user_id) if user_id else None
        )
        return JSONResponse(result)

    @mcp.custom_route("/api/v1/tasks", methods=["POST"])
    async def api_create_task(request):
        """Create a new task."""
        if err := auth.require_auth(request):
            return err
        try:
            data = CreateTaskInput(**(await request.json()))
        except ValidationError as e:
            return pydantic_error(e)
        result = await asyncio.to_thread(
            db.add_task,
            data.case_id,
            data.description,
            data.due_date,
            data.status,
            data.urgency,
            data.event_id,
            data.assignee_id
        )
        return JSONResponse({"success": True, "task": result})

    @mcp.custom_route("/api/v1/tasks/{task_id}", methods=["PUT"])
    async def api_update_task(request):
        """Update a task."""
        if err := auth.require_auth(request):
            return err
        task_id = int(request.path_params["task_id"])
        try:
            data = UpdateTaskInput(**(await request.json()))
        except ValidationError as e:
            return pydantic_error(e)
        updates = data.model_dump(exclude_unset=True)
        result = await asyncio.to_thread(db.update_task_full, task_id, **updates)
        if not result:
            return api_error("Task not found", "NOT_FOUND", 404)
        return JSONResponse({"success": True, "task": result})

    @mcp.custom_route("/api/v1/tasks/{task_id}", methods=["DELETE"])
    async def api_delete_task(request):
        """Delete a task."""
        if err := auth.require_auth(request):
            return err
        task_id = int(request.path_params["task_id"])
        deleted = await asyncio.to_thread(db.delete_task, task_id)
        if deleted:
            return JSONResponse({"success": True})
        return api_error("Task not found", "NOT_FOUND", 404)

    @mcp.custom_route("/api/v1/tasks/reorder", methods=["POST"])
    async def api_reorder_task(request):
        """Reorder a task and optionally change its urgency."""
        if err := auth.require_auth(request):
            return err
        data = await request.json()
        task_id = data.get("task_id")
        sort_order = data.get("sort_order")
        urgency = data.get("urgency")

        if task_id is None or sort_order is None:
            return api_error("task_id and sort_order are required", "VALIDATION_ERROR", 400)

        try:
            result = await asyncio.to_thread(
                db.reorder_task,
                task_id=int(task_id),
                new_sort_order=int(sort_order),
                new_urgency=urgency
            )
            if not result:
                return api_error("Task not found", "NOT_FOUND", 404)
            return JSONResponse({"success": True, "task": result})
        except db.ValidationError as e:
            return api_error(str(e), "VALIDATION_ERROR", 400)

    @mcp.custom_route("/api/v1/tasks/reschedule-overdue", methods=["POST"])
    async def api_reschedule_overdue_tasks(request):
        """Reschedule all overdue incomplete tasks to a new date."""
        if err := auth.require_auth(request):
            return err
        data = await request.json()
        new_date = data.get("new_date")

        if not new_date:
            return api_error("new_date is required", "VALIDATION_ERROR", 400)

        try:
            result = await asyncio.to_thread(db.reschedule_overdue_tasks, new_date)
            return JSONResponse({"success": True, **result})
        except db.ValidationError as e:
            return api_error(str(e), "VALIDATION_ERROR", 400)

