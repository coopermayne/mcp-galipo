"""
Person/contact API routes.

Handles person CRUD and case-person assignment operations.
"""

import asyncio
from fastapi.responses import JSONResponse
import database as db
import auth
from .common import api_error


def register_person_routes(mcp):
    """Register person management routes."""

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
        unassigned = request.query_params.get("unassigned", "false").lower() == "true"
        include_cases = request.query_params.get("include_cases", "false").lower() == "true"
        user_id = request.query_params.get("user_id")
        limit = int(request.query_params.get("limit", 50))
        offset = int(request.query_params.get("offset", 0))

        result = await asyncio.to_thread(
            db.search_persons,
            name=name,
            person_type=person_type,
            organization=organization,
            email=email,
            phone=phone,
            case_id=int(case_id) if case_id else None,
            unassigned=unassigned,
            include_cases=include_cases,
            user_id=int(user_id) if user_id else None,
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
            result = await asyncio.to_thread(
                db.create_person,
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

    # Duplicate detection and merge routes (must be before {person_id} routes)
    @mcp.custom_route("/api/v1/persons/duplicates", methods=["GET"])
    async def api_find_duplicates(request):
        """Find groups of potential duplicate persons."""
        if err := auth.require_auth(request):
            return err
        result = await asyncio.to_thread(db.find_duplicate_persons)
        return JSONResponse(result)

    @mcp.custom_route("/api/v1/persons/merge-preview", methods=["GET"])
    async def api_merge_preview(request):
        """Preview what a merge would look like."""
        if err := auth.require_auth(request):
            return err
        primary_id = request.query_params.get("primary_id")
        secondary_id = request.query_params.get("secondary_id")
        if not primary_id or not secondary_id:
            return api_error("primary_id and secondary_id are required", "VALIDATION_ERROR", 400)
        result = await asyncio.to_thread(
            db.preview_merge,
            primary_id=int(primary_id),
            secondary_id=int(secondary_id)
        )
        if "error" in result:
            return api_error(result["error"], "NOT_FOUND", 404)
        return JSONResponse(result)

    @mcp.custom_route("/api/v1/persons/merge", methods=["POST"])
    async def api_merge_persons(request):
        """Merge secondary person into primary person."""
        if err := auth.require_auth(request):
            return err
        data = await request.json()
        primary_id = data.get("primary_id")
        secondary_id = data.get("secondary_id")
        if not primary_id or not secondary_id:
            return api_error("primary_id and secondary_id are required", "VALIDATION_ERROR", 400)
        try:
            result = await asyncio.to_thread(
                db.merge_persons,
                primary_id=int(primary_id),
                secondary_id=int(secondary_id),
                field_resolutions=data.get("field_resolutions", {})
            )
            if isinstance(result, dict) and "error" in result:
                return api_error(result["error"], "NOT_FOUND", 404)
            return JSONResponse({"success": True, "person": result})
        except Exception as e:
            return api_error(str(e), "MERGE_ERROR", 500)

    @mcp.custom_route("/api/v1/persons/{person_id}", methods=["GET"])
    async def api_get_person(request):
        """Get a specific person by ID."""
        if err := auth.require_auth(request):
            return err
        person_id = int(request.path_params["person_id"])
        person = await asyncio.to_thread(db.get_person_by_id, person_id)
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
            result = await asyncio.to_thread(
                db.update_person,
                person_id,
                name=data.get("name"),
                person_type=data.get("person_type"),
                phones=data.get("phones"),
                emails=data.get("emails"),
                address=data.get("address"),
                organization=data.get("organization"),
                attributes=data.get("attributes"),
                notes=data.get("notes")
            )
            if not result:
                return api_error("Person not found", "NOT_FOUND", 404)
            return JSONResponse({"success": True, "person": result})
        except db.ValidationError as e:
            return api_error(str(e), "VALIDATION_ERROR", 400)

    @mcp.custom_route("/api/v1/persons/{person_id}", methods=["DELETE"])
    async def api_delete_person(request):
        """Delete a person permanently."""
        if err := auth.require_auth(request):
            return err
        person_id = int(request.path_params["person_id"])
        try:
            deleted = await asyncio.to_thread(db.delete_person, person_id)
        except Exception as e:
            if "ForeignKeyViolation" in type(e).__name__ or "foreign key" in str(e).lower():
                return api_error("Person is still referenced by other records", "FK_VIOLATION", 409)
            raise
        if deleted:
            return JSONResponse({"success": True, "action": "deleted"})
        return api_error("Person not found", "NOT_FOUND", 404)

    # Case-Person assignment routes
    @mcp.custom_route("/api/v1/cases/{case_id}/persons", methods=["GET"])
    async def api_list_case_persons(request):
        """List persons assigned to a case."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        person_type = request.query_params.get("type")
        role = request.query_params.get("role")
        side = request.query_params.get("side")

        persons = await asyncio.to_thread(db.get_case_persons, case_id, person_type, role, side)
        return JSONResponse({"success": True, "persons": persons, "total": len(persons)})

    @mcp.custom_route("/api/v1/cases/{case_id}/persons", methods=["POST"])
    async def api_assign_person_to_case(request):
        """Assign a person to a case."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        data = await request.json()

        try:
            result = await asyncio.to_thread(
                db.assign_person_to_case,
                case_id=case_id,
                person_id=data["person_id"],
                role=data["role"],
                side=data.get("side"),
                case_attributes=data.get("case_attributes"),
                case_notes=data.get("case_notes"),
                is_primary=data.get("is_primary", False),
                grouped_under_id=data.get("grouped_under_id"),
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
            result = await asyncio.to_thread(
                db.update_case_assignment,
                case_id=case_id,
                person_id=person_id,
                role=data["role"],
                side=data.get("side"),
                case_attributes=data.get("case_attributes"),
                case_notes=data.get("case_notes"),
                is_primary=data.get("is_primary"),
                grouped_under_id=data.get("grouped_under_id"),
                assigned_date=data.get("assigned_date")
            )
            if not result:
                return api_error("Assignment not found", "NOT_FOUND", 404)
            return JSONResponse({"success": True, "assignment": result})
        except db.ValidationError as e:
            return api_error(str(e), "VALIDATION_ERROR", 400)

    @mcp.custom_route("/api/v1/cases/{case_id}/persons/{person_id}/change-role", methods=["PATCH"])
    async def api_change_person_role(request):
        """Change a person's role on a case."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        person_id = int(request.path_params["person_id"])
        data = await request.json()

        old_role = data.get("old_role")
        new_role = data.get("new_role")
        if not old_role or not new_role:
            return api_error("old_role and new_role are required", "VALIDATION_ERROR", 400)

        try:
            result = await asyncio.to_thread(
                db.change_person_role,
                case_id=case_id,
                person_id=person_id,
                old_role=old_role,
                new_role=new_role,
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

        removed = await asyncio.to_thread(db.remove_person_from_case, case_id, person_id, role)
        if removed:
            return JSONResponse({"success": True})
        return api_error("Assignment not found", "NOT_FOUND", 404)
