"""
REST API Routes for Legal Case Management Frontend

HTTP endpoints that power the web UI.
"""

from pathlib import Path
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
import database as db
import auth

# Static directories for both frontends
STATIC_DIR = Path(__file__).parent / "static"  # Legacy vanilla JS
TEMPLATES_DIR = Path(__file__).parent / "templates"  # Legacy templates
REACT_DIST_DIR = Path(__file__).parent / "frontend" / "dist"  # React build output
REACT_ASSETS_DIR = REACT_DIST_DIR / "assets"

DEFAULT_PAGE_SIZE = 50


def api_error(message: str, code: str, status_code: int = 400):
    """Create a standardized API error response."""
    return JSONResponse(
        {"success": False, "error": {"message": message, "code": code}},
        status_code=status_code
    )


def register_routes(mcp):
    """Register all HTTP routes on the given FastMCP instance."""

    # ===== STATIC FILE ROUTES =====

    # React app static assets
    @mcp.custom_route("/assets/{filename:path}", methods=["GET"])
    async def serve_react_assets(request):
        """Serve React app assets (JS, CSS)."""
        filename = request.path_params["filename"]
        file_path = REACT_ASSETS_DIR / filename
        if file_path.exists() and file_path.is_file():
            content_types = {
                ".css": "text/css",
                ".js": "application/javascript",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".svg": "image/svg+xml",
                ".woff": "font/woff",
                ".woff2": "font/woff2",
            }
            content_type = content_types.get(file_path.suffix, "application/octet-stream")
            return FileResponse(file_path, media_type=content_type)
        return HTMLResponse("Not found", status_code=404)

    # Root-level React assets (like vite.svg)
    @mcp.custom_route("/vite.svg", methods=["GET"])
    async def serve_vite_svg(request):
        """Serve vite.svg from React dist."""
        file_path = REACT_DIST_DIR / "vite.svg"
        if file_path.exists():
            return FileResponse(file_path, media_type="image/svg+xml")
        return HTMLResponse("Not found", status_code=404)

    # Legacy vanilla JS frontend
    @mcp.custom_route("/legacy", methods=["GET"])
    async def legacy_dashboard(request):
        """Serve the legacy vanilla JS dashboard."""
        html_path = TEMPLATES_DIR / "index.html"
        if html_path.exists():
            return FileResponse(html_path, media_type="text/html")
        return HTMLResponse("Legacy template not found", status_code=404)

    @mcp.custom_route("/static/{filename:path}", methods=["GET"])
    async def serve_static(request):
        """Serve static files for legacy frontend (CSS, JS, images)."""
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

    # ===== AUTH ROUTES =====

    @mcp.custom_route("/api/v1/auth/login", methods=["POST"])
    async def api_auth_login(request):
        """Authenticate user and return session token."""
        data = await request.json()
        username = data.get("username", "")
        password = data.get("password", "")
        token = auth.authenticate(username, password)
        if token:
            return JSONResponse({"success": True, "token": token})
        return JSONResponse(
            {"success": False, "error": {"message": "Invalid credentials", "code": "INVALID_CREDENTIALS"}},
            status_code=401
        )

    @mcp.custom_route("/api/v1/auth/logout", methods=["POST"])
    async def api_auth_logout(request):
        """Logout user (invalidate token)."""
        # Token invalidation would be handled here if we had a session store
        return JSONResponse({"success": True})

    @mcp.custom_route("/api/v1/auth/verify", methods=["GET"])
    async def api_auth_verify(request):
        """Verify if current token is valid."""
        if err := auth.require_auth(request):
            return err
        return JSONResponse({"success": True, "valid": True})

    # ===== STATS & CONSTANTS =====

    @mcp.custom_route("/api/v1/stats", methods=["GET"])
    async def api_stats(request):
        """Get dashboard statistics."""
        if err := auth.require_auth(request):
            return err
        stats = db.get_dashboard_stats()
        return JSONResponse(stats)

    @mcp.custom_route("/api/v1/constants", methods=["GET"])
    async def api_constants(request):
        """Get system constants (statuses, person types, jurisdictions, etc.)."""
        if err := auth.require_auth(request):
            return err
        return JSONResponse({
            "case_statuses": db.CASE_STATUSES,
            "task_statuses": db.TASK_STATUSES,
            "activity_types": db.ACTIVITY_TYPES,
            "person_types": [pt["name"] for pt in db.get_person_types()],
            "person_sides": db.PERSON_SIDES,
            "jurisdictions": db.get_jurisdictions()
        })

    # ===== JURISDICTION ROUTES =====

    @mcp.custom_route("/api/v1/jurisdictions", methods=["GET"])
    async def api_list_jurisdictions(request):
        """List all jurisdictions."""
        if err := auth.require_auth(request):
            return err
        jurisdictions = db.get_jurisdictions()
        return JSONResponse({"success": True, "jurisdictions": jurisdictions, "total": len(jurisdictions)})

    @mcp.custom_route("/api/v1/jurisdictions", methods=["POST"])
    async def api_create_jurisdiction(request):
        """Create a new jurisdiction."""
        if err := auth.require_auth(request):
            return err
        data = await request.json()
        result = db.create_jurisdiction(
            data["name"],
            data.get("local_rules_link"),
            data.get("notes")
        )
        return JSONResponse({"success": True, "jurisdiction": result})

    @mcp.custom_route("/api/v1/jurisdictions/{jurisdiction_id}", methods=["GET"])
    async def api_get_jurisdiction(request):
        """Get a specific jurisdiction."""
        if err := auth.require_auth(request):
            return err
        jurisdiction_id = int(request.path_params["jurisdiction_id"])
        jurisdiction = db.get_jurisdiction_by_id(jurisdiction_id)
        if not jurisdiction:
            return api_error("Jurisdiction not found", "NOT_FOUND", 404)
        return JSONResponse({"success": True, "jurisdiction": jurisdiction})

    @mcp.custom_route("/api/v1/jurisdictions/{jurisdiction_id}", methods=["PUT"])
    async def api_update_jurisdiction(request):
        """Update a jurisdiction."""
        if err := auth.require_auth(request):
            return err
        jurisdiction_id = int(request.path_params["jurisdiction_id"])
        data = await request.json()
        result = db.update_jurisdiction(
            jurisdiction_id,
            name=data.get("name"),
            local_rules_link=data.get("local_rules_link"),
            notes=data.get("notes")
        )
        if not result:
            return api_error("Jurisdiction not found", "NOT_FOUND", 404)
        return JSONResponse({"success": True, "jurisdiction": result})

    # ===== CASE ROUTES =====

    @mcp.custom_route("/api/v1/cases", methods=["GET"])
    async def api_list_cases(request):
        """List all cases with optional filtering and pagination."""
        if err := auth.require_auth(request):
            return err
        status = request.query_params.get("status")
        limit = request.query_params.get("limit")
        offset = request.query_params.get("offset", "0")
        limit = int(limit) if limit else DEFAULT_PAGE_SIZE
        offset = int(offset)
        result = db.get_all_cases(status, limit=limit, offset=offset)
        return JSONResponse({
            "cases": result["cases"],
            "total": result["total"]
        })

    @mcp.custom_route("/api/v1/cases/{case_id}", methods=["GET"])
    async def api_get_case(request):
        """Get a specific case by ID."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        case = db.get_case_by_id(case_id)
        if not case:
            return api_error("Case not found", "NOT_FOUND", 404)
        return JSONResponse(case)

    @mcp.custom_route("/api/v1/cases", methods=["POST"])
    async def api_create_case(request):
        """Create a new case."""
        if err := auth.require_auth(request):
            return err
        data = await request.json()
        result = db.create_case(
            data["case_name"],
            data.get("status", "Signing Up"),
            court_id=data.get("court_id"),
            print_code=data.get("print_code"),
            case_summary=data.get("case_summary"),
            result=data.get("result"),
            date_of_injury=data.get("date_of_injury"),
            case_numbers=data.get("case_numbers"),
            short_name=data.get("short_name")
        )
        return JSONResponse({"success": True, "case": result})

    @mcp.custom_route("/api/v1/cases/{case_id}", methods=["PUT"])
    async def api_update_case(request):
        """Update an existing case."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        data = await request.json()
        result = db.update_case(case_id, **data)
        if not result:
            return api_error("Case not found", "NOT_FOUND", 404)
        return JSONResponse({"success": True, "case": result})

    @mcp.custom_route("/api/v1/cases/{case_id}", methods=["DELETE"])
    async def api_delete_case(request):
        """Delete a case."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        if db.delete_case(case_id):
            return JSONResponse({"success": True})
        return api_error("Case not found", "NOT_FOUND", 404)

    # ===== TASK ROUTES =====

    @mcp.custom_route("/api/v1/tasks", methods=["GET"])
    async def api_list_tasks(request):
        """List tasks with optional filtering and pagination."""
        if err := auth.require_auth(request):
            return err
        case_id = request.query_params.get("case_id")
        status = request.query_params.get("status")
        urgency = request.query_params.get("urgency")
        limit = request.query_params.get("limit")
        offset = request.query_params.get("offset", "0")
        limit = int(limit) if limit else DEFAULT_PAGE_SIZE
        offset = int(offset)

        result = db.get_tasks(
            case_id=int(case_id) if case_id else None,
            status_filter=status,
            urgency_filter=int(urgency) if urgency else None,
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
            data.get("urgency", 3),
            data.get("deadline_id")
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

    # ===== DEADLINE ROUTES =====

    @mcp.custom_route("/api/v1/deadlines", methods=["GET"])
    async def api_list_deadlines(request):
        """List deadlines with optional filtering and pagination."""
        if err := auth.require_auth(request):
            return err
        limit = request.query_params.get("limit")
        offset = request.query_params.get("offset", "0")
        limit = int(limit) if limit else DEFAULT_PAGE_SIZE
        offset = int(offset)

        result = db.get_upcoming_deadlines(
            limit=limit,
            offset=offset
        )
        return JSONResponse(result)

    @mcp.custom_route("/api/v1/deadlines", methods=["POST"])
    async def api_create_deadline(request):
        """Create a new deadline."""
        if err := auth.require_auth(request):
            return err
        data = await request.json()
        result = db.add_deadline(
            data["case_id"],
            data["date"],
            data["description"],
            data.get("document_link"),
            data.get("calculation_note"),
            data.get("time"),
            data.get("location"),
            data.get("starred", False)
        )
        return JSONResponse({"success": True, "deadline": result})

    @mcp.custom_route("/api/v1/deadlines/{deadline_id}", methods=["PUT"])
    async def api_update_deadline(request):
        """Update a deadline."""
        if err := auth.require_auth(request):
            return err
        deadline_id = int(request.path_params["deadline_id"])
        data = await request.json()
        result = db.update_deadline_full(deadline_id, **data)
        if not result:
            return api_error("Deadline not found", "NOT_FOUND", 404)
        return JSONResponse({"success": True, "deadline": result})

    @mcp.custom_route("/api/v1/deadlines/{deadline_id}", methods=["DELETE"])
    async def api_delete_deadline(request):
        """Delete a deadline."""
        if err := auth.require_auth(request):
            return err
        deadline_id = int(request.path_params["deadline_id"])
        if db.delete_deadline(deadline_id):
            return JSONResponse({"success": True})
        return api_error("Deadline not found", "NOT_FOUND", 404)

    # ===== NOTE ROUTES =====

    @mcp.custom_route("/api/v1/notes", methods=["POST"])
    async def api_create_note(request):
        """Create a new note."""
        if err := auth.require_auth(request):
            return err
        data = await request.json()
        result = db.add_note(data["case_id"], data["content"])
        return JSONResponse({"success": True, "note": result})

    @mcp.custom_route("/api/v1/notes/{note_id}", methods=["DELETE"])
    async def api_delete_note(request):
        """Delete a note."""
        if err := auth.require_auth(request):
            return err
        note_id = int(request.path_params["note_id"])
        if db.delete_note(note_id):
            return JSONResponse({"success": True})
        return api_error("Note not found", "NOT_FOUND", 404)

    # ===== PERSON ROUTES =====

    @mcp.custom_route("/api/v1/persons", methods=["GET"])
    async def api_list_persons(request):
        """List/search persons with optional filters."""
        if err := auth.require_auth(request):
            return err
        name = request.query_params.get("name")
        person_type = request.query_params.get("type")
        organization = request.query_params.get("organization")
        email = request.query_params.get("email")
        phone = request.query_params.get("phone")
        case_id = request.query_params.get("case_id")
        include_archived = request.query_params.get("archived", "false").lower() == "true"
        limit = int(request.query_params.get("limit", 50))
        offset = int(request.query_params.get("offset", 0))

        result = db.search_persons(
            name=name,
            person_type=person_type,
            organization=organization,
            email=email,
            phone=phone,
            case_id=int(case_id) if case_id else None,
            archived=include_archived,
            limit=limit,
            offset=offset
        )
        return JSONResponse(result)

    @mcp.custom_route("/api/v1/persons", methods=["POST"])
    async def api_create_person(request):
        """Create a new person."""
        if err := auth.require_auth(request):
            return err
        data = await request.json()
        try:
            result = db.create_person(
                person_type=data["person_type"],
                name=data["name"],
                phones=data.get("phones"),
                emails=data.get("emails"),
                address=data.get("address"),
                organization=data.get("organization"),
                attributes=data.get("attributes"),
                notes=data.get("notes")
            )
            return JSONResponse({"success": True, "person": result})
        except db.ValidationError as e:
            return api_error(str(e), "VALIDATION_ERROR", 400)

    @mcp.custom_route("/api/v1/persons/{person_id}", methods=["GET"])
    async def api_get_person(request):
        """Get a specific person by ID."""
        if err := auth.require_auth(request):
            return err
        person_id = int(request.path_params["person_id"])
        person = db.get_person_by_id(person_id)
        if not person:
            return api_error("Person not found", "NOT_FOUND", 404)
        return JSONResponse({"success": True, "person": person})

    @mcp.custom_route("/api/v1/persons/{person_id}", methods=["PUT"])
    async def api_update_person(request):
        """Update a person."""
        if err := auth.require_auth(request):
            return err
        person_id = int(request.path_params["person_id"])
        data = await request.json()
        try:
            result = db.update_person(
                person_id,
                name=data.get("name"),
                person_type=data.get("person_type"),
                phones=data.get("phones"),
                emails=data.get("emails"),
                address=data.get("address"),
                organization=data.get("organization"),
                attributes=data.get("attributes"),
                notes=data.get("notes"),
                archived=data.get("archived")
            )
            if not result:
                return api_error("Person not found", "NOT_FOUND", 404)
            return JSONResponse({"success": True, "person": result})
        except db.ValidationError as e:
            return api_error(str(e), "VALIDATION_ERROR", 400)

    @mcp.custom_route("/api/v1/persons/{person_id}", methods=["DELETE"])
    async def api_delete_person(request):
        """Delete or archive a person."""
        if err := auth.require_auth(request):
            return err
        person_id = int(request.path_params["person_id"])
        permanent = request.query_params.get("permanent", "false").lower() == "true"
        if permanent:
            if db.delete_person(person_id):
                return JSONResponse({"success": True, "action": "deleted"})
        else:
            result = db.archive_person(person_id)
            if result:
                return JSONResponse({"success": True, "action": "archived"})
        return api_error("Person not found", "NOT_FOUND", 404)

    # ===== CASE-PERSON ROUTES =====

    @mcp.custom_route("/api/v1/cases/{case_id}/persons", methods=["GET"])
    async def api_list_case_persons(request):
        """List persons assigned to a case."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        person_type = request.query_params.get("type")
        role = request.query_params.get("role")
        side = request.query_params.get("side")

        persons = db.get_case_persons(case_id, person_type, role, side)
        return JSONResponse({"success": True, "persons": persons, "total": len(persons)})

    @mcp.custom_route("/api/v1/cases/{case_id}/persons", methods=["POST"])
    async def api_assign_person_to_case(request):
        """Assign a person to a case."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        data = await request.json()

        try:
            result = db.assign_person_to_case(
                case_id=case_id,
                person_id=data["person_id"],
                role=data["role"],
                side=data.get("side"),
                case_attributes=data.get("case_attributes"),
                case_notes=data.get("case_notes"),
                is_primary=data.get("is_primary", False),
                contact_via_person_id=data.get("contact_via_person_id"),
                assigned_date=data.get("assigned_date")
            )
            return JSONResponse({"success": True, "assignment": result})
        except db.ValidationError as e:
            return api_error(str(e), "VALIDATION_ERROR", 400)

    @mcp.custom_route("/api/v1/cases/{case_id}/persons/{person_id}", methods=["PUT"])
    async def api_update_case_assignment(request):
        """Update a case-person assignment."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        person_id = int(request.path_params["person_id"])
        data = await request.json()

        try:
            result = db.update_case_assignment(
                case_id=case_id,
                person_id=person_id,
                role=data["role"],
                side=data.get("side"),
                case_attributes=data.get("case_attributes"),
                case_notes=data.get("case_notes"),
                is_primary=data.get("is_primary"),
                contact_via_person_id=data.get("contact_via_person_id"),
                assigned_date=data.get("assigned_date")
            )
            if not result:
                return api_error("Assignment not found", "NOT_FOUND", 404)
            return JSONResponse({"success": True, "assignment": result})
        except db.ValidationError as e:
            return api_error(str(e), "VALIDATION_ERROR", 400)

    @mcp.custom_route("/api/v1/cases/{case_id}/persons/{person_id}", methods=["DELETE"])
    async def api_remove_person_from_case(request):
        """Remove a person from a case."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        person_id = int(request.path_params["person_id"])
        role = request.query_params.get("role")

        if db.remove_person_from_case(case_id, person_id, role):
            return JSONResponse({"success": True})
        return api_error("Assignment not found", "NOT_FOUND", 404)

    # ===== LOOKUP TABLE ROUTES =====

    @mcp.custom_route("/api/v1/expertise-types", methods=["GET"])
    async def api_list_expertise_types(request):
        """List all expertise types."""
        if err := auth.require_auth(request):
            return err
        types = db.get_expertise_types()
        return JSONResponse({"success": True, "expertise_types": types, "total": len(types)})

    @mcp.custom_route("/api/v1/expertise-types", methods=["POST"])
    async def api_create_expertise_type(request):
        """Create a new expertise type."""
        if err := auth.require_auth(request):
            return err
        data = await request.json()
        result = db.create_expertise_type(data["name"], data.get("description"))
        return JSONResponse({"success": True, "expertise_type": result})

    @mcp.custom_route("/api/v1/person-types", methods=["GET"])
    async def api_list_person_types(request):
        """List all person types."""
        if err := auth.require_auth(request):
            return err
        types = db.get_person_types()
        return JSONResponse({"success": True, "person_types": types, "total": len(types)})

    @mcp.custom_route("/api/v1/person-types", methods=["POST"])
    async def api_create_person_type(request):
        """Create a new person type."""
        if err := auth.require_auth(request):
            return err
        data = await request.json()
        result = db.create_person_type(data["name"], data.get("description"))
        return JSONResponse({"success": True, "person_type": result})

    # ===== CATCH-ALL FOR SPA =====

    @mcp.custom_route("/", methods=["GET"])
    async def serve_react_app_root(request):
        """Serve React app for root path."""
        html_path = REACT_DIST_DIR / "index.html"
        if html_path.exists():
            return FileResponse(html_path, media_type="text/html")
        # Fallback to legacy
        html_path = TEMPLATES_DIR / "index.html"
        if html_path.exists():
            return FileResponse(html_path, media_type="text/html")
        return HTMLResponse("No frontend found", status_code=404)

    @mcp.custom_route("/{path:path}", methods=["GET"])
    async def serve_react_app_catchall(request):
        """Catch-all route for SPA client-side routing."""
        path = request.path_params.get("path", "")
        # Skip API routes
        if path.startswith("api/"):
            return HTMLResponse("Not found", status_code=404)
        # Serve React app
        html_path = REACT_DIST_DIR / "index.html"
        if html_path.exists():
            return FileResponse(html_path, media_type="text/html")
        return HTMLResponse("Not found", status_code=404)
