"""
Intake export routes (PDF).
"""

import asyncio
import traceback
import logging
from datetime import datetime
from lib.tz import LA
from fastapi.responses import Response
import auth
from services.intake_pdf_generator import generate_intake_list_pdf, generate_intake_detail_pdf, generate_intake_batch_pdf
from routes.common import api_error

logger = logging.getLogger(__name__)


def register_export_routes(router):
    """Register intake export routes."""

    @router.custom_route("/api/v1/intakes/export", methods=["GET"])
    async def api_export_intakes(request):
        """Export intake list as PDF."""
        if err := auth.require_auth(request):
            return err

        from db.intakes import get_intakes

        status = request.query_params.get("status")
        exclude_archived = status is None
        data = await asyncio.to_thread(
            get_intakes, status=status, limit=5000, exclude_archived=exclude_archived
        )
        intakes = data.get("intakes", [])

        try:
            pdf_buf = await asyncio.to_thread(generate_intake_list_pdf, intakes, status)
        except Exception as e:
            logger.error("Intake PDF generation failed:\n%s", traceback.format_exc())
            return api_error(f"PDF generation failed: {e}", "EXPORT_ERROR", 500)

        timestamp = datetime.now(LA).strftime("%Y%m%d_%H%M%S")
        filename = f"galipo_intakes_{timestamp}.pdf"
        return Response(
            content=pdf_buf.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    @router.custom_route("/api/v1/intakes/{intake_id}/export", methods=["GET"])
    async def api_export_intake_detail(request):
        """Export a single intake as PDF."""
        if err := auth.require_auth(request):
            return err

        from db.intakes import get_intake_by_id
        from db.intake_comments import get_intake_comments

        intake_id = int(request.path_params["intake_id"])
        intake = await asyncio.to_thread(get_intake_by_id, intake_id)
        if not intake:
            return api_error("Intake not found", "NOT_FOUND", 404)

        comments = await asyncio.to_thread(get_intake_comments, intake_id)

        try:
            pdf_buf = await asyncio.to_thread(generate_intake_detail_pdf, intake, comments)
        except Exception as e:
            logger.error("Intake detail PDF failed:\n%s", traceback.format_exc())
            return api_error(f"PDF generation failed: {e}", "EXPORT_ERROR", 500)

        name_slug = (intake.get("name") or "intake").replace(" ", "_")[:30]
        timestamp = datetime.now(LA).strftime("%Y%m%d_%H%M%S")
        filename = f"{name_slug}_{timestamp}.pdf"
        return Response(
            content=pdf_buf.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    @router.custom_route("/api/v1/intakes/export/batch", methods=["POST"])
    async def api_export_intakes_batch(request):
        """Export multiple intakes as a single PDF, one per page."""
        if err := auth.require_auth(request):
            return err

        from db.intakes import get_intake_by_id
        from db.intake_comments import get_intake_comments

        try:
            body = await request.json()
        except Exception:
            return api_error("Invalid JSON body", "INVALID_INPUT", 400)

        ids = body.get("ids", [])
        if not ids or not isinstance(ids, list):
            return api_error("ids must be a non-empty list", "INVALID_INPUT", 400)

        intakes_with_comments = []
        for intake_id in ids:
            intake = await asyncio.to_thread(get_intake_by_id, int(intake_id))
            if intake:
                comments = await asyncio.to_thread(get_intake_comments, int(intake_id))
                intakes_with_comments.append((intake, comments))

        if not intakes_with_comments:
            return api_error("No intakes found for the given IDs", "NOT_FOUND", 404)

        try:
            pdf_buf = await asyncio.to_thread(generate_intake_batch_pdf, intakes_with_comments)
        except Exception as e:
            logger.error("Batch intake PDF failed:\n%s", traceback.format_exc())
            return api_error(f"PDF generation failed: {e}", "EXPORT_ERROR", 500)

        timestamp = datetime.now(LA).strftime("%Y%m%d_%H%M%S")
        filename = f"galipo_intakes_batch_{timestamp}.pdf"
        return Response(
            content=pdf_buf.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
