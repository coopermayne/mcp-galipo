"""
Person/contact API routes.

Handles person CRUD and person_roles assignment operations.
Uses the unified roles schema: persons + person_roles + roles.
"""

import asyncio
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
import db
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
        role_id = request.query_params.get("role_id")
        category = request.query_params.get("category")
        organization = request.query_params.get("organization")
        email = request.query_params.get("email")
        phone = request.query_params.get("phone")
        case_id = request.query_params.get("case_id")
        unassigned = request.query_params.get("unassigned", "false").lower() == "true"
        include_roles = request.query_params.get("include_roles", "false").lower() == "true"
        user_id = request.query_params.get("user_id")
        limit = int(request.query_params.get("limit", 50))
        offset = int(request.query_params.get("offset", 0))

        result = await asyncio.to_thread(
            db.search_persons,
            name=name,
            role_id=int(role_id) if role_id else None,
            category=category,
            organization=organization,
            email=email,
            phone=phone,
            case_id=int(case_id) if case_id else None,
            unassigned=unassigned,
            include_roles=include_roles,
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
                name=data["name"],
                phones=data.get("phones"),
                emails=data.get("emails"),
                address=data.get("address"),
                organization=data.get("organization"),
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
                phones=data.get("phones"),
                emails=data.get("emails"),
                address=data.get("address"),
                organization=data.get("organization"),
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
        except IntegrityError as e:
            if e.orig is not None and "foreign key" in str(e.orig).lower():
                return api_error("Person is still referenced by other records", "FK_VIOLATION", 409)
            raise
        if deleted:
            return JSONResponse({"success": True, "action": "deleted"})
        return api_error("Person not found", "NOT_FOUND", 404)

    @mcp.custom_route("/api/v1/persons/{person_id}/archive", methods=["POST"])
    async def api_archive_person(request):
        """Archive (soft delete) a person."""
        if err := auth.require_auth(request):
            return err
        person_id = int(request.path_params["person_id"])
        result = await asyncio.to_thread(db.archive_person, person_id)
        if not result:
            return api_error("Person not found", "NOT_FOUND", 404)
        return JSONResponse({"success": True, "person": result})

    # Case-Person role assignment routes
    @mcp.custom_route("/api/v1/cases/{case_id}/persons", methods=["GET"])
    async def api_list_case_persons(request):
        """List persons assigned to a case."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        role_id = request.query_params.get("role_id")
        category = request.query_params.get("category")

        persons = await asyncio.to_thread(
            db.get_case_persons,
            case_id,
            role_id=int(role_id) if role_id else None,
            category=category
        )
        return JSONResponse({"success": True, "persons": persons, "total": len(persons)})

    @mcp.custom_route("/api/v1/cases/{case_id}/persons", methods=["POST"])
    async def api_assign_person_to_case(request):
        """Assign a person to a case with a role."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        data = await request.json()

        try:
            result = await asyncio.to_thread(
                db.assign_person_to_case,
                case_id=case_id,
                person_id=data["person_id"],
                role_id=data["role_id"],
                attributes=data.get("attributes"),
                notes=data.get("notes"),
                is_primary=data.get("is_primary", False),
                grouped_under_id=data.get("grouped_under_id"),
                assigned_date=data.get("assigned_date")
            )

            # System comment for person assignment
            user = auth.get_current_user(request)
            if user:
                actor = f"{user['firstName']} {user['lastName']}"
                person = await asyncio.to_thread(db.get_person_by_id, data["person_id"])
                person_name = person.get("name", f"Person {data['person_id']}") if person else f"Person {data['person_id']}"
                role = await asyncio.to_thread(db.get_role_by_id, data["role_id"])
                role_name = role.get("name", "Unknown") if role else "Unknown"
                await asyncio.to_thread(
                    db.add_case_comment, case_id, user["id"],
                    f"{actor} added {person_name} as {role_name}", True,
                )

            return JSONResponse({"success": True, "assignment": result})
        except db.ValidationError as e:
            return api_error(str(e), "VALIDATION_ERROR", 400)

    @mcp.custom_route("/api/v1/cases/{case_id}/person-roles/{assignment_id}", methods=["PUT"])
    async def api_update_case_assignment(request):
        """Update a case-person role assignment."""
        if err := auth.require_auth(request):
            return err
        assignment_id = int(request.path_params["assignment_id"])
        data = await request.json()

        try:
            result = await asyncio.to_thread(
                db.update_case_assignment,
                assignment_id=assignment_id,
                attributes=data.get("attributes"),
                notes=data.get("notes"),
                is_primary=data.get("is_primary"),
                grouped_under_id=data.get("grouped_under_id"),
                assigned_date=data.get("assigned_date")
            )
            if not result:
                return api_error("Assignment not found", "NOT_FOUND", 404)
            return JSONResponse({"success": True, "assignment": result})
        except db.ValidationError as e:
            return api_error(str(e), "VALIDATION_ERROR", 400)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return api_error(str(e), "INTERNAL_ERROR", 500)

    @mcp.custom_route("/api/v1/cases/{case_id}/persons/{person_id}/change-role", methods=["PATCH"])
    async def api_change_person_role(request):
        """Change a person's role on a case."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        person_id = int(request.path_params["person_id"])
        data = await request.json()

        old_role_id = data.get("old_role_id")
        new_role_id = data.get("new_role_id")
        if not old_role_id or not new_role_id:
            return api_error("old_role_id and new_role_id are required", "VALIDATION_ERROR", 400)

        try:
            result = await asyncio.to_thread(
                db.change_person_role_on_case,
                case_id=case_id,
                person_id=person_id,
                old_role_id=int(old_role_id),
                new_role_id=int(new_role_id),
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
        role_id = request.query_params.get("role_id")

        removed = await asyncio.to_thread(
            db.remove_person_from_case,
            case_id,
            person_id,
            role_id=int(role_id) if role_id else None
        )
        if removed:
            return JSONResponse({"success": True})
        return api_error("Assignment not found", "NOT_FOUND", 404)
