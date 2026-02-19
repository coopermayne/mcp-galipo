"""
Intake API routes.

Handles intake CRUD and Google Sheets sync.
"""

import asyncio
import logging

from fastapi.responses import JSONResponse
from pydantic import ValidationError

import db
import auth
from schemas import UpdateIntakeInput
from .common import api_error, pydantic_error, DEFAULT_PAGE_SIZE

logger = logging.getLogger(__name__)


def register_intake_routes(mcp):
    """Register intake management routes."""

    @mcp.custom_route("/api/v1/intakes", methods=["GET"])
    async def api_list_intakes(request):
        """List intakes with optional status filter and pagination."""
        if err := auth.require_auth(request):
            return err
        status = request.query_params.get("status")
        limit = int(request.query_params.get("limit", str(DEFAULT_PAGE_SIZE)))
        offset = int(request.query_params.get("offset", "0"))

        result = await asyncio.to_thread(
            db.get_intakes, status=status, limit=limit, offset=offset
        )
        return JSONResponse(result)

    @mcp.custom_route("/api/v1/intakes/counts", methods=["GET"])
    async def api_intake_counts(request):
        """Get intake counts grouped by status."""
        if err := auth.require_auth(request):
            return err
        counts = await asyncio.to_thread(db.get_intake_status_counts)
        return JSONResponse(counts)

    @mcp.custom_route("/api/v1/intakes/{intake_id}", methods=["GET"])
    async def api_get_intake(request):
        """Get a single intake by ID."""
        if err := auth.require_auth(request):
            return err
        intake_id = int(request.path_params["intake_id"])
        intake = await asyncio.to_thread(db.get_intake_by_id, intake_id)
        if not intake:
            return api_error("Intake not found", "NOT_FOUND", 404)
        return JSONResponse(intake)

    @mcp.custom_route("/api/v1/intakes/{intake_id}", methods=["PUT"])
    async def api_update_intake(request):
        """Update an intake's status and/or notes."""
        if err := auth.require_auth(request):
            return err
        intake_id = int(request.path_params["intake_id"])
        try:
            data = UpdateIntakeInput(**(await request.json()))
        except ValidationError as e:
            return pydantic_error(e)

        updates = data.model_dump(exclude_none=True)
        if not updates:
            return api_error("No fields to update", "NO_CHANGES", 400)

        result = await asyncio.to_thread(db.update_intake, intake_id, **updates)
        if not result:
            return api_error("Intake not found", "NOT_FOUND", 404)
        return JSONResponse({"success": True, "intake": result})

    @mcp.custom_route("/api/v1/intakes/{intake_id}", methods=["DELETE"])
    async def api_delete_intake(request):
        """Delete an intake record."""
        if err := auth.require_auth(request):
            return err
        intake_id = int(request.path_params["intake_id"])
        deleted = await asyncio.to_thread(db.delete_intake, intake_id)
        if not deleted:
            return api_error("Intake not found", "NOT_FOUND", 404)
        return JSONResponse({"success": True})

    @mcp.custom_route("/api/v1/intakes/sync", methods=["POST"])
    async def api_sync_intakes(request):
        """Trigger a sync from Google Sheets."""
        if err := auth.require_auth(request):
            return err
        try:
            from services.google_sheets import fetch_all_rows
            rows = await asyncio.to_thread(fetch_all_rows)
            result = await asyncio.to_thread(db.sync_from_sheet, rows)
            return JSONResponse({"success": True, **result})
        except RuntimeError as e:
            # Config errors (missing credentials/spreadsheet ID)
            return api_error(str(e), "CONFIG_ERROR", 400)
        except Exception as e:
            logger.exception("Google Sheets sync failed")
            return api_error(
                f"Sync failed: {str(e)}", "SYNC_ERROR", 500
            )
