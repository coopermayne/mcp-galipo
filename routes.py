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
        """Invalidate session token."""
        token = auth.get_token_from_request(request)
        if token:
            auth.invalidate_session(token)
        return JSONResponse({"success": True})

    @mcp.custom_route("/api/v1/auth/verify", methods=["GET"])
    async def api_auth_verify(request):
        """Check if token is valid."""
        token = auth.get_token_from_request(request)
        if token and auth.validate_session(token):
            return JSONResponse({"success": True, "valid": True})
        return JSONResponse(
            {"success": False, "error": {"message": "Invalid or expired token", "code": "UNAUTHORIZED"}},
            status_code=401
        )

    # ===== API ROUTES =====

    @mcp.custom_route("/api/v1/stats", methods=["GET"])
    async def api_stats(request):
        """Get dashboard statistics."""
        if err := auth.require_auth(request):
            return err
        stats = db.get_dashboard_stats()
        return JSONResponse(stats)

    @mcp.custom_route("/api/v1/constants", methods=["GET"])
    async def api_constants(request):
        """Get system constants (statuses, roles, courts, etc.)."""
        if err := auth.require_auth(request):
            return err
        return JSONResponse({
            "case_statuses": db.CASE_STATUSES,
            "contact_roles": db.CONTACT_ROLES,
            "task_statuses": db.TASK_STATUSES,
            "courts": db.COURT_OPTIONS,
            "person_types": db.PERSON_TYPES,
            "person_sides": db.PERSON_SIDES
        })

    # ===== CASE ROUTES =====

    @mcp.custom_route("/api/v1/cases", methods=["GET"])
    async def api_list_cases(request):
        """List all cases with optional filtering and pagination."""
        if err := auth.require_auth(request):
            return err
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
            data.get("court"),
            data.get("print_code"),
            data.get("case_summary"),
            data.get("date_of_injury"),
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
        """Update an existing task."""
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

    # ===== DEADLINE ROUTES =====

    @mcp.custom_route("/api/v1/deadlines", methods=["GET"])
    async def api_list_deadlines(request):
        """List deadlines with optional filtering and pagination."""
        if err := auth.require_auth(request):
            return err
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
        if err := auth.require_auth(request):
            return err
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

    # ===== CASE RELATIONSHIP ROUTES =====

    # --- Clients ---
    @mcp.custom_route("/api/v1/clients", methods=["GET"])
    async def api_list_clients(request):
        """List all clients."""
        if err := auth.require_auth(request):
            return err
        result = db.get_all_clients()
        return JSONResponse({"clients": result})

    @mcp.custom_route("/api/v1/clients", methods=["POST"])
    async def api_create_client(request):
        """Create a new client."""
        if err := auth.require_auth(request):
            return err
        data = await request.json()
        result = db.create_client(
            data["name"],
            data.get("phone"),
            data.get("email"),
            data.get("address"),
            data.get("notes")
        )
        return JSONResponse({"success": True, "client": result})

    @mcp.custom_route("/api/v1/cases/{case_id}/clients", methods=["POST"])
    async def api_link_client_to_case(request):
        """Link a client to a case."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        data = await request.json()
        # If client_id provided, link existing client
        if data.get("client_id"):
            result = db.link_existing_client_to_case(
                case_id,
                data["client_id"],
                data.get("contact_directly", True),
                data.get("contact_via_id"),
                data.get("contact_via_relationship"),
                data.get("is_primary", False),
                data.get("notes")
            )
        else:
            # Create new client and link
            client = db.create_client(
                data["name"],
                data.get("phone"),
                data.get("email"),
                data.get("address"),
                data.get("notes")
            )
            result = db.add_client_to_case(
                case_id,
                client["id"],
                data.get("contact_directly", True),
                data.get("contact_via_id"),
                data.get("contact_via_relationship"),
                data.get("is_primary", False)
            )
        return JSONResponse({"success": True, "result": result})

    @mcp.custom_route("/api/v1/cases/{case_id}/clients/{client_id}", methods=["DELETE"])
    async def api_unlink_client_from_case(request):
        """Remove a client from a case."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        client_id = int(request.path_params["client_id"])
        if db.remove_client_from_case(case_id, client_id):
            return JSONResponse({"success": True})
        return api_error("Client not linked to case", "NOT_FOUND", 404)

    # --- Defendants ---
    @mcp.custom_route("/api/v1/defendants", methods=["GET"])
    async def api_list_defendants(request):
        """List all defendants."""
        if err := auth.require_auth(request):
            return err
        result = db.get_all_defendants()
        return JSONResponse({"defendants": result})

    @mcp.custom_route("/api/v1/cases/{case_id}/defendants", methods=["POST"])
    async def api_add_defendant_to_case(request):
        """Add a defendant to a case."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        data = await request.json()
        result = db.add_defendant_to_case(case_id, data["name"])
        return JSONResponse({"success": True, "defendant": result})

    @mcp.custom_route("/api/v1/cases/{case_id}/defendants/{defendant_id}", methods=["DELETE"])
    async def api_remove_defendant_from_case(request):
        """Remove a defendant from a case."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        defendant_id = int(request.path_params["defendant_id"])
        if db.remove_defendant_from_case(case_id, defendant_id):
            return JSONResponse({"success": True})
        return api_error("Defendant not linked to case", "NOT_FOUND", 404)

    # --- Contacts ---
    @mcp.custom_route("/api/v1/contacts", methods=["GET"])
    async def api_list_contacts(request):
        """List all contacts."""
        if err := auth.require_auth(request):
            return err
        result = db.get_all_contacts()
        return JSONResponse({"contacts": result})

    @mcp.custom_route("/api/v1/contacts", methods=["POST"])
    async def api_create_contact(request):
        """Create a new contact."""
        if err := auth.require_auth(request):
            return err
        data = await request.json()
        result = db.create_contact(
            data["name"],
            data.get("firm"),
            data.get("phone"),
            data.get("email"),
            data.get("address"),
            data.get("notes")
        )
        return JSONResponse({"success": True, "contact": result})

    @mcp.custom_route("/api/v1/cases/{case_id}/contacts", methods=["POST"])
    async def api_link_contact_to_case(request):
        """Link a contact to a case with a role."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        data = await request.json()
        # If contact_id provided, link existing contact
        if data.get("contact_id"):
            result = db.link_contact_to_case(
                case_id,
                data["contact_id"],
                data["role"],
                data.get("notes")
            )
        else:
            # Create new contact and link
            contact = db.create_contact(
                data["name"],
                data.get("firm"),
                data.get("phone"),
                data.get("email"),
                data.get("address"),
                data.get("notes")
            )
            result = db.link_contact_to_case(
                case_id,
                contact["id"],
                data["role"]
            )
        return JSONResponse({"success": True, "result": result})

    @mcp.custom_route("/api/v1/cases/{case_id}/contacts/{contact_id}", methods=["DELETE"])
    async def api_unlink_contact_from_case(request):
        """Remove a contact from a case."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        contact_id = int(request.path_params["contact_id"])
        role = request.query_params.get("role")
        if db.remove_contact_from_case(case_id, contact_id, role):
            return JSONResponse({"success": True})
        return api_error("Contact not linked to case", "NOT_FOUND", 404)

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
            include_archived=include_archived,
            limit=limit,
            offset=offset
        )
        return JSONResponse({
            "persons": result["items"],
            "total": result["total"],
            "limit": result["limit"],
            "offset": result["offset"]
        })

    @mcp.custom_route("/api/v1/persons", methods=["POST"])
    async def api_create_person(request):
        """Create a new person."""
        if err := auth.require_auth(request):
            return err
        data = await request.json()
        if not data.get("name"):
            return api_error("Name is required", "VALIDATION_ERROR", 400)
        if not data.get("person_type"):
            return api_error("person_type is required", "VALIDATION_ERROR", 400)
        try:
            db.validate_person_type(data["person_type"])
        except db.ValidationError as e:
            return api_error(str(e), "VALIDATION_ERROR", 400)

        result = db.create_person(
            person_type=data["person_type"],
            name=data["name"],
            phone=data.get("phone"),
            email=data.get("email"),
            address=data.get("address"),
            organization=data.get("organization"),
            attributes=data.get("attributes"),
            notes=data.get("notes")
        )

        return JSONResponse({"success": True, "person": result})

    @mcp.custom_route("/api/v1/persons/{person_id}", methods=["GET"])
    async def api_get_person(request):
        """Get a person by ID with all details."""
        if err := auth.require_auth(request):
            return err
        person_id = int(request.path_params["person_id"])
        result = db.get_person_by_id(person_id)
        if not result:
            return api_error("Person not found", "NOT_FOUND", 404)
        return JSONResponse({"success": True, "person": result})

    @mcp.custom_route("/api/v1/persons/{person_id}", methods=["PUT"])
    async def api_update_person(request):
        """Update a person."""
        if err := auth.require_auth(request):
            return err
        person_id = int(request.path_params["person_id"])
        data = await request.json()

        if data.get("person_type"):
            try:
                db.validate_person_type(data["person_type"])
            except db.ValidationError as e:
                return api_error(str(e), "VALIDATION_ERROR", 400)

        result = db.update_person(
            person_id,
            name=data.get("name"),
            person_type=data.get("person_type"),
            phone=data.get("phone"),
            email=data.get("email"),
            address=data.get("address"),
            organization=data.get("organization"),
            attributes=data.get("attributes"),
            notes=data.get("notes"),
            archived=data.get("archived")
        )
        if not result:
            return api_error("Person not found", "NOT_FOUND", 404)

        return JSONResponse({"success": True, "person": result})

    @mcp.custom_route("/api/v1/persons/{person_id}", methods=["DELETE"])
    async def api_delete_person(request):
        """Archive (soft delete) a person."""
        if err := auth.require_auth(request):
            return err
        person_id = int(request.path_params["person_id"])
        # Check if permanent delete requested
        permanent = request.query_params.get("permanent", "false").lower() == "true"
        if permanent:
            if db.delete_person(person_id):
                return JSONResponse({"success": True, "action": "deleted"})
        else:
            if db.archive_person(person_id):
                return JSONResponse({"success": True, "action": "archived"})
        return api_error("Person not found", "NOT_FOUND", 404)

    # Case-Person assignments
    @mcp.custom_route("/api/v1/cases/{case_id}/persons", methods=["GET"])
    async def api_get_case_persons(request):
        """List all persons assigned to a case."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        person_type = request.query_params.get("type")
        role = request.query_params.get("role")
        side = request.query_params.get("side")

        result = db.get_case_persons(case_id, person_type, role, side)
        return JSONResponse({"success": True, "persons": result, "total": len(result)})

    @mcp.custom_route("/api/v1/cases/{case_id}/persons", methods=["POST"])
    async def api_assign_person_to_case(request):
        """Assign a person to a case."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        data = await request.json()

        if not data.get("person_id"):
            return api_error("person_id is required", "VALIDATION_ERROR", 400)
        if not data.get("role"):
            return api_error("role is required", "VALIDATION_ERROR", 400)

        try:
            if data.get("side"):
                db.validate_person_side(data["side"])
            if data.get("assigned_date"):
                db.validate_date_format(data["assigned_date"], "assigned_date")
        except db.ValidationError as e:
            return api_error(str(e), "VALIDATION_ERROR", 400)

        result = db.assign_person_to_case(
            case_id=case_id,
            person_id=data["person_id"],
            role=data["role"],
            side=data.get("side"),
            case_attributes=data.get("case_attributes"),
            case_notes=data.get("case_notes"),
            is_primary=data.get("is_primary", False),
            contact_directly=data.get("contact_directly", True),
            contact_via_person_id=data.get("contact_via_person_id"),
            contact_via_relationship=data.get("contact_via_relationship"),
            assigned_date=data.get("assigned_date")
        )
        return JSONResponse({"success": True, "assignment": result})

    @mcp.custom_route("/api/v1/cases/{case_id}/persons/{person_id}", methods=["PUT"])
    async def api_update_case_assignment(request):
        """Update a case-person assignment."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        person_id = int(request.path_params["person_id"])
        data = await request.json()

        if not data.get("role"):
            return api_error("role is required to identify the assignment", "VALIDATION_ERROR", 400)

        try:
            if data.get("side"):
                db.validate_person_side(data["side"])
            if data.get("assigned_date"):
                db.validate_date_format(data["assigned_date"], "assigned_date")
        except db.ValidationError as e:
            return api_error(str(e), "VALIDATION_ERROR", 400)

        result = db.update_case_assignment(
            case_id=case_id,
            person_id=person_id,
            role=data["role"],
            side=data.get("side"),
            case_attributes=data.get("case_attributes"),
            case_notes=data.get("case_notes"),
            is_primary=data.get("is_primary"),
            contact_directly=data.get("contact_directly"),
            contact_via_person_id=data.get("contact_via_person_id"),
            contact_via_relationship=data.get("contact_via_relationship"),
            assigned_date=data.get("assigned_date")
        )
        if not result:
            return api_error("Assignment not found", "NOT_FOUND", 404)
        return JSONResponse({"success": True, "assignment": result})

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

    # Expertise Types
    @mcp.custom_route("/api/v1/expertise-types", methods=["GET"])
    async def api_list_expertise_types(request):
        """List all expertise types."""
        if err := auth.require_auth(request):
            return err
        result = db.get_expertise_types()
        return JSONResponse({"success": True, "expertise_types": result, "total": len(result)})

    @mcp.custom_route("/api/v1/expertise-types", methods=["POST"])
    async def api_create_expertise_type(request):
        """Create a new expertise type."""
        if err := auth.require_auth(request):
            return err
        data = await request.json()
        if not data.get("name"):
            return api_error("Name is required", "VALIDATION_ERROR", 400)
        result = db.create_expertise_type(data["name"], data.get("description"))
        return JSONResponse({"success": True, "expertise_type": result})

    # Person Types
    @mcp.custom_route("/api/v1/person-types", methods=["GET"])
    async def api_list_person_types(request):
        """List all person types."""
        if err := auth.require_auth(request):
            return err
        result = db.get_person_types()
        return JSONResponse({"success": True, "person_types": result, "total": len(result)})

    @mcp.custom_route("/api/v1/person-types", methods=["POST"])
    async def api_create_person_type(request):
        """Create a new person type."""
        if err := auth.require_auth(request):
            return err
        data = await request.json()
        if not data.get("name"):
            return api_error("Name is required", "VALIDATION_ERROR", 400)
        result = db.create_person_type(data["name"], data.get("description"))
        return JSONResponse({"success": True, "person_type": result})

    # ===== REACT SPA ROUTES (must be last!) =====

    @mcp.custom_route("/", methods=["GET"])
    async def react_root(request):
        """Serve the React SPA."""
        html_path = REACT_DIST_DIR / "index.html"
        if html_path.exists():
            return FileResponse(html_path, media_type="text/html")
        # Fallback to legacy if React not built
        html_path = TEMPLATES_DIR / "index.html"
        if html_path.exists():
            return FileResponse(html_path, media_type="text/html")
        return HTMLResponse("Frontend not found", status_code=404)

    # Catch-all for React SPA client-side routing (cases, tasks, deadlines pages)
    @mcp.custom_route("/{path:path}", methods=["GET"])
    async def react_spa_catchall(request):
        """Serve React SPA for client-side routing."""
        path = request.path_params.get("path", "")
        # Skip API routes, static assets, legacy, and SSE
        if path.startswith("api/") or path.startswith("static/") or path.startswith("assets/") or path == "legacy" or path.startswith("sse"):
            return HTMLResponse("Not found", status_code=404)
        # Serve React index.html for client-side routing
        html_path = REACT_DIST_DIR / "index.html"
        if html_path.exists():
            return FileResponse(html_path, media_type="text/html")
        return HTMLResponse("Frontend not found", status_code=404)
