"""Lien API routes — CRUD, file upload, file serving."""

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
from schemas import CreateLienInput, UpdateLienInput
from .common import api_error, pydantic_error, DEFAULT_PAGE_SIZE

logger = logging.getLogger(__name__)

ALLOWED_TYPES = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}


def register_lien_routes(mcp):

    @mcp.custom_route("/api/v1/liens", methods=["GET"])
    async def api_list_liens(request):
        if err := auth.require_auth(request):
            return err
        case_id = request.query_params.get("case_id")
        status = request.query_params.get("status")
        search = request.query_params.get("search")
        sort_by = request.query_params.get("sort_by", "date")
        sort_dir = request.query_params.get("sort_dir", "desc")
        limit = int(request.query_params.get("limit", str(DEFAULT_PAGE_SIZE)))
        offset = int(request.query_params.get("offset", "0"))

        result = await asyncio.to_thread(
            db.list_liens,
            case_id=int(case_id) if case_id else None,
            status=status,
            search=search,
            sort_by=sort_by,
            sort_dir=sort_dir,
            limit=limit,
            offset=offset,
        )
        return JSONResponse(result)

    @mcp.custom_route("/api/v1/liens/stats", methods=["GET"])
    async def api_lien_stats(request):
        if err := auth.require_auth(request):
            return err
        case_id = request.query_params.get("case_id")
        if not case_id:
            return api_error("case_id is required", "VALIDATION_ERROR", 400)
        stats = await asyncio.to_thread(
            db.get_lien_stats,
            case_id=int(case_id),
        )
        return JSONResponse(stats)

    @mcp.custom_route("/api/v1/liens/upload", methods=["POST"])
    async def api_upload_lien_file(request):
        if err := auth.require_auth(request):
            return err

        form = await request.form()
        file = form.get("file")
        case_id = form.get("case_id")

        if not file or not case_id:
            return api_error("file and case_id are required", "VALIDATION_ERROR", 400)

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

        upload_dir = Path(settings.media_dir) / "liens" / str(case_id)
        upload_dir.mkdir(parents=True, exist_ok=True)

        stored_name = f"{uuid.uuid4().hex}{ext}"
        stored_path = upload_dir / stored_name

        with open(stored_path, "wb") as f:
            f.write(file_bytes)

        return JSONResponse({
            "file_path": str(stored_path),
            "file_name": filename,
            "content_type": ALLOWED_TYPES[ext],
        })

    @mcp.custom_route("/api/v1/liens/{lien_id}", methods=["GET"])
    async def api_get_lien(request):
        if err := auth.require_auth(request):
            return err
        lien_id = int(request.path_params["lien_id"])
        lien = await asyncio.to_thread(db.get_lien, lien_id)
        if not lien:
            return api_error("Lien not found", "NOT_FOUND", 404)
        return JSONResponse(lien)

    @mcp.custom_route("/api/v1/liens", methods=["POST"])
    async def api_create_lien(request):
        if err := auth.require_auth(request):
            return err
        try:
            data = CreateLienInput(**(await request.json()))
        except ValidationError as e:
            return pydantic_error(e)

        result = await asyncio.to_thread(
            db.create_lien,
            data.case_id,
            data.claimed_amount,
            **data.model_dump(exclude={"case_id", "claimed_amount"}, exclude_none=True),
        )
        return JSONResponse({"success": True, "lien": result})

    @mcp.custom_route("/api/v1/liens/{lien_id}", methods=["PUT"])
    async def api_update_lien(request):
        if err := auth.require_auth(request):
            return err
        lien_id = int(request.path_params["lien_id"])
        try:
            data = UpdateLienInput(**(await request.json()))
        except ValidationError as e:
            return pydantic_error(e)

        updates = data.model_dump(exclude_unset=True)
        result = await asyncio.to_thread(db.update_lien, lien_id, **updates)
        if not result:
            return api_error("Lien not found", "NOT_FOUND", 404)
        return JSONResponse({"success": True, "lien": result})

    @mcp.custom_route("/api/v1/liens/{lien_id}", methods=["DELETE"])
    async def api_delete_lien(request):
        if err := auth.require_auth(request):
            return err
        lien_id = int(request.path_params["lien_id"])
        deleted = await asyncio.to_thread(db.delete_lien, lien_id)
        if deleted:
            return JSONResponse({"success": True})
        return api_error("Lien not found", "NOT_FOUND", 404)

    @mcp.custom_route("/api/v1/liens/{lien_id}/file-token", methods=["POST"])
    async def api_create_lien_file_token(request):
        if err := auth.require_auth(request):
            return err
        lien_id = int(request.path_params["lien_id"])
        token = auth.create_file_token(f"/liens/{lien_id}/file")
        return JSONResponse({"token": token})

    @mcp.custom_route("/api/v1/liens/{lien_id}/file", methods=["GET"])
    async def api_serve_lien_file(request):
        token_param = request.query_params.get("token")
        if token_param:
            lien_id = int(request.path_params["lien_id"])
            if not auth.validate_file_token(token_param, f"/liens/{lien_id}/file"):
                return api_error("Invalid or expired download link", "UNAUTHORIZED", 401)
        elif err := auth.require_auth(request):
            return err

        lien_id = int(request.path_params["lien_id"])
        lien = await asyncio.to_thread(db.get_lien, lien_id)

        if not lien or not lien.get("file_path"):
            return api_error("File not found", "NOT_FOUND", 404)

        local_path = os.path.realpath(lien["file_path"])
        media_root = os.path.realpath(settings.media_dir)
        if not local_path.startswith(media_root + os.sep):
            return api_error("Access denied", "FORBIDDEN", 403)

        if not os.path.isfile(local_path):
            return api_error("File not found on disk", "NOT_FOUND", 404)

        return FileResponse(
            local_path,
            media_type=lien.get("content_type", "application/octet-stream"),
            filename=lien.get("file_name", "download"),
        )
