"""
Task API routes.

Handles task CRUD operations and reordering.
"""

import asyncio
from fastapi.responses import JSONResponse
from pydantic import ValidationError
import db
import auth
from db.comments import add_comment as add_entity_comment
from schemas import CreateTaskInput, UpdateTaskInput
from .common import api_error, pydantic_error, clamp_pagination, feature_disabled_error
from .comments import _get_db_user_id
from .sse import broadcast


def register_task_routes(mcp):
    """Register task management routes."""

    @mcp.custom_route("/api/v1/tasks", methods=["GET"])
    async def api_list_tasks(request):
        """List tasks with optional filtering and pagination."""
        if err := auth.require_auth(request):
            return err
        case_id = request.query_params.get("case_id")
        intake_id = request.query_params.get("intake_id")
        status = request.query_params.get("status")
        exclude_status = request.query_params.get("exclude_status")
        urgency = request.query_params.get("urgency")
        due_date_from = request.query_params.get("due_date_from")
        due_date_to = request.query_params.get("due_date_to")
        user_id = request.query_params.get("user_id")
        assignee_id = request.query_params.get("assignee_id")
        event_id = request.query_params.get("event_id")
        limit, offset = clamp_pagination(request)

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
            user_id=int(user_id) if user_id else None,
            assignee_id=int(assignee_id) if assignee_id else None,
            intake_id=int(intake_id) if intake_id else None,
            event_id=int(event_id) if event_id else None,
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
        try:
            result = await asyncio.to_thread(
                db.add_task,
                data.case_id,
                data.description,
                data.due_date,
                data.status,
                data.urgency,
                data.event_id,
                data.assignee_id,
                data.completion_date,
                data.intake_id,
            )
        except db.FeatureDisabled as e:
            return feature_disabled_error(e)

        # System comments for task creation
        user = auth.get_current_user(request)
        user_id = _get_db_user_id(user)
        task_id = result.get("id")
        if user:
            name = f"{user['firstName']} {user['lastName']}"
            desc = data.description[:80] + ("..." if len(data.description) > 80 else "")
            if task_id:
                await asyncio.to_thread(
                    add_entity_comment, "task", task_id, user_id,
                    f'{name} created this task', True,
                )
                broadcast({
                    "entity": "comment",
                    "action": "created",
                    "id": None,
                    "entity_type": "task",
                    "entity_id": task_id,
                    "user_id": user_id,
                })
            if data.case_id:
                await asyncio.to_thread(
                    db.add_case_comment, data.case_id, user_id,
                    f'{name} added task: "{desc}"', True,
                )

        broadcast({"entity": "task", "action": "created", "id": task_id, "case_id": data.case_id})
        return JSONResponse({"success": True, "task": result})

    # NOTE: must be registered before "/api/v1/tasks/{task_id}" (GET) or it'd be
    # shadowed by the param route ("search" parsed as task_id).
    @mcp.custom_route("/api/v1/tasks/search", methods=["GET"])
    async def api_search_tasks(request):
        """Text-search tasks by description or case name (global quick search)."""
        if err := auth.require_auth(request):
            return err
        q = request.query_params.get("q", "").strip()
        if len(q) < 2:
            return JSONResponse({"tasks": [], "total": 0})
        my_tasks = request.query_params.get("my_tasks", "false").lower() == "true"
        limit = int(request.query_params.get("limit", "15"))
        user = auth.get_current_user(request)
        user_id = user["id"] if (my_tasks and user) else None
        results = await asyncio.to_thread(
            db.search_tasks, query=q, user_id=user_id, limit=limit,
        )
        return JSONResponse({"tasks": results, "total": len(results)})

    @mcp.custom_route("/api/v1/tasks/{task_id}", methods=["GET"])
    async def api_get_task(request):
        """Get a single task by ID."""
        if err := auth.require_auth(request):
            return err
        task_id = int(request.path_params["task_id"])
        result = await asyncio.to_thread(db.get_task_detail, task_id)
        if not result:
            return api_error("Task not found", "NOT_FOUND", 404)
        return JSONResponse(result)

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

        # Capture old task for change detection
        old_task = await asyncio.to_thread(db.get_task_detail, task_id)
        if not old_task:
            return api_error("Task not found", "NOT_FOUND", 404)

        updates = data.model_dump(exclude_unset=True)
        try:
            result = await asyncio.to_thread(db.update_task_full, task_id, **updates)
        except db.FeatureDisabled as e:
            return feature_disabled_error(e)
        if not result:
            return api_error("Task not found", "NOT_FOUND", 404)

        # System comments for field changes
        user = auth.get_current_user(request)
        name = f"{user['firstName']} {user['lastName']}" if user else "System"
        user_id = _get_db_user_id(user)
        desc = result.get("description", "")
        desc_short = desc[:80] + ("..." if len(desc) > 80 else "")
        case_id = result.get("case_id") or old_task.get("case_id")

        # Task-level system comments
        task_msgs = []
        if data.status is not None and old_task.get("status") != data.status:
            if data.status == "Done":
                task_msgs.append(f'{name} completed this task')
            else:
                task_msgs.append(f'{name} changed status from {old_task["status"]} to {data.status}')
        if data.urgency is not None and old_task.get("urgency") != data.urgency:
            task_msgs.append(f'{name} changed urgency from {old_task.get("urgency", "None")} to {data.urgency}')
        if data.assignee_id is not None:
            old_name = old_task.get("assignee_first_name")
            new_name = result.get("assignee_first_name")
            old_label = f'{old_name} {old_task.get("assignee_last_name", "")}' if old_name else "Unassigned"
            new_label = f'{new_name} {result.get("assignee_last_name", "")}' if new_name else "Unassigned"
            if old_label != new_label:
                task_msgs.append(f'{name} changed assignee from {old_label.strip()} to {new_label.strip()}')
        if "due_date" in updates:
            old_due = old_task.get("due_date") or "None"
            new_due = result.get("due_date") or "None"
            if old_due != new_due:
                task_msgs.append(f'{name} changed due date from {old_due} to {new_due}')

        for msg in task_msgs:
            await asyncio.to_thread(
                add_entity_comment, "task", task_id, user_id, msg, True,
            )
        if task_msgs:
            broadcast({
                "entity": "comment",
                "action": "created",
                "id": None,
                "entity_type": "task",
                "entity_id": task_id,
                "user_id": user_id,
            })

        # Case-level activity feed (status changes only, as before)
        if data.status is not None and old_task.get("status") != data.status and case_id:
            if data.status == "Done":
                case_msg = f'{name} completed task: "{desc_short}"'
            else:
                case_msg = f'{name} changed task "{desc_short}" from {old_task["status"]} to {data.status}'
            await asyncio.to_thread(
                db.add_case_comment, case_id, user_id, case_msg, True,
            )

        broadcast({"entity": "task", "action": "updated", "id": task_id, "case_id": case_id})
        return JSONResponse({"success": True, "task": result})

    @mcp.custom_route("/api/v1/tasks/{task_id}", methods=["DELETE"])
    async def api_delete_task(request):
        """Delete a task."""
        if err := auth.require_auth(request):
            return err
        task_id = int(request.path_params["task_id"])
        try:
            deleted = await asyncio.to_thread(db.delete_task, task_id)
        except db.FeatureDisabled as e:
            return feature_disabled_error(e)
        if deleted:
            broadcast({"entity": "task", "action": "deleted", "id": task_id})
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
        except db.FeatureDisabled as e:
            return feature_disabled_error(e)
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

        task_ids = data.get("task_ids")  # optional list to scope update

        try:
            result = await asyncio.to_thread(db.reschedule_overdue_tasks, new_date, task_ids)
            return JSONResponse({"success": True, **result})
        except db.ValidationError as e:
            return api_error(str(e), "VALIDATION_ERROR", 400)

