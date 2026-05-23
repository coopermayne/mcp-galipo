"""
"Dale view" routes — read-only, mobile-first endpoints for a non-tech-savvy
user (the boss) who browses cases + the trial calendar and leaves voice-
transcribed comments.

These endpoints intentionally mirror the data shape of the full-app endpoints
so the Dale frontend can reuse types. The only Dale-specific behavior is:

- A simpler /api/v1/dale/cases listing (essential fields only).
- A flat /api/v1/dale/calendar feed of upcoming trial dates.
- /api/v1/dale/comments tags new comments with detail.source = "dale_voice"
  so staff can distinguish them in the main app's comments UI.
"""

import asyncio

from fastapi.responses import JSONResponse
from pydantic import BaseModel

import auth
from db.cases import get_all_cases, get_case_by_id
from db.comments import get_comments, add_comment
from db.trial_calendar import get_trial_calendar
from .common import api_error
from .sse import broadcast


DALE_VOICE_SOURCE = "dale_voice"
ALLOWED_COMMENT_ENTITY_TYPES = {"case", "event", "task"}


class CreateDaleCommentInput(BaseModel):
    content: str


def _get_db_user_id(user: dict | None) -> int | None:
    """Return user ID only if it's a real DB user (not legacy id=0)."""
    if not user:
        return None
    uid = user.get("id")
    return uid if uid and uid > 0 else None


def register_dale_routes(mcp):
    """Register the Dale-view API routes."""

    @mcp.custom_route("/api/v1/dale/cases", methods=["GET"])
    async def api_dale_list_cases(request):
        """Read-only list of cases for the Dale view.

        Excludes closed cases by default. Returns a trimmed projection of
        the full case list — enough for big-tap cards.
        """
        if err := auth.require_auth(request):
            return err

        # Reuse the main case listing. Default to excluding closed cases.
        result = await asyncio.to_thread(
            get_all_cases,
            status_filter=None,
            limit=None,
            offset=None,
        )
        cases = result.get("cases", []) if isinstance(result, dict) else result
        trimmed = [
            {
                "id": c.get("id"),
                "case_name": c.get("case_name"),
                "short_name": c.get("short_name"),
                "status": c.get("status"),
                "color": c.get("color"),
                "trial_date": c.get("trial_date"),
                "date_of_injury": c.get("date_of_injury"),
            }
            for c in cases
            if c.get("status") != "Closed"
        ]
        return JSONResponse({"cases": trimmed})

    @mcp.custom_route("/api/v1/dale/cases/{case_id}", methods=["GET"])
    async def api_dale_case_detail(request):
        """Full case detail for the Dale view (same shape as the main app)."""
        if err := auth.require_auth(request):
            return err

        try:
            case_id = int(request.path_params["case_id"])
        except (TypeError, ValueError):
            return api_error("Invalid case id", "VALIDATION_ERROR", 400)

        case = await asyncio.to_thread(get_case_by_id, case_id)
        if not case:
            return api_error("Case not found", "NOT_FOUND", 404)
        return JSONResponse(case)

    @mcp.custom_route("/api/v1/dale/calendar", methods=["GET"])
    async def api_dale_calendar(request):
        """Upcoming trial dates + blocking events for the Dale view.

        Thin wrapper around the existing trial_calendar query.
        """
        if err := auth.require_auth(request):
            return err

        months_ahead = int(request.query_params.get("months_ahead", "6"))
        months_behind = int(request.query_params.get("months_behind", "0"))

        data = await asyncio.to_thread(
            get_trial_calendar, months_ahead, months_behind
        )
        return JSONResponse(data)

    @mcp.custom_route(
        "/api/v1/dale/comments/{entity_type}/{entity_id}", methods=["GET"]
    )
    async def api_dale_list_comments(request):
        """Read comments on an entity (for showing past notes in Dale view)."""
        if err := auth.require_auth(request):
            return err

        entity_type = request.path_params["entity_type"]
        if entity_type not in ALLOWED_COMMENT_ENTITY_TYPES:
            return api_error("Invalid entity type", "VALIDATION_ERROR", 400)

        try:
            entity_id = int(request.path_params["entity_id"])
        except (TypeError, ValueError):
            return api_error("Invalid entity id", "VALIDATION_ERROR", 400)

        comments = await asyncio.to_thread(get_comments, entity_type, entity_id)
        return JSONResponse({"comments": comments})

    @mcp.custom_route(
        "/api/v1/dale/comments/{entity_type}/{entity_id}", methods=["POST"]
    )
    async def api_dale_create_comment(request):
        """Create a voice-sourced comment from the Dale view.

        Tags the comment with detail.source = "dale_voice" so staff can
        identify it in the main comments UI.
        """
        if err := auth.require_auth(request):
            return err
        user = auth.get_current_user(request)
        user_id = _get_db_user_id(user)
        if not user_id:
            return api_error("User not found", "UNAUTHORIZED", 401)

        entity_type = request.path_params["entity_type"]
        if entity_type not in ALLOWED_COMMENT_ENTITY_TYPES:
            return api_error("Invalid entity type", "VALIDATION_ERROR", 400)

        try:
            entity_id = int(request.path_params["entity_id"])
        except (TypeError, ValueError):
            return api_error("Invalid entity id", "VALIDATION_ERROR", 400)

        try:
            data = CreateDaleCommentInput(**(await request.json()))
        except Exception:
            return api_error("content is required", "VALIDATION_ERROR", 400)

        content = data.content.strip()
        if not content:
            return api_error("content is required", "VALIDATION_ERROR", 400)

        comment = await asyncio.to_thread(
            add_comment,
            entity_type,
            entity_id,
            user_id,
            content,
            False,
            {"source": DALE_VOICE_SOURCE},
        )
        broadcast({
            "entity": "comment",
            "action": "created",
            "id": comment.get("id"),
            "entity_type": entity_type,
            "entity_id": entity_id,
            "user_id": user_id,
        })
        return JSONResponse({"comment": comment})
