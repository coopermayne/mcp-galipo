"""
Document-tracking checklist routes (the "Document Tracking" card).

All endpoints are scoped to a case and gated behind the case's `documents`
feature toggle. The per-item activity log is the polymorphic comment system
(entity_type="checklist_item"), reached here via db.checklist helpers so the
frontend only ever deals in item keys.

Endpoints:
    GET    /api/v1/cases/{case_id}/checklist
    PUT    /api/v1/cases/{case_id}/checklist/item        body: {item_key, status?, notes?}
    POST   /api/v1/cases/{case_id}/checklist/custom      body: {label}
    DELETE /api/v1/cases/{case_id}/checklist/item?key=…
    GET    /api/v1/cases/{case_id}/checklist/comments?key=…
    POST   /api/v1/cases/{case_id}/checklist/comments    body: {item_key, content}
"""

import asyncio
from fastapi.responses import JSONResponse

import auth
import db
from db.feature_gates import require_feature_for_case, FEATURE_DOCUMENTS, FeatureDisabled
from .common import api_error, feature_disabled_error
from .comments import _get_db_user_id
from .sse import broadcast


def register_checklist_routes(mcp):

    @mcp.custom_route("/api/v1/cases/{case_id}/checklist", methods=["GET"])
    async def api_get_checklist(request):
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        data = await asyncio.to_thread(db.get_checklist, case_id)
        return JSONResponse(data)

    @mcp.custom_route("/api/v1/cases/{case_id}/checklist/item", methods=["PUT"])
    async def api_set_checklist_item(request):
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        user = auth.get_current_user(request)

        try:
            body = await request.json()
        except Exception:
            return api_error("Invalid JSON body", "VALIDATION_ERROR", 400)
        item_key = body.get("item_key")
        if not item_key:
            return api_error("item_key is required", "VALIDATION_ERROR", 400)

        try:
            await asyncio.to_thread(_require_documents, case_id)
        except FeatureDisabled as e:
            return feature_disabled_error(e)

        result = await asyncio.to_thread(
            db.set_checklist_item,
            case_id,
            item_key,
            status=body.get("status"),
            notes=body.get("notes"),
            user_id=_get_db_user_id(user),
        )
        if result is None:
            return api_error("Unknown checklist item or status", "VALIDATION_ERROR", 400)
        broadcast({"entity": "checklist", "action": "updated", "case_id": case_id})
        return JSONResponse({"item": result})

    @mcp.custom_route("/api/v1/cases/{case_id}/checklist/custom", methods=["POST"])
    async def api_add_custom_checklist_item(request):
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])

        try:
            body = await request.json()
        except Exception:
            return api_error("Invalid JSON body", "VALIDATION_ERROR", 400)
        label = (body.get("label") or "").strip()
        if not label:
            return api_error("label is required", "VALIDATION_ERROR", 400)

        try:
            await asyncio.to_thread(_require_documents, case_id)
        except FeatureDisabled as e:
            return feature_disabled_error(e)

        result = await asyncio.to_thread(db.add_checklist_custom_item, case_id, label)
        broadcast({"entity": "checklist", "action": "updated", "case_id": case_id})
        return JSONResponse({"item": result})

    @mcp.custom_route("/api/v1/cases/{case_id}/checklist/item", methods=["DELETE"])
    async def api_delete_checklist_item(request):
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        item_key = request.query_params.get("key")
        if not item_key:
            return api_error("key query param is required", "VALIDATION_ERROR", 400)

        try:
            await asyncio.to_thread(_require_documents, case_id)
        except FeatureDisabled as e:
            return feature_disabled_error(e)

        ok = await asyncio.to_thread(db.delete_checklist_item, case_id, item_key)
        broadcast({"entity": "checklist", "action": "updated", "case_id": case_id})
        return JSONResponse({"success": ok})

    @mcp.custom_route("/api/v1/cases/{case_id}/checklist/comments", methods=["GET"])
    async def api_get_checklist_comments(request):
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        item_key = request.query_params.get("key")
        if not item_key:
            return api_error("key query param is required", "VALIDATION_ERROR", 400)
        comments = await asyncio.to_thread(db.get_checklist_item_comments, case_id, item_key)
        return JSONResponse({"comments": comments})

    @mcp.custom_route("/api/v1/cases/{case_id}/checklist/comments", methods=["POST"])
    async def api_add_checklist_comment(request):
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        user = auth.get_current_user(request)
        if not user:
            return api_error("User not found", "UNAUTHORIZED", 401)

        try:
            body = await request.json()
        except Exception:
            return api_error("Invalid JSON body", "VALIDATION_ERROR", 400)
        item_key = body.get("item_key")
        content = (body.get("content") or "").strip()
        if not item_key or not content:
            return api_error("item_key and content are required", "VALIDATION_ERROR", 400)

        try:
            await asyncio.to_thread(_require_documents, case_id)
        except FeatureDisabled as e:
            return feature_disabled_error(e)

        comment = await asyncio.to_thread(
            db.add_checklist_item_comment, case_id, item_key, _get_db_user_id(user), content
        )
        if comment is None:
            return api_error("Unknown checklist item", "VALIDATION_ERROR", 400)
        broadcast({"entity": "checklist", "action": "commented", "case_id": case_id})
        return JSONResponse({"comment": comment})


def _require_documents(case_id: int) -> None:
    """Raise FeatureDisabled if the Documents section is off for this case."""
    from db.session import SessionLocal

    with SessionLocal() as session:
        require_feature_for_case(session, case_id, FEATURE_DOCUMENTS)
