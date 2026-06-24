"""
Worklog routes — voice-driven, editable per-day work log.

Each day is a ledger of entries (the user's own). Entries come from AI
consolidation (async background thread) or manual add, and are editable /
deletable any time, including on past days for backfill.
"""

import asyncio
import threading

from fastapi.responses import JSONResponse
from pydantic import ValidationError

import db
import auth
from schemas import (
    ConsolidateWorklogInput,
    AddWorklogEntryInput,
    UpdateWorklogEntryInput,
)
from .common import api_error, pydantic_error
from .comments import _get_db_user_id


def register_worklog_routes(mcp):
    """Register worklog routes."""

    @mcp.custom_route("/api/v1/worklog/candidates", methods=["GET"])
    async def api_worklog_candidates(request):
        """Surfaced items for a date (events / tasks done / comments), each
        flagged with `already_logged`."""
        if err := auth.require_auth(request):
            return err
        user_id = _get_db_user_id(auth.get_current_user(request))
        log_date = request.query_params.get("date")
        result = await asyncio.to_thread(db.get_worklog_candidates, log_date, user_id)
        return JSONResponse(result)

    @mcp.custom_route("/api/v1/worklog/day", methods=["GET"])
    async def api_worklog_day(request):
        """The current user's ledger for a date (entries earliest->latest,
        total, in-flight consolidation ids)."""
        if err := auth.require_auth(request):
            return err
        user_id = _get_db_user_id(auth.get_current_user(request))
        log_date = request.query_params.get("date")
        result = await asyncio.to_thread(db.get_worklog_day, log_date, user_id)
        return JSONResponse(result)

    @mcp.custom_route("/api/v1/worklog/consolidate", methods=["POST"])
    async def api_worklog_consolidate(request):
        """Create a processing log, record the selected sources, spawn the AI in
        a background thread, and return immediately. Entries land in the day."""
        if err := auth.require_auth(request):
            return err
        try:
            data = ConsolidateWorklogInput(**(await request.json()))
        except ValidationError as e:
            return pydantic_error(e)

        user_id = _get_db_user_id(auth.get_current_user(request))
        selections = [s.model_dump() for s in data.selections]

        voice_log_id = await asyncio.to_thread(
            db.create_processing_log, data.transcript, data.log_date, user_id, selections
        )
        log = await asyncio.to_thread(db.get_worklog, voice_log_id)
        log_date = log["log_date"] if log else data.log_date

        from services.worklog_consolidator import run_worklog_consolidation
        threading.Thread(
            target=run_worklog_consolidation,
            args=(voice_log_id, data.transcript, log_date, selections, user_id),
            daemon=True,
        ).start()

        return JSONResponse({"voice_log_id": voice_log_id, "status": "processing"})

    @mcp.custom_route("/api/v1/worklog/entries", methods=["POST"])
    async def api_worklog_add_entry(request):
        """Manually add an entry to a day."""
        if err := auth.require_auth(request):
            return err
        try:
            data = AddWorklogEntryInput(**(await request.json()))
        except ValidationError as e:
            return pydantic_error(e)
        user_id = _get_db_user_id(auth.get_current_user(request))
        result = await asyncio.to_thread(
            db.add_manual_entry, data.log_date, user_id, data.case_id,
            data.minutes, data.description, data.person_ids,
        )
        return JSONResponse(result)

    @mcp.custom_route("/api/v1/worklog/entries/{entry_id}", methods=["PATCH"])
    async def api_worklog_update_entry(request):
        """Edit an entry (any day)."""
        if err := auth.require_auth(request):
            return err
        entry_id = int(request.path_params["entry_id"])
        try:
            data = UpdateWorklogEntryInput(**(await request.json()))
        except ValidationError as e:
            return pydantic_error(e)
        fields = data.model_dump(exclude_unset=True)
        result = await asyncio.to_thread(db.update_worklog_entry, entry_id, fields)
        if not result:
            return api_error("Entry not found", "NOT_FOUND", 404)
        return JSONResponse(result)

    @mcp.custom_route("/api/v1/worklog/entries/{entry_id}", methods=["DELETE"])
    async def api_worklog_delete_entry(request):
        """Delete an entry."""
        if err := auth.require_auth(request):
            return err
        entry_id = int(request.path_params["entry_id"])
        deleted = await asyncio.to_thread(db.delete_worklog_entry, entry_id)
        if deleted:
            return JSONResponse({"success": True})
        return api_error("Entry not found", "NOT_FOUND", 404)

    @mcp.custom_route("/api/v1/worklog/by-case/{case_id}", methods=["GET"])
    async def api_worklog_by_case(request):
        """Worklog entries for a case (grouped by day, with a total)."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        result = await asyncio.to_thread(db.get_worklog_by_case, case_id)
        return JSONResponse(result)

    @mcp.custom_route("/api/v1/worklog/by-person/{person_id}", methods=["GET"])
    async def api_worklog_by_person(request):
        """Worklog entries naming a person (the contact Interactions view)."""
        if err := auth.require_auth(request):
            return err
        person_id = int(request.path_params["person_id"])
        result = await asyncio.to_thread(db.get_worklog_by_person, person_id)
        return JSONResponse(result)

    @mcp.custom_route("/api/v1/worklog/{voice_log_id}", methods=["GET"])
    async def api_worklog_get(request):
        """Poll a consolidation session's status + entries."""
        if err := auth.require_auth(request):
            return err
        voice_log_id = int(request.path_params["voice_log_id"])
        result = await asyncio.to_thread(db.get_worklog, voice_log_id)
        if not result:
            return api_error("Worklog not found", "NOT_FOUND", 404)
        return JSONResponse(result)
