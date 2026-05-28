"""
Intake API routes.

Handles intake CRUD, Google Sheets sync, comments, and AI analysis.
"""

import asyncio
import logging
import threading

from fastapi.responses import JSONResponse
from pydantic import ValidationError

import db
import auth
from schemas import UpdateIntakeInput, CreateIntakeInput, CreateIntakeCommentInput, CreateInteractionInput, SaveInteractionInput
from schemas.common import INTAKE_TRANSITIONS
from .common import api_error, pydantic_error, clamp_pagination
from .comments import _get_db_user_id
from .sse import broadcast

logger = logging.getLogger(__name__)


def register_intake_routes(mcp):
    """Register intake management routes."""

    @mcp.custom_route("/api/v1/intakes", methods=["GET"])
    async def api_list_intakes(request):
        """List intakes with optional status filter and pagination."""
        if err := auth.require_auth(request):
            return err
        status = request.query_params.get("status")
        limit, offset = clamp_pagination(request)
        exclude_archived = request.query_params.get("exclude_archived", "").lower() == "true"

        result = await asyncio.to_thread(
            db.get_intakes, status=status, limit=limit, offset=offset,
            exclude_archived=exclude_archived,
        )
        return JSONResponse(result)

    @mcp.custom_route("/api/v1/intakes", methods=["POST"])
    async def api_create_intake(request):
        """Create a new intake (manual entry)."""
        if err := auth.require_auth(request):
            return err
        user = auth.get_current_user(request)
        user_id = user["id"] if user else 0
        db_user_id = _get_db_user_id(user)

        try:
            data = CreateIntakeInput(**(await request.json()))
        except ValidationError as e:
            return pydantic_error(e)

        result = await asyncio.to_thread(
            db.create_intake, **data.model_dump(exclude_none=True)
        )

        # Log creation event
        await asyncio.to_thread(
            db.add_intake_comment,
            result["id"], db_user_id,
            "Intake created via web form",
            True,  # is_system
        )

        broadcast({
            "entity": "intake", "action": "created",
            "id": result["id"], "intake_id": result["id"], "user_id": user_id,
        })

        # AI analysis is auto-triggered by the SQLAlchemy after_insert event listener
        return JSONResponse({"success": True, "intake": result}, status_code=201)

    @mcp.custom_route("/api/v1/intakes/counts", methods=["GET"])
    async def api_intake_counts(request):
        """Get intake counts grouped by status."""
        if err := auth.require_auth(request):
            return err
        counts = await asyncio.to_thread(db.get_intake_status_counts)
        return JSONResponse(counts)

    @mcp.custom_route("/api/v1/intakes/extract", methods=["POST"])
    async def api_extract_intake(request):
        """Extract structured intake fields from raw text using AI."""
        if err := auth.require_auth(request):
            return err

        try:
            body = await request.json()
        except Exception:
            return api_error("Invalid JSON body", "BAD_REQUEST", 400)

        text = body.get("text", "").strip()
        if not text:
            return api_error("Text is required", "VALIDATION_ERROR", 400)

        try:
            from services.intake_extractor import extract_intake_info
            fields = await asyncio.to_thread(extract_intake_info, text)
            return JSONResponse({"success": True, "fields": fields})
        except ValueError as e:
            return api_error(str(e), "EXTRACTION_ERROR", 400)
        except Exception as e:
            logger.exception("Intake extraction failed")
            return api_error(f"Extraction failed: {str(e)}", "EXTRACTION_ERROR", 500)

    # --- Activity feed (registered BEFORE {intake_id} wildcard) ---

    @mcp.custom_route("/api/v1/intakes/activity", methods=["GET"])
    async def api_intake_activity(request):
        """Get recent activity (system comments) across all intakes."""
        if err := auth.require_auth(request):
            return err
        limit = int(request.query_params.get("limit", "50"))
        activity = await asyncio.to_thread(db.get_recent_activity, limit)
        return JSONResponse(activity)

    # --- Comment routes (registered BEFORE {intake_id} wildcard) ---

    @mcp.custom_route("/api/v1/intakes/unread-counts", methods=["GET"])
    async def api_intake_unread_counts(request):
        """Get unread comment counts for the current user."""
        if err := auth.require_auth(request):
            return err
        user = auth.get_current_user(request)
        if not user:
            return api_error("User not found", "UNAUTHORIZED", 401)

        ids_param = request.query_params.getlist("ids")
        intake_ids = [int(i) for i in ids_param if i.isdigit()]
        if not intake_ids:
            return JSONResponse({})

        counts = await asyncio.to_thread(
            db.get_unread_counts, user["id"], intake_ids
        )
        # JSON keys must be strings
        return JSONResponse({str(k): v for k, v in counts.items()})

    # --- Transitions map (registered BEFORE {intake_id} wildcard) ---

    @mcp.custom_route("/api/v1/intakes/transitions", methods=["GET"])
    async def api_intake_transitions(request):
        """Get the allowed status transitions map."""
        if err := auth.require_auth(request):
            return err
        return JSONResponse(INTAKE_TRANSITIONS)

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

    @mcp.custom_route("/api/v1/intakes/{intake_id}/link-case", methods=["POST"])
    async def api_link_intake_to_case(request):
        """Link an existing case to this intake."""
        if err := auth.require_auth(request):
            return err
        intake_id = int(request.path_params["intake_id"])
        user = auth.get_current_user(request)
        user_id = user["id"] if user else 0

        body = await request.json()
        case_id = body.get("case_id")
        if case_id is None:
            return api_error("case_id is required", "VALIDATION_ERROR", 400)

        try:
            result = await asyncio.to_thread(
                db.link_intake_to_case, intake_id, int(case_id)
            )
        except db.IntakeLinkError as e:
            return api_error(str(e), "ALREADY_LINKED", 400)
        if not result:
            return api_error("Intake or case not found", "NOT_FOUND", 404)

        # Log the link as a system comment
        name = user.get("firstName", "Someone") if user else "System"
        await asyncio.to_thread(
            db.add_intake_comment,
            intake_id,
            _get_db_user_id(user),
            f"{name} linked this intake to case '{result.get('case_name') or case_id}'",
            True,  # is_system
        )

        broadcast({
            "entity": "intake", "action": "updated",
            "id": intake_id, "intake_id": intake_id, "user_id": user_id,
        })
        broadcast({"entity": "case", "action": "updated", "id": int(case_id)})
        return JSONResponse({"success": True, "intake": result})

    @mcp.custom_route("/api/v1/intakes/{intake_id}", methods=["PUT"])
    async def api_update_intake(request):
        """Update an intake's status and/or notes."""
        if err := auth.require_auth(request):
            return err
        intake_id = int(request.path_params["intake_id"])
        user = auth.get_current_user(request)
        user_id = user["id"] if user else 0

        try:
            data = UpdateIntakeInput(**(await request.json()))
        except ValidationError as e:
            return pydantic_error(e)

        updates = data.model_dump(exclude_none=True)
        if not updates:
            return api_error("No fields to update", "NO_CHANGES", 400)

        # If status is changing, create a system comment
        if "status" in updates:
            old_intake = await asyncio.to_thread(db.get_intake_by_id, intake_id)
            if old_intake and old_intake["status"] != updates["status"]:
                old_status = old_intake["status"]
                new_status = updates["status"]

                if user:
                    name = user.get("firstName", "Someone")
                    msg = f"{name} changed status from {old_status} to {new_status}"
                    await asyncio.to_thread(
                        db.add_intake_comment,
                        intake_id,
                        _get_db_user_id(user),
                        msg,
                        True,  # is_system
                    )

        result = await asyncio.to_thread(db.update_intake, intake_id, **updates)
        if not result:
            return api_error("Intake not found", "NOT_FOUND", 404)

        # Re-run AI analysis when location changes (regenerates location_short)
        if "location" in updates:
            from services.intake_ai import run_background_analysis
            threading.Thread(
                target=run_background_analysis,
                args=(intake_id,),
                daemon=True,
            ).start()

        broadcast({
            "entity": "intake", "action": "updated",
            "id": intake_id, "intake_id": intake_id, "user_id": user_id,
        })
        return JSONResponse({"success": True, "intake": result})

    @mcp.custom_route("/api/v1/intakes/bulk-archive", methods=["POST"])
    async def api_bulk_archive_intakes(request):
        """Archive all intakes with a given status."""
        if err := auth.require_auth(request):
            return err
        user = auth.get_current_user(request)
        user_id = user["id"] if user else 0

        body = await request.json()
        status = body.get("status")
        if not status:
            return api_error("status is required", "VALIDATION_ERROR", 400)

        archived_ids = await asyncio.to_thread(db.bulk_archive_by_status, status)

        # Create system comments for each archived intake
        if user and archived_ids:
            name = user.get("firstName", "Someone")
            msg = f"{name} changed status from {status} to Archived"
            for intake_id in archived_ids:
                await asyncio.to_thread(
                    db.add_intake_comment, intake_id, _get_db_user_id(user), msg, True
                )

        if archived_ids:
            broadcast({
                "entity": "intake", "action": "bulk-archived",
                "ids": archived_ids, "user_id": user_id,
            })

        return JSONResponse({"success": True, "count": len(archived_ids)})

    @mcp.custom_route("/api/v1/intakes/{intake_id}", methods=["DELETE"])
    async def api_delete_intake(request):
        """Delete an intake record."""
        if err := auth.require_auth(request):
            return err
        intake_id = int(request.path_params["intake_id"])
        user = auth.get_current_user(request)
        user_id = user["id"] if user else 0

        deleted = await asyncio.to_thread(db.delete_intake, intake_id)
        if not deleted:
            return api_error("Intake not found", "NOT_FOUND", 404)

        broadcast({
            "entity": "intake", "action": "deleted",
            "id": intake_id, "intake_id": intake_id, "user_id": user_id,
        })
        return JSONResponse({"success": True})

    @mcp.custom_route("/api/v1/intakes/{intake_id}/comments", methods=["GET"])
    async def api_list_intake_comments(request):
        """List all comments for an intake, with the user's last_read_at."""
        if err := auth.require_auth(request):
            return err
        intake_id = int(request.path_params["intake_id"])
        user = auth.get_current_user(request)
        user_id = user["id"] if user else 0
        comments = await asyncio.to_thread(db.get_intake_comments, intake_id)
        last_read_at = await asyncio.to_thread(db.get_last_read_at, intake_id, user_id)
        return JSONResponse({"comments": comments, "last_read_at": last_read_at})

    @mcp.custom_route("/api/v1/intakes/{intake_id}/comments", methods=["POST"])
    async def api_add_intake_comment(request):
        """Add a comment to an intake."""
        if err := auth.require_auth(request):
            return err
        intake_id = int(request.path_params["intake_id"])
        user = auth.get_current_user(request)
        if not user:
            return api_error("User not found", "UNAUTHORIZED", 401)

        try:
            data = CreateIntakeCommentInput(**(await request.json()))
        except ValidationError as e:
            return pydantic_error(e)

        db_user_id = _get_db_user_id(user)
        comment = await asyncio.to_thread(
            db.add_intake_comment, intake_id, db_user_id, data.content
        )

        broadcast({
            "entity": "intake_comment", "action": "created",
            "id": comment.get("id"), "intake_id": intake_id, "user_id": db_user_id,
        })
        return JSONResponse(comment, status_code=201)

    @mcp.custom_route("/api/v1/intakes/{intake_id}/interactions/summarize", methods=["POST"])
    async def api_summarize_interaction(request):
        """Generate an AI summary for an interaction (preview step)."""
        if err := auth.require_auth(request):
            return err
        intake_id = int(request.path_params["intake_id"])

        try:
            data = CreateInteractionInput(**(await request.json()))
        except ValidationError as e:
            return pydantic_error(e)

        # Fetch intake context for smarter summarization
        intake = await asyncio.to_thread(db.get_intake_by_id, intake_id)
        intake_context = None
        if intake:
            intake_context = {
                k: intake.get(k)
                for k in ("case_type", "incident_description", "injury_description", "ai_summary", "notes")
            }

        try:
            from services.interaction_summarizer import summarize_interaction
            summary = await asyncio.to_thread(
                summarize_interaction,
                data.content,
                data.interaction_type,
                data.direction,
                intake_context,
            )
        except Exception as e:
            logger.exception("Interaction summarization failed")
            return api_error(f"Summarization failed: {str(e)}", "SUMMARIZATION_ERROR", 500)

        return JSONResponse({"summary": summary})

    @mcp.custom_route("/api/v1/intakes/{intake_id}/interactions", methods=["POST"])
    async def api_save_interaction(request):
        """Save a logged interaction with user-approved summary."""
        if err := auth.require_auth(request):
            return err
        intake_id = int(request.path_params["intake_id"])
        user = auth.get_current_user(request)
        if not user:
            return api_error("User not found", "UNAUTHORIZED", 401)

        try:
            data = SaveInteractionInput(**(await request.json()))
        except ValidationError as e:
            return pydantic_error(e)

        # Build display content from user-approved summary
        user_name = user.get("firstName", "Someone")
        direction_label = f" ({data.direction})" if data.direction else ""
        content = f"{user_name} logged {data.interaction_type}{direction_label}: {data.summary}"

        detail = {
            "type": "interaction",
            "interaction_type": data.interaction_type,
            "direction": data.direction,
            "full_content": data.content,
            "user_name": user_name,
        }

        comment = await asyncio.to_thread(
            db.add_intake_comment,
            intake_id, user["id"], content,
            True,  # is_system
            detail,
        )

        broadcast({
            "entity": "intake_comment", "action": "created",
            "id": comment.get("id"), "intake_id": intake_id, "user_id": user["id"],
        })
        return JSONResponse(comment, status_code=201)

    @mcp.custom_route("/api/v1/intakes/{intake_id}/read", methods=["POST"])
    async def api_mark_intake_read(request):
        """Mark all comments as read for the current user."""
        if err := auth.require_auth(request):
            return err
        intake_id = int(request.path_params["intake_id"])
        user = auth.get_current_user(request)
        if not user:
            return api_error("User not found", "UNAUTHORIZED", 401)

        await asyncio.to_thread(db.mark_intake_read, intake_id, user["id"])
        return JSONResponse({"success": True})

    @mcp.custom_route("/api/v1/intakes/{intake_id}/analyze", methods=["POST"])
    async def api_analyze_single_intake(request):
        """Run AI analysis on a single intake (non-blocking).

        Returns 202 immediately and runs analysis in a background thread.
        The analysis pipeline handles SSE broadcasts internally.
        """
        if err := auth.require_auth(request):
            return err
        intake_id = int(request.path_params["intake_id"])

        intake = await asyncio.to_thread(db.get_intake_by_id, intake_id)
        if not intake:
            return api_error("Intake not found", "NOT_FOUND", 404)

        from services.intake_ai import run_background_analysis
        threading.Thread(
            target=run_background_analysis,
            args=(intake_id,),
            daemon=True,
        ).start()
        return JSONResponse({"success": True, "message": "Analysis started"}, status_code=202)

    @mcp.custom_route("/api/v1/intakes/sync", methods=["POST"])
    async def api_sync_intakes(request):
        """Trigger a sync from Google Sheets."""
        if err := auth.require_auth(request):
            return err
        user = auth.get_current_user(request)
        user_id = user["id"] if user else 0

        try:
            from services.google_sheets import fetch_all_rows
            rows = await asyncio.to_thread(fetch_all_rows)
            result = await asyncio.to_thread(db.sync_from_sheet, rows)

            broadcast({
                "entity": "intake", "action": "synced",
                "id": None, "intake_id": None, "user_id": user_id,
            })

            # AI analysis is auto-triggered by the SQLAlchemy after_insert event listener
            return JSONResponse({"success": True, **{k: v for k, v in result.items() if k != "new_intake_ids"}})
        except RuntimeError as e:
            # Config errors (missing credentials/spreadsheet ID)
            return api_error(str(e), "CONFIG_ERROR", 400)
        except Exception as e:
            logger.exception("Google Sheets sync failed")
            return api_error(
                f"Sync failed: {str(e)}", "SYNC_ERROR", 500
            )
