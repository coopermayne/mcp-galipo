"""
Statistics and constants routes.

Provides dashboard stats and system constants for the frontend.
"""

import asyncio
from fastapi.responses import JSONResponse
import database as db
import auth
from .common import api_error


def register_stats_routes(mcp):
    """Register statistics and constants routes."""

    @mcp.custom_route("/api/v1/stats", methods=["GET"])
    async def api_stats(request):
        """Get dashboard statistics."""
        if err := auth.require_auth(request):
            return err
        stats = await asyncio.to_thread(db.get_dashboard_stats)
        return JSONResponse(stats)

    @mcp.custom_route("/api/v1/constants", methods=["GET"])
    async def api_constants(request):
        """Get system constants (statuses, person types, jurisdictions, etc.)."""
        if err := auth.require_auth(request):
            return err
        # Fetch DB values in parallel
        person_types, jurisdictions = await asyncio.gather(
            asyncio.to_thread(db.get_person_types),
            asyncio.to_thread(db.get_jurisdictions)
        )
        return JSONResponse({
            "case_statuses": db.CASE_STATUSES,
            "task_statuses": db.TASK_STATUSES,
            "activity_types": db.ACTIVITY_TYPES,
            "person_types": [pt["name"] for pt in person_types],
            "person_sides": db.PERSON_SIDES,
            "jurisdictions": jurisdictions
        })

    @mcp.custom_route("/api/v1/jurisdictions", methods=["GET"])
    async def api_list_jurisdictions(request):
        """List all jurisdictions."""
        if err := auth.require_auth(request):
            return err
        jurisdictions = await asyncio.to_thread(db.get_jurisdictions)
        return JSONResponse({"success": True, "jurisdictions": jurisdictions, "total": len(jurisdictions)})

    @mcp.custom_route("/api/v1/jurisdictions", methods=["POST"])
    async def api_create_jurisdiction(request):
        """Create a new jurisdiction."""
        if err := auth.require_auth(request):
            return err
        data = await request.json()
        result = await asyncio.to_thread(
            db.create_jurisdiction,
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
        jurisdiction = await asyncio.to_thread(db.get_jurisdiction_by_id, jurisdiction_id)
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
        result = await asyncio.to_thread(
            db.update_jurisdiction,
            jurisdiction_id,
            name=data.get("name"),
            local_rules_link=data.get("local_rules_link"),
            notes=data.get("notes")
        )
        if not result:
            return api_error("Jurisdiction not found", "NOT_FOUND", 404)
        return JSONResponse({"success": True, "jurisdiction": result})

    @mcp.custom_route("/api/v1/expertise-types", methods=["GET"])
    async def api_list_expertise_types(request):
        """List all expertise types."""
        if err := auth.require_auth(request):
            return err
        types = await asyncio.to_thread(db.get_expertise_types)
        return JSONResponse({"success": True, "expertise_types": types, "total": len(types)})

    @mcp.custom_route("/api/v1/expertise-types", methods=["POST"])
    async def api_create_expertise_type(request):
        """Create a new expertise type."""
        if err := auth.require_auth(request):
            return err
        data = await request.json()
        result = await asyncio.to_thread(db.create_expertise_type, data["name"], data.get("description"))
        return JSONResponse({"success": True, "expertise_type": result})

    @mcp.custom_route("/api/v1/person-types", methods=["GET"])
    async def api_list_person_types(request):
        """List all person types."""
        if err := auth.require_auth(request):
            return err
        types = await asyncio.to_thread(db.get_person_types)
        return JSONResponse({"success": True, "person_types": types, "total": len(types)})

    @mcp.custom_route("/api/v1/person-types", methods=["POST"])
    async def api_create_person_type(request):
        """Create a new person type."""
        if err := auth.require_auth(request):
            return err
        data = await request.json()
        result = await asyncio.to_thread(db.create_person_type, data["name"], data.get("description"))
        return JSONResponse({"success": True, "person_type": result})
