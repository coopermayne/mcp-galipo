"""
Judges API routes.

Handles judge CRUD operations. Judges are standalone entities linked to
proceedings via the proceeding_judges table.
"""

import asyncio
from fastapi.responses import JSONResponse
import db
import auth
from .common import api_error


def register_judge_routes(mcp):
    """Register judge management routes."""

    @mcp.custom_route("/api/v1/judges", methods=["GET"])
    async def api_list_judges(request):
        """List/search judges."""
        if err := auth.require_auth(request):
            return err
        search = request.query_params.get("search")
        jurisdiction_id = request.query_params.get("jurisdiction_id")
        status = request.query_params.get("status")
        title = request.query_params.get("title")
        limit = int(request.query_params.get("limit", 50))
        offset = int(request.query_params.get("offset", 0))

        result = await asyncio.to_thread(
            db.get_judges,
            search=search,
            jurisdiction_id=int(jurisdiction_id) if jurisdiction_id else None,
            status=status,
            title=title,
            limit=limit,
            offset=offset
        )
        return JSONResponse(result)

    @mcp.custom_route("/api/v1/judges/search", methods=["GET"])
    async def api_search_judges(request):
        """Quick search judges for autocomplete."""
        if err := auth.require_auth(request):
            return err
        name = request.query_params.get("name")
        jurisdiction_id = request.query_params.get("jurisdiction_id")

        judges = await asyncio.to_thread(
            db.search_judges,
            name=name,
            jurisdiction_id=int(jurisdiction_id) if jurisdiction_id else None
        )
        return JSONResponse({"success": True, "judges": judges})

    @mcp.custom_route("/api/v1/judges", methods=["POST"])
    async def api_create_judge(request):
        """Create a new judge."""
        if err := auth.require_auth(request):
            return err
        data = await request.json()
        try:
            result = await asyncio.to_thread(
                db.create_judge,
                name=data["name"],
                phones=data.get("phones"),
                emails=data.get("emails"),
                jurisdiction_id=data.get("jurisdiction_id"),
                chambers=data.get("chambers"),
                courtroom_number=data.get("courtroom_number"),
                appointed_by=data.get("appointed_by"),
                appointed_date=data.get("appointed_date"),
                initials=data.get("initials"),
                status=data.get("status", "Active"),
                notes=data.get("notes"),
                title=data.get("title")
            )
            return JSONResponse({"success": True, "judge": result}, status_code=201)
        except db.ValidationError as e:
            return api_error(str(e), "VALIDATION_ERROR", 400)

    @mcp.custom_route("/api/v1/judges/{judge_id}", methods=["GET"])
    async def api_get_judge(request):
        """Get a specific judge by ID with proceeding assignments."""
        if err := auth.require_auth(request):
            return err
        judge_id = int(request.path_params["judge_id"])
        judge = await asyncio.to_thread(db.get_judge_by_id, judge_id)
        if not judge:
            return api_error("Judge not found", "NOT_FOUND", 404)
        return JSONResponse({"success": True, "judge": judge})

    @mcp.custom_route("/api/v1/judges/{judge_id}", methods=["PUT"])
    async def api_update_judge(request):
        """Update a judge."""
        if err := auth.require_auth(request):
            return err
        judge_id = int(request.path_params["judge_id"])
        data = await request.json()
        try:
            result = await asyncio.to_thread(
                db.update_judge,
                judge_id,
                name=data.get("name", db._NOT_PROVIDED),
                phones=data.get("phones", db._NOT_PROVIDED),
                emails=data.get("emails", db._NOT_PROVIDED),
                jurisdiction_id=data.get("jurisdiction_id", db._NOT_PROVIDED),
                chambers=data.get("chambers", db._NOT_PROVIDED),
                courtroom_number=data.get("courtroom_number", db._NOT_PROVIDED),
                appointed_by=data.get("appointed_by", db._NOT_PROVIDED),
                appointed_date=data.get("appointed_date", db._NOT_PROVIDED),
                initials=data.get("initials", db._NOT_PROVIDED),
                status=data.get("status", db._NOT_PROVIDED),
                notes=data.get("notes", db._NOT_PROVIDED),
                title=data.get("title", db._NOT_PROVIDED)
            )
            if not result:
                return api_error("Judge not found", "NOT_FOUND", 404)
            return JSONResponse({"success": True, "judge": result})
        except db.ValidationError as e:
            return api_error(str(e), "VALIDATION_ERROR", 400)

    @mcp.custom_route("/api/v1/judges/{judge_id}", methods=["DELETE"])
    async def api_delete_judge(request):
        """Delete a judge if not assigned to any proceedings."""
        if err := auth.require_auth(request):
            return err
        judge_id = int(request.path_params["judge_id"])
        result = await asyncio.to_thread(db.delete_judge, judge_id)
        if result.get("success"):
            return JSONResponse({"success": True})
        return api_error(result.get("error", "Cannot delete judge"), "DELETE_ERROR", 400)

    # Proceeding-Judge assignment routes
    @mcp.custom_route("/api/v1/proceedings/{proceeding_id}/judges", methods=["GET"])
    async def api_list_proceeding_judges(request):
        """List judges assigned to a proceeding."""
        if err := auth.require_auth(request):
            return err
        proceeding_id = int(request.path_params["proceeding_id"])
        judges = await asyncio.to_thread(db.get_proceeding_judges, proceeding_id)
        return JSONResponse({"success": True, "judges": judges})

    @mcp.custom_route("/api/v1/proceedings/{proceeding_id}/judges", methods=["POST"])
    async def api_add_judge_to_proceeding(request):
        """Add a judge to a proceeding."""
        if err := auth.require_auth(request):
            return err
        proceeding_id = int(request.path_params["proceeding_id"])
        data = await request.json()

        result = await asyncio.to_thread(
            db.add_judge_to_proceeding,
            proceeding_id=proceeding_id,
            judge_id=data["judge_id"],
            role=data.get("role", "Judge"),
            sort_order=data.get("sort_order")
        )
        return JSONResponse({"success": True, "proceeding_judge": result}, status_code=201)

    @mcp.custom_route("/api/v1/proceedings/{proceeding_id}/judges/{judge_id}", methods=["PUT"])
    async def api_update_proceeding_judge(request):
        """Update a judge's role or sort_order on a proceeding."""
        if err := auth.require_auth(request):
            return err
        proceeding_id = int(request.path_params["proceeding_id"])
        judge_id = int(request.path_params["judge_id"])
        data = await request.json()

        result = await asyncio.to_thread(
            db.update_proceeding_judge,
            proceeding_id=proceeding_id,
            judge_id=judge_id,
            role=data.get("role", db._NOT_PROVIDED),
            sort_order=data.get("sort_order", db._NOT_PROVIDED)
        )
        if not result:
            return api_error("Judge not assigned to this proceeding", "NOT_FOUND", 404)
        return JSONResponse({"success": True, "proceeding_judge": result})

    @mcp.custom_route("/api/v1/proceedings/{proceeding_id}/judges/{judge_id}", methods=["DELETE"])
    async def api_remove_judge_from_proceeding(request):
        """Remove a judge from a proceeding."""
        if err := auth.require_auth(request):
            return err
        proceeding_id = int(request.path_params["proceeding_id"])
        judge_id = int(request.path_params["judge_id"])

        removed = await asyncio.to_thread(db.remove_judge_from_proceeding, proceeding_id, judge_id)
        if removed:
            return JSONResponse({"success": True})
        return api_error("Judge not assigned to this proceeding", "NOT_FOUND", 404)
