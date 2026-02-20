"""
Intake API routes.

Handles intake CRUD, Google Sheets sync, comments, and SSE streaming.
"""

import asyncio
import logging

from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import ValidationError

import db
import auth
from schemas import UpdateIntakeInput, CreateIntakeInput, CreateIntakeCommentInput
from .common import api_error, pydantic_error, DEFAULT_PAGE_SIZE
from .sse import broadcast, sse_generator, add_client, remove_client

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

    @mcp.custom_route("/api/v1/intakes", methods=["POST"])
    async def api_create_intake(request):
        """Create a new intake (manual entry)."""
        if err := auth.require_auth(request):
            return err
        user = auth.get_current_user(request)
        user_id = user["id"] if user else 0

        try:
            data = CreateIntakeInput(**(await request.json()))
        except ValidationError as e:
            return pydantic_error(e)

        result = await asyncio.to_thread(
            db.create_intake, **data.model_dump(exclude_none=True)
        )

        broadcast({
            "entity": "intake", "action": "created",
            "id": result["id"], "intake_id": result["id"], "user_id": user_id,
        })
        return JSONResponse({"success": True, "intake": result}, status_code=201)

    @mcp.custom_route("/api/v1/intakes/counts", methods=["GET"])
    async def api_intake_counts(request):
        """Get intake counts grouped by status."""
        if err := auth.require_auth(request):
            return err
        counts = await asyncio.to_thread(db.get_intake_status_counts)
        return JSONResponse(counts)

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

    # --- SSE stream (registered BEFORE {intake_id} wildcard) ---

    @mcp.custom_route("/api/v1/intakes/stream", methods=["GET"])
    async def api_intake_stream(request):
        """SSE stream for real-time intake updates.

        Auth via ?token= query param since EventSource can't set headers.
        """
        # Auth via query param (EventSource can't set headers)
        if not auth.DEV_SKIP_AUTH:
            token = request.query_params.get("token")
            if not token:
                token = auth.get_token_from_request(request)
            if not token or not auth.validate_session(token):
                return JSONResponse(
                    {"error": "Authentication required"}, status_code=401
                )

        queue = add_client()

        async def event_stream():
            try:
                async for chunk in sse_generator(queue):
                    yield chunk
            finally:
                remove_client(queue)

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )

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
                if user:
                    name = user.get("firstName", "Someone")
                    msg = f"{name} changed status from {old_intake['status']} to {updates['status']}"
                    await asyncio.to_thread(
                        db.add_intake_comment,
                        intake_id,
                        user["id"],
                        msg,
                        True,  # is_system
                    )

        result = await asyncio.to_thread(db.update_intake, intake_id, **updates)
        if not result:
            return api_error("Intake not found", "NOT_FOUND", 404)

        broadcast({
            "entity": "intake", "action": "updated",
            "id": intake_id, "intake_id": intake_id, "user_id": user_id,
        })
        return JSONResponse({"success": True, "intake": result})

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
        """List all comments for an intake."""
        if err := auth.require_auth(request):
            return err
        intake_id = int(request.path_params["intake_id"])
        comments = await asyncio.to_thread(db.get_intake_comments, intake_id)
        return JSONResponse(comments)

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

        comment = await asyncio.to_thread(
            db.add_intake_comment, intake_id, user["id"], data.content
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

    @mcp.custom_route("/api/v1/intakes/analyze", methods=["POST"])
    async def api_analyze_intakes(request):
        """Run AI analysis on intakes that haven't been analyzed yet."""
        if err := auth.require_auth(request):
            return err
        user = auth.get_current_user(request)
        user_id = user["id"] if user else 0

        try:
            body = await request.json()
        except Exception:
            body = {}
        limit = int(body.get("limit", 20))
        reanalyze = bool(body.get("reanalyze", False))

        try:
            from services.intake_ai import analyze_intake
            ids = await asyncio.to_thread(db.get_unanalyzed_intake_ids, limit, reanalyze)
            analyzed = 0
            errors = 0
            for intake_id in ids:
                intake = await asyncio.to_thread(db.get_intake_by_id, intake_id)
                if not intake:
                    continue
                try:
                    result = await asyncio.to_thread(analyze_intake, intake)
                    await asyncio.to_thread(
                        db.save_ai_analysis,
                        intake_id,
                        result["ai_summary"],
                        result["ai_rating"],
                        result["ai_rating_reasoning"],
                    )
                    analyzed += 1
                except Exception as e:
                    logger.warning("AI analysis failed for intake %d: %s", intake_id, e)
                    errors += 1

            if analyzed > 0:
                broadcast({
                    "entity": "intake", "action": "analyzed",
                    "id": None, "intake_id": None, "user_id": user_id,
                })

            return JSONResponse({
                "success": True,
                "analyzed": analyzed,
                "errors": errors,
                "remaining": max(0, len(ids) - analyzed),
            })
        except RuntimeError as e:
            return api_error(str(e), "CONFIG_ERROR", 400)
        except Exception as e:
            logger.exception("AI analysis batch failed")
            return api_error(f"Analysis failed: {str(e)}", "ANALYSIS_ERROR", 500)

    @mcp.custom_route("/api/v1/intakes/{intake_id}/analyze", methods=["POST"])
    async def api_analyze_single_intake(request):
        """Run AI analysis on a single intake."""
        if err := auth.require_auth(request):
            return err
        intake_id = int(request.path_params["intake_id"])

        intake = await asyncio.to_thread(db.get_intake_by_id, intake_id)
        if not intake:
            return api_error("Intake not found", "NOT_FOUND", 404)

        try:
            from services.intake_ai import analyze_intake
            result = await asyncio.to_thread(analyze_intake, intake)
            updated = await asyncio.to_thread(
                db.save_ai_analysis,
                intake_id,
                result["ai_summary"],
                result["ai_rating"],
                result["ai_rating_reasoning"],
            )
            broadcast({
                "entity": "intake", "action": "analyzed",
                "id": intake_id, "intake_id": intake_id,
            })
            return JSONResponse(updated or result)
        except RuntimeError as e:
            return api_error(str(e), "CONFIG_ERROR", 400)
        except Exception as e:
            logger.exception("AI analysis failed for intake %d", intake_id)
            return api_error(f"Analysis failed: {str(e)}", "ANALYSIS_ERROR", 500)

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

            return JSONResponse({"success": True, **result})
        except RuntimeError as e:
            # Config errors (missing credentials/spreadsheet ID)
            return api_error(str(e), "CONFIG_ERROR", 400)
        except Exception as e:
            logger.exception("Google Sheets sync failed")
            return api_error(
                f"Sync failed: {str(e)}", "SYNC_ERROR", 500
            )
