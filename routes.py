"""
REST API Routes for Legal Case Management Frontend

HTTP endpoints that power the web UI.
"""

from pathlib import Path
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
import database as db

STATIC_DIR = Path(__file__).parent / "static"
TEMPLATES_DIR = Path(__file__).parent / "templates"


def api_error(message: str, code: str, status_code: int = 400):
    """Create a standardized API error response."""
    return JSONResponse(
        {"success": False, "error": {"message": message, "code": code}},
        status_code=status_code
    )


def register_routes(mcp):
    """Register all HTTP routes on the given FastMCP instance."""

    # ===== STATIC FILE ROUTES =====

    @mcp.custom_route("/", methods=["GET"])
    async def dashboard(request):
        """Serve the main SPA dashboard."""
        html_path = TEMPLATES_DIR / "index.html"
        if html_path.exists():
            return FileResponse(html_path, media_type="text/html")
        return HTMLResponse("Template not found", status_code=404)

    @mcp.custom_route("/static/{filename:path}", methods=["GET"])
    async def serve_static(request):
        """Serve static files (CSS, JS, images)."""
        filename = request.path_params["filename"]
        file_path = STATIC_DIR / filename
        if file_path.exists() and file_path.is_file():
            content_types = {
                ".css": "text/css",
                ".js": "application/javascript",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".svg": "image/svg+xml"
            }
            content_type = content_types.get(file_path.suffix, "application/octet-stream")
            return FileResponse(file_path, media_type=content_type)
        return HTMLResponse("Not found", status_code=404)

    # ===== API ROUTES =====

    @mcp.custom_route("/api/v1/stats", methods=["GET"])
    async def api_stats(request):
        """Get dashboard statistics."""
        stats = db.get_dashboard_stats()
        return JSONResponse(stats)

    @mcp.custom_route("/api/v1/constants", methods=["GET"])
    async def api_constants(request):
        """Get system constants (statuses, roles, etc.)."""
        return JSONResponse({
            "case_statuses": db.CASE_STATUSES,
            "contact_roles": db.CONTACT_ROLES,
            "task_statuses": db.TASK_STATUSES
        })

    # ===== CASE ROUTES =====

    @mcp.custom_route("/api/v1/cases", methods=["GET"])
    async def api_list_cases(request):
        """List all cases with optional filtering and pagination."""
        status = request.query_params.get("status")
        limit = request.query_params.get("limit")
        offset = request.query_params.get("offset", "0")
        limit = int(limit) if limit else db.DEFAULT_PAGE_SIZE
        offset = int(offset)
        result = db.get_all_cases(status, limit=limit, offset=offset)
        return JSONResponse({
            "cases": result["items"],
            "total": result["total"],
            "limit": result["limit"],
            "offset": result["offset"]
        })

    @mcp.custom_route("/api/v1/cases/{case_id}", methods=["GET"])
    async def api_get_case(request):
        """Get a specific case by ID."""
        case_id = int(request.path_params["case_id"])
        case = db.get_case_by_id(case_id)
        if not case:
            return api_error("Case not found", "NOT_FOUND", 404)
        return JSONResponse(case)

    @mcp.custom_route("/api/v1/cases", methods=["POST"])
    async def api_create_case(request):
        """Create a new case."""
        data = await request.json()
        result = db.create_case(
            data["case_name"],
            data.get("status", "Signing Up"),
            data.get("court"),
            data.get("print_code"),
            data.get("case_summary"),
            data.get("date_of_injury")
        )
        return JSONResponse({"success": True, "case": result})

    @mcp.custom_route("/api/v1/cases/{case_id}", methods=["PUT"])
    async def api_update_case(request):
        """Update an existing case."""
        case_id = int(request.path_params["case_id"])
        data = await request.json()
        result = db.update_case(case_id, **data)
        if not result:
            return api_error("Case not found", "NOT_FOUND", 404)
        return JSONResponse({"success": True, "case": result})

    @mcp.custom_route("/api/v1/cases/{case_id}", methods=["DELETE"])
    async def api_delete_case(request):
        """Delete a case."""
        case_id = int(request.path_params["case_id"])
        if db.delete_case(case_id):
            return JSONResponse({"success": True})
        return api_error("Case not found", "NOT_FOUND", 404)

    # ===== TASK ROUTES =====

    @mcp.custom_route("/api/v1/tasks", methods=["GET"])
    async def api_list_tasks(request):
        """List tasks with optional filtering and pagination."""
        case_id = request.query_params.get("case_id")
        status = request.query_params.get("status")
        urgency = request.query_params.get("urgency")
        limit = request.query_params.get("limit")
        offset = request.query_params.get("offset", "0")
        limit = int(limit) if limit else db.DEFAULT_PAGE_SIZE
        offset = int(offset)
        result = db.get_tasks(
            int(case_id) if case_id else None,
            status,
            int(urgency) if urgency else None,
            limit=limit,
            offset=offset
        )
        return JSONResponse({
            "tasks": result["items"],
            "total": result["total"],
            "limit": result["limit"],
            "offset": result["offset"]
        })

    @mcp.custom_route("/api/v1/tasks", methods=["POST"])
    async def api_create_task(request):
        """Create a new task."""
        data = await request.json()
        result = db.add_task(
            data["case_id"],
            data["description"],
            data.get("due_date"),
            data.get("status", "Pending"),
            data.get("urgency", 3),
            data.get("deadline_id")
        )
        return JSONResponse({"success": True, "task": result})

    @mcp.custom_route("/api/v1/tasks/{task_id}", methods=["PUT"])
    async def api_update_task(request):
        """Update an existing task."""
        task_id = int(request.path_params["task_id"])
        data = await request.json()
        result = db.update_task_full(task_id, **data)
        if not result:
            return api_error("Task not found", "NOT_FOUND", 404)
        return JSONResponse({"success": True, "task": result})

    @mcp.custom_route("/api/v1/tasks/{task_id}", methods=["DELETE"])
    async def api_delete_task(request):
        """Delete a task."""
        task_id = int(request.path_params["task_id"])
        if db.delete_task(task_id):
            return JSONResponse({"success": True})
        return api_error("Task not found", "NOT_FOUND", 404)

    # ===== DEADLINE ROUTES =====

    @mcp.custom_route("/api/v1/deadlines", methods=["GET"])
    async def api_list_deadlines(request):
        """List deadlines with optional filtering and pagination."""
        urgency = request.query_params.get("urgency")
        status = request.query_params.get("status")
        limit = request.query_params.get("limit")
        offset = request.query_params.get("offset", "0")
        limit = int(limit) if limit else db.DEFAULT_PAGE_SIZE
        offset = int(offset)
        result = db.get_upcoming_deadlines(
            int(urgency) if urgency else None,
            status,
            limit=limit,
            offset=offset
        )
        return JSONResponse({
            "deadlines": result["items"],
            "total": result["total"],
            "limit": result["limit"],
            "offset": result["offset"]
        })

    @mcp.custom_route("/api/v1/deadlines", methods=["POST"])
    async def api_create_deadline(request):
        """Create a new deadline."""
        data = await request.json()
        result = db.add_deadline(
            data["case_id"],
            data["date"],
            data["description"],
            data.get("status", "Pending"),
            data.get("urgency", 3),
            data.get("document_link"),
            data.get("calculation_note")
        )
        return JSONResponse({"success": True, "deadline": result})

    @mcp.custom_route("/api/v1/deadlines/{deadline_id}", methods=["PUT"])
    async def api_update_deadline(request):
        """Update an existing deadline."""
        deadline_id = int(request.path_params["deadline_id"])
        data = await request.json()
        result = db.update_deadline_full(deadline_id, **data)
        if not result:
            return api_error("Deadline not found", "NOT_FOUND", 404)
        return JSONResponse({"success": True, "deadline": result})

    @mcp.custom_route("/api/v1/deadlines/{deadline_id}", methods=["DELETE"])
    async def api_delete_deadline(request):
        """Delete a deadline."""
        deadline_id = int(request.path_params["deadline_id"])
        if db.delete_deadline(deadline_id):
            return JSONResponse({"success": True})
        return api_error("Deadline not found", "NOT_FOUND", 404)

    # ===== NOTE ROUTES =====

    @mcp.custom_route("/api/v1/notes", methods=["POST"])
    async def api_create_note(request):
        """Create a new note."""
        data = await request.json()
        result = db.add_note(data["case_id"], data["content"])
        return JSONResponse({"success": True, "note": result})

    @mcp.custom_route("/api/v1/notes/{note_id}", methods=["DELETE"])
    async def api_delete_note(request):
        """Delete a note."""
        note_id = int(request.path_params["note_id"])
        if db.delete_note(note_id):
            return JSONResponse({"success": True})
        return api_error("Note not found", "NOT_FOUND", 404)
