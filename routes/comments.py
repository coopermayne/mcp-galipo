"""
Polymorphic comment routes — works with any entity type.

Endpoints:
    GET  /api/v1/comments/unread-counts/{entity_type}?ids=1&ids=2
    GET  /api/v1/comments/{entity_type}/{entity_id}
    POST /api/v1/comments/{entity_type}/{entity_id}
    POST /api/v1/comments/{entity_type}/{entity_id}/read
"""

import asyncio
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import auth
from db.comments import get_comments, add_comment, get_last_read_at, mark_read, get_unread_counts
from .common import api_error
from .sse import broadcast


def _get_db_user_id(user: dict | None) -> int | None:
    """Return user ID only if it's a real DB user (not legacy id=0)."""
    if not user:
        return None
    uid = user.get("id")
    return uid if uid and uid > 0 else None


class CreateCommentInput(BaseModel):
    content: str


def register_comment_routes(mcp):

    @mcp.custom_route(
        "/api/v1/comments/unread-counts/{entity_type}", methods=["GET"]
    )
    async def api_comment_unread_counts(request):
        if err := auth.require_auth(request):
            return err
        user = auth.get_current_user(request)
        user_id = _get_db_user_id(user)
        if not user_id:
            return JSONResponse({})

        entity_type = request.path_params["entity_type"]
        ids_param = request.query_params.getlist("ids")
        entity_ids = [int(i) for i in ids_param if i.isdigit()]
        if not entity_ids:
            return JSONResponse({})

        counts = await asyncio.to_thread(
            get_unread_counts, user_id, entity_type, entity_ids
        )
        return JSONResponse({str(k): v for k, v in counts.items()})

    @mcp.custom_route(
        "/api/v1/comments/{entity_type}/{entity_id}", methods=["GET"]
    )
    async def api_list_comments(request):
        if err := auth.require_auth(request):
            return err
        user = auth.get_current_user(request)
        user_id = _get_db_user_id(user)

        entity_type = request.path_params["entity_type"]
        entity_id = int(request.path_params["entity_id"])

        comments = await asyncio.to_thread(get_comments, entity_type, entity_id)
        last_read = None
        if user_id:
            last_read = await asyncio.to_thread(
                get_last_read_at, entity_type, entity_id, user_id
            )

        return JSONResponse({"comments": comments, "last_read_at": last_read})

    @mcp.custom_route(
        "/api/v1/comments/{entity_type}/{entity_id}", methods=["POST"]
    )
    async def api_create_comment(request):
        if err := auth.require_auth(request):
            return err
        user = auth.get_current_user(request)
        if not user:
            return api_error("User not found", "UNAUTHORIZED", 401)

        entity_type = request.path_params["entity_type"]
        entity_id = int(request.path_params["entity_id"])

        try:
            data = CreateCommentInput(**(await request.json()))
        except Exception:
            return api_error("content is required", "VALIDATION_ERROR", 400)

        user_id = _get_db_user_id(user)
        comment = await asyncio.to_thread(
            add_comment, entity_type, entity_id, user_id, data.content
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

    @mcp.custom_route(
        "/api/v1/comments/{entity_type}/{entity_id}/read", methods=["POST"]
    )
    async def api_mark_comment_read(request):
        if err := auth.require_auth(request):
            return err
        user = auth.get_current_user(request)
        user_id = _get_db_user_id(user)
        if not user_id:
            return JSONResponse({"success": True})

        entity_type = request.path_params["entity_type"]
        entity_id = int(request.path_params["entity_id"])

        await asyncio.to_thread(mark_read, entity_type, entity_id, user_id)
        return JSONResponse({"success": True})
