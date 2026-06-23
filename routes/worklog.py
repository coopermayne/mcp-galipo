"""
Worklog routes — voice-driven work log.

Phase 1: surface candidates. Phase 2: consolidate (spawns a background thread
and returns immediately, mirroring the intake AI pattern). Phase 3: confirm.
Plus confirmed-only views by case and by person.
"""

import asyncio
import threading

from fastapi.responses import JSONResponse
from pydantic import ValidationError

import db
import auth
from schemas import ConsolidateWorklogInput, ConfirmWorklogInput
from .common import api_error, pydantic_error
from .comments import _get_db_user_id


def register_worklog_routes(mcp):
    """Register worklog (voice-driven work log) routes."""

    @mcp.custom_route("/api/v1/worklog/candidates", methods=["GET"])
    async def api_worklog_candidates(request):
        """Phase 1 — surfaced items (events / tasks done that day / comments)."""
        if err := auth.require_auth(request):
            return err
        user = auth.get_current_user(request)
        user_id = _get_db_user_id(user)
        log_date = request.query_params.get("date")
        result = await asyncio.to_thread(db.get_worklog_candidates, log_date, user_id)
        return JSONResponse(result)

    @mcp.custom_route("/api/v1/worklog/consolidate", methods=["POST"])
    async def api_worklog_consolidate(request):
        """Phase 2 — create a processing log, spawn the AI in a background
        thread, and return immediately."""
        if err := auth.require_auth(request):
            return err
        try:
            data = ConsolidateWorklogInput(**(await request.json()))
        except ValidationError as e:
            return pydantic_error(e)

        user = auth.get_current_user(request)
        user_id = _get_db_user_id(user)

        voice_log_id = await asyncio.to_thread(
            db.create_processing_log, data.transcript, data.log_date, user_id
        )

        # Normalize the (possibly defaulted) date for the worker.
        log = await asyncio.to_thread(db.get_worklog, voice_log_id)
        log_date = log["log_date"] if log else data.log_date
        selections = [s.model_dump() for s in data.selections]

        from services.worklog_consolidator import run_worklog_consolidation
        threading.Thread(
            target=run_worklog_consolidation,
            args=(voice_log_id, data.transcript, log_date, selections, user_id),
            daemon=True,
        ).start()

        return JSONResponse({"voice_log_id": voice_log_id, "status": "processing"})

    @mcp.custom_route("/api/v1/worklog/pending", methods=["GET"])
    async def api_worklog_pending(request):
        """Logs in processing/ready — the 'needs review' list."""
        if err := auth.require_auth(request):
            return err
        user = auth.get_current_user(request)
        user_id = _get_db_user_id(user)
        result = await asyncio.to_thread(db.list_pending_worklogs, user_id)
        return JSONResponse({"worklogs": result})

    @mcp.custom_route("/api/v1/worklog/by-case/{case_id}", methods=["GET"])
    async def api_worklog_by_case(request):
        """Confirmed entries for a case (grouped by day, with a total)."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        result = await asyncio.to_thread(db.get_worklog_by_case, case_id)
        return JSONResponse(result)

    @mcp.custom_route("/api/v1/worklog/by-person/{person_id}", methods=["GET"])
    async def api_worklog_by_person(request):
        """Confirmed entries naming a person (the contact Interactions view)."""
        if err := auth.require_auth(request):
            return err
        person_id = int(request.path_params["person_id"])
        result = await asyncio.to_thread(db.get_worklog_by_person, person_id)
        return JSONResponse(result)

    @mcp.custom_route("/api/v1/worklog/{voice_log_id}", methods=["GET"])
    async def api_worklog_get(request):
        """Poll status + fetch entries (Phase 2 -> 3)."""
        if err := auth.require_auth(request):
            return err
        voice_log_id = int(request.path_params["voice_log_id"])
        result = await asyncio.to_thread(db.get_worklog, voice_log_id)
        if not result:
            return api_error("Worklog not found", "NOT_FOUND", 404)
        return JSONResponse(result)

    @mcp.custom_route("/api/v1/worklog/{voice_log_id}/confirm", methods=["POST"])
    async def api_worklog_confirm(request):
        """Phase 3 — apply edits and mark the log confirmed."""
        if err := auth.require_auth(request):
            return err
        voice_log_id = int(request.path_params["voice_log_id"])
        try:
            data = ConfirmWorklogInput(**(await request.json()))
        except ValidationError as e:
            return pydantic_error(e)
        entries = [e.model_dump() for e in data.entries]
        result = await asyncio.to_thread(
            db.confirm_worklog, voice_log_id, data.transcript, data.log_date, entries
        )
        if not result:
            return api_error("Worklog not found", "NOT_FOUND", 404)
        return JSONResponse(result)

    @mcp.custom_route("/api/v1/worklog/{voice_log_id}", methods=["DELETE"])
    async def api_worklog_delete(request):
        """Discard a log and its entries."""
        if err := auth.require_auth(request):
            return err
        voice_log_id = int(request.path_params["voice_log_id"])
        deleted = await asyncio.to_thread(db.delete_worklog, voice_log_id)
        if deleted:
            return JSONResponse({"success": True})
        return api_error("Worklog not found", "NOT_FOUND", 404)
