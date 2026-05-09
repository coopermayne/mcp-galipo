"""Invoice API routes — CRUD, file upload, AI extraction, file serving."""

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
from schemas import CreateInvoiceInput, UpdateInvoiceInput, MarkInvoicePaidInput
from .common import api_error, pydantic_error, DEFAULT_PAGE_SIZE

logger = logging.getLogger(__name__)

ALLOWED_TYPES = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}


def register_invoice_routes(mcp):

    @mcp.custom_route("/api/v1/invoices", methods=["GET"])
    async def api_list_invoices(request):
        if err := auth.require_auth(request):
            return err
        case_id = request.query_params.get("case_id")
        status = request.query_params.get("status")
        search = request.query_params.get("search")
        sort_by = request.query_params.get("sort_by", "due_date")
        sort_dir = request.query_params.get("sort_dir", "asc")
        limit = int(request.query_params.get("limit", str(DEFAULT_PAGE_SIZE)))
        offset = int(request.query_params.get("offset", "0"))

        result = await asyncio.to_thread(
            db.list_invoices,
            case_id=int(case_id) if case_id else None,
            status=status,
            search=search,
            sort_by=sort_by,
            sort_dir=sort_dir,
            limit=limit,
            offset=offset,
        )
        return JSONResponse(result)

    @mcp.custom_route("/api/v1/invoices/stats", methods=["GET"])
    async def api_invoice_stats(request):
        if err := auth.require_auth(request):
            return err
        case_id = request.query_params.get("case_id")
        stats = await asyncio.to_thread(
            db.get_invoice_stats,
            case_id=int(case_id) if case_id else None,
        )
        return JSONResponse(stats)

    @mcp.custom_route("/api/v1/invoices/upload", methods=["POST"])
    async def api_upload_invoice(request):
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

        upload_dir = Path(settings.media_dir) / "invoices" / str(case_id)
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

    @mcp.custom_route("/api/v1/invoices/extract", methods=["POST"])
    async def api_extract_invoice(request):
        if err := auth.require_auth(request):
            return err

        body = await request.json()
        file_path = body.get("file_path")
        content_type = body.get("content_type", "application/pdf")

        if not file_path or not os.path.isfile(file_path):
            return api_error("File not found", "NOT_FOUND", 404)

        try:
            from services.invoice_extractor import extract_invoice
            result = await asyncio.to_thread(extract_invoice, file_path, content_type)
            return JSONResponse({"success": True, "extracted": result})
        except Exception as e:
            logger.error(f"Invoice extraction failed: {e}")
            return api_error(f"Extraction failed: {str(e)}", "EXTRACTION_ERROR", 500)

    @mcp.custom_route("/api/v1/invoices/{invoice_id}", methods=["GET"])
    async def api_get_invoice(request):
        if err := auth.require_auth(request):
            return err
        invoice_id = int(request.path_params["invoice_id"])
        invoice = await asyncio.to_thread(db.get_invoice, invoice_id)
        if not invoice:
            return api_error("Invoice not found", "NOT_FOUND", 404)
        return JSONResponse(invoice)

    @mcp.custom_route("/api/v1/invoices", methods=["POST"])
    async def api_create_invoice(request):
        if err := auth.require_auth(request):
            return err
        try:
            data = CreateInvoiceInput(**(await request.json()))
        except ValidationError as e:
            return pydantic_error(e)

        result = await asyncio.to_thread(
            db.create_invoice,
            data.case_id,
            data.amount,
            **data.model_dump(exclude={"case_id", "amount"}, exclude_none=True),
        )
        return JSONResponse({"success": True, "invoice": result})

    @mcp.custom_route("/api/v1/invoices/{invoice_id}", methods=["PUT"])
    async def api_update_invoice(request):
        if err := auth.require_auth(request):
            return err
        invoice_id = int(request.path_params["invoice_id"])
        try:
            data = UpdateInvoiceInput(**(await request.json()))
        except ValidationError as e:
            return pydantic_error(e)

        updates = data.model_dump(exclude_none=True)
        result = await asyncio.to_thread(db.update_invoice, invoice_id, **updates)
        if not result:
            return api_error("Invoice not found", "NOT_FOUND", 404)
        return JSONResponse({"success": True, "invoice": result})

    @mcp.custom_route("/api/v1/invoices/{invoice_id}/pay", methods=["POST"])
    async def api_mark_paid(request):
        if err := auth.require_auth(request):
            return err
        invoice_id = int(request.path_params["invoice_id"])
        try:
            data = MarkInvoicePaidInput(**(await request.json()))
        except ValidationError as e:
            return pydantic_error(e)

        result = await asyncio.to_thread(
            db.mark_invoice_paid,
            invoice_id,
            check_number=data.check_number,
            paid_date=data.paid_date,
        )
        if not result:
            return api_error("Invoice not found", "NOT_FOUND", 404)
        return JSONResponse({"success": True, "invoice": result})

    @mcp.custom_route("/api/v1/invoices/{invoice_id}/unpay", methods=["POST"])
    async def api_mark_unpaid(request):
        if err := auth.require_auth(request):
            return err
        invoice_id = int(request.path_params["invoice_id"])
        result = await asyncio.to_thread(db.mark_invoice_unpaid, invoice_id)
        if not result:
            return api_error("Invoice not found", "NOT_FOUND", 404)
        return JSONResponse({"success": True, "invoice": result})

    @mcp.custom_route("/api/v1/invoices/{invoice_id}", methods=["DELETE"])
    async def api_delete_invoice(request):
        if err := auth.require_auth(request):
            return err
        invoice_id = int(request.path_params["invoice_id"])
        deleted = await asyncio.to_thread(db.delete_invoice, invoice_id)
        if deleted:
            return JSONResponse({"success": True})
        return api_error("Invoice not found", "NOT_FOUND", 404)

    @mcp.custom_route("/api/v1/invoices/{invoice_id}/file", methods=["GET"])
    async def api_serve_invoice_file(request):
        if token_param := request.query_params.get("token"):
            if not auth.validate_session(token_param):
                return api_error("Invalid token", "UNAUTHORIZED", 401)
        elif err := auth.require_auth(request):
            return err

        invoice_id = int(request.path_params["invoice_id"])
        invoice = await asyncio.to_thread(db.get_invoice, invoice_id)

        if not invoice or not invoice.get("file_path"):
            return api_error("File not found", "NOT_FOUND", 404)

        local_path = invoice["file_path"]
        if not os.path.isfile(local_path):
            return api_error("File not found on disk", "NOT_FOUND", 404)

        return FileResponse(
            local_path,
            media_type=invoice.get("content_type", "application/octet-stream"),
            filename=invoice.get("file_name"),
            headers={"Cache-Control": "private, max-age=86400"},
        )
