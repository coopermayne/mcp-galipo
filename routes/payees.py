"""Payee API routes — CRUD, W9 file upload, and file serving."""

import asyncio
import logging
import os
import uuid
from pathlib import Path

from fastapi.responses import FileResponse, JSONResponse
from pydantic import ValidationError

import auth
import db
from config import settings
from schemas import CreatePayeeInput, UpdatePayeeInput
from .common import api_error, pydantic_error, DEFAULT_PAGE_SIZE

logger = logging.getLogger(__name__)

ALLOWED_TYPES = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}


def register_payee_routes(mcp):

    @mcp.custom_route("/api/v1/payees/search", methods=["GET"])
    async def api_search_payees(request):
        if err := auth.require_auth(request):
            return err
        q = request.query_params.get("q", "")
        limit = int(request.query_params.get("limit", "10"))
        results = await asyncio.to_thread(db.search_payees, q, limit)
        return JSONResponse(results)

    @mcp.custom_route("/api/v1/payees", methods=["GET"])
    async def api_list_payees(request):
        if err := auth.require_auth(request):
            return err
        search = request.query_params.get("search")
        limit = int(request.query_params.get("limit", str(DEFAULT_PAGE_SIZE)))
        offset = int(request.query_params.get("offset", "0"))

        result = await asyncio.to_thread(
            db.list_payees,
            search=search,
            limit=limit,
            offset=offset,
        )
        return JSONResponse(result)

    @mcp.custom_route("/api/v1/payees/{payee_id}", methods=["GET"])
    async def api_get_payee(request):
        if err := auth.require_auth(request):
            return err
        payee_id = int(request.path_params["payee_id"])
        payee = await asyncio.to_thread(db.get_payee, payee_id)
        if not payee:
            return api_error("Payee not found", "NOT_FOUND", 404)
        return JSONResponse(payee)

    @mcp.custom_route("/api/v1/payees", methods=["POST"])
    async def api_create_payee(request):
        if err := auth.require_auth(request):
            return err
        try:
            data = CreatePayeeInput(**(await request.json()))
        except ValidationError as e:
            return pydantic_error(e)

        result = await asyncio.to_thread(
            db.create_payee,
            data.name,
            check_name=data.check_name,
            address=data.address,
            notes=data.notes,
        )
        return JSONResponse({"success": True, "payee": result})

    @mcp.custom_route("/api/v1/payees/{payee_id}", methods=["PUT"])
    async def api_update_payee(request):
        if err := auth.require_auth(request):
            return err
        payee_id = int(request.path_params["payee_id"])
        try:
            data = UpdatePayeeInput(**(await request.json()))
        except ValidationError as e:
            return pydantic_error(e)

        updates = data.model_dump(exclude_none=True)
        result = await asyncio.to_thread(db.update_payee, payee_id, **updates)
        if not result:
            return api_error("Payee not found", "NOT_FOUND", 404)
        return JSONResponse({"success": True, "payee": result})

    @mcp.custom_route("/api/v1/payees/{payee_id}", methods=["DELETE"])
    async def api_delete_payee(request):
        if err := auth.require_auth(request):
            return err
        payee_id = int(request.path_params["payee_id"])
        deleted = await asyncio.to_thread(db.delete_payee, payee_id)
        if deleted:
            return JSONResponse({"success": True})
        return api_error("Payee not found", "NOT_FOUND", 404)

    @mcp.custom_route("/api/v1/payees/{payee_id}/w9", methods=["POST"])
    async def api_upload_w9(request):
        if err := auth.require_auth(request):
            return err
        payee_id = int(request.path_params["payee_id"])

        payee = await asyncio.to_thread(db.get_payee, payee_id)
        if not payee:
            return api_error("Payee not found", "NOT_FOUND", 404)

        form = await request.form()
        file = form.get("file")
        if not file:
            return api_error("file is required", "VALIDATION_ERROR", 400)

        filename = file.filename or "upload"
        ext = os.path.splitext(filename)[1].lower()
        if ext not in ALLOWED_TYPES:
            return api_error(
                f"File type not supported. Allowed: {', '.join(ALLOWED_TYPES.keys())}",
                "INVALID_FILE_TYPE",
                400,
            )

        file_bytes = await file.read()
        if len(file_bytes) > 20 * 1024 * 1024:
            return api_error("File too large (max 20MB)", "FILE_TOO_LARGE", 400)

        # Remove old W9 file if it exists
        if payee.get("w9_file_path") and os.path.isfile(payee["w9_file_path"]):
            try:
                os.remove(payee["w9_file_path"])
            except OSError:
                pass

        upload_dir = Path(settings.media_dir) / "payees" / str(payee_id)
        upload_dir.mkdir(parents=True, exist_ok=True)

        stored_name = f"w9_{uuid.uuid4().hex}{ext}"
        stored_path = upload_dir / stored_name

        with open(stored_path, "wb") as f:
            f.write(file_bytes)

        w9_year = form.get("w9_year")
        w9_year_int = int(w9_year) if w9_year else None

        result = await asyncio.to_thread(
            db.update_payee,
            payee_id,
            w9_file_path=str(stored_path),
            w9_file_name=filename,
            w9_year=w9_year_int,
        )
        return JSONResponse({"success": True, "payee": result})

    @mcp.custom_route("/api/v1/payees/{payee_id}/w9", methods=["GET"])
    async def api_serve_w9(request):
        if token_param := request.query_params.get("token"):
            if not auth.validate_session(token_param):
                return api_error("Invalid token", "UNAUTHORIZED", 401)
        elif err := auth.require_auth(request):
            return err

        payee_id = int(request.path_params["payee_id"])
        payee = await asyncio.to_thread(db.get_payee, payee_id)

        if not payee or not payee.get("w9_file_path"):
            return api_error("File not found", "NOT_FOUND", 404)

        local_path = payee["w9_file_path"]
        if not os.path.isfile(local_path):
            return api_error("File not found on disk", "NOT_FOUND", 404)

        ext = os.path.splitext(local_path)[1].lower()
        content_type = ALLOWED_TYPES.get(ext, "application/octet-stream")

        return FileResponse(
            local_path,
            media_type=content_type,
            filename=payee.get("w9_file_name"),
            headers={"Cache-Control": "private, max-age=86400"},
        )
