"""
Task API routes.

Handles task CRUD operations and reordering.
"""

from fastapi.responses import JSONResponse
import database as db
import auth
from .common import api_error, DEFAULT_PAGE_SIZE


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
        limit = request.query_params.get("limit")
        offset = request.query_params.get("offset", "0")
        limit = int(limit) if limit else DEFAULT_PAGE_SIZE
        offset = int(offset)

        result = db.get_tasks(
            case_id=int(case_id) if case_id else None,
            status_filter=status,
            exclude_status=exclude_status,
            urgency_filter=int(urgency) if urgency else None,
            due_date_from=due_date_from,
            due_date_to=due_date_to,
            limit=limit,
            offset=offset
        )
        return JSONResponse(result)

    @mcp.custom_route("/api/v1/tasks", methods=["POST"])
    async def api_create_task(request):
        """Create a new task."""
        if err := auth.require_auth(request):
            return err
        data = await request.json()
        result = db.add_task(
            data["case_id"],
            data["description"],
            data.get("due_date"),
            data.get("status", "Pending"),
            data.get("urgency", 2),
            data.get("event_id")
        )
        return JSONResponse({"success": True, "task": result})

    @mcp.custom_route("/api/v1/tasks/{task_id}", methods=["PUT"])
    async def api_update_task(request):
        """Update a task."""
        if err := auth.require_auth(request):
            return err
        task_id = int(request.path_params["task_id"])
        data = await request.json()
        result = db.update_task_full(task_id, **data)
        if not result:
            return api_error("Task not found", "NOT_FOUND", 404)
        return JSONResponse({"success": True, "task": result})

    @mcp.custom_route("/api/v1/tasks/{task_id}", methods=["DELETE"])
    async def api_delete_task(request):
        """Delete a task."""
        if err := auth.require_auth(request):
            return err
        task_id = int(request.path_params["task_id"])
        if db.delete_task(task_id):
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
            result = db.reorder_task(
                task_id=int(task_id),
                new_sort_order=int(sort_order),
                new_urgency=int(urgency) if urgency is not None else None
            )
            if not result:
                return api_error("Task not found", "NOT_FOUND", 404)
            return JSONResponse({"success": True, "task": result})
        except db.ValidationError as e:
            return api_error(str(e), "VALIDATION_ERROR", 400)

    @mcp.custom_route("/api/v1/docket", methods=["GET"])
    async def api_get_docket(request):
        """Get all tasks in the daily docket, grouped by category."""
        if err := auth.require_auth(request):
            return err
        exclude_done = request.query_params.get("exclude_done", "true").lower() == "true"
        result = db.get_docket_tasks(exclude_done=exclude_done)
        return JSONResponse(result)

    @mcp.custom_route("/api/v1/docket/{task_id}", methods=["PUT"])
    async def api_update_docket(request):
        """Update a task's docket category and/or order."""
        if err := auth.require_auth(request):
            return err
        task_id = int(request.path_params["task_id"])
        data = await request.json()

        try:
            # Handle null/None for clearing docket_category
            docket_category = data.get("docket_category", db._NOT_PROVIDED)
            docket_order = data.get("docket_order", db._NOT_PROVIDED)

            result = db.update_docket(
                task_id=task_id,
                docket_category=docket_category,
                docket_order=int(docket_order) if docket_order is not None and docket_order is not db._NOT_PROVIDED else docket_order
            )
            if not result:
                return api_error("Task not found", "NOT_FOUND", 404)
            return JSONResponse({"success": True, "task": result})
        except ValueError as e:
            return api_error(str(e), "VALIDATION_ERROR", 400)
