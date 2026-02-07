"""
Roles API routes.

Handles role CRUD operations for the unified roles system.
"""

import asyncio
from fastapi.responses import JSONResponse
import db
import auth
from .common import api_error


def register_role_routes(mcp):
    """Register role management routes."""

    @mcp.custom_route("/api/v1/roles", methods=["GET"])
    async def api_list_roles(request):
        """List all roles, optionally filtered by category."""
        if err := auth.require_auth(request):
            return err
        category = request.query_params.get("category")
        with_counts = request.query_params.get("with_counts", "false").lower() == "true"

        if with_counts:
            roles = await asyncio.to_thread(db.get_roles_with_counts)
        else:
            roles = await asyncio.to_thread(db.get_roles, category=category)
        return JSONResponse({"success": True, "roles": roles})

    @mcp.custom_route("/api/v1/roles", methods=["POST"])
    async def api_create_role(request):
        """Create a new role (admin only)."""
        if err := auth.require_auth(request):
            return err
        data = await request.json()
        try:
            result = await asyncio.to_thread(
                db.create_role,
                name=data["name"],
                category=data.get("category", "other"),
                sort_order=data.get("sort_order", 99),
                description=data.get("description")
            )
            return JSONResponse({"success": True, "role": result}, status_code=201)
        except db.ValidationError as e:
            return api_error(str(e), "VALIDATION_ERROR", 400)
        except Exception as e:
            if "duplicate key" in str(e).lower():
                return api_error(f"Role '{data.get('name')}' already exists", "DUPLICATE", 409)
            raise

    @mcp.custom_route("/api/v1/roles/{role_id}", methods=["GET"])
    async def api_get_role(request):
        """Get a specific role by ID."""
        if err := auth.require_auth(request):
            return err
        role_id = int(request.path_params["role_id"])
        role = await asyncio.to_thread(db.get_role_by_id, role_id)
        if not role:
            return api_error("Role not found", "NOT_FOUND", 404)
        return JSONResponse({"success": True, "role": role})

    @mcp.custom_route("/api/v1/roles/{role_id}", methods=["PUT"])
    async def api_update_role(request):
        """Update a role."""
        if err := auth.require_auth(request):
            return err
        role_id = int(request.path_params["role_id"])
        data = await request.json()
        try:
            result = await asyncio.to_thread(
                db.update_role,
                role_id,
                name=data.get("name"),
                category=data.get("category"),
                sort_order=data.get("sort_order"),
                description=data.get("description")
            )
            if not result:
                return api_error("Role not found", "NOT_FOUND", 404)
            return JSONResponse({"success": True, "role": result})
        except db.ValidationError as e:
            return api_error(str(e), "VALIDATION_ERROR", 400)

    @mcp.custom_route("/api/v1/roles/{role_id}", methods=["DELETE"])
    async def api_delete_role(request):
        """Delete a role if not in use."""
        if err := auth.require_auth(request):
            return err
        role_id = int(request.path_params["role_id"])
        result = await asyncio.to_thread(db.delete_role, role_id)
        if result.get("success"):
            return JSONResponse({"success": True})
        return api_error(result.get("error", "Cannot delete role"), "DELETE_ERROR", 400)
