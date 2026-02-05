"""
Templates routes for PDF upload and case info extraction.

Provides endpoints for:
- Uploading PDF documents and extracting case information using AI
"""

import asyncio
import logging
from fastapi.responses import JSONResponse

import auth
from db.users import get_user_by_id
from services.pdf_extractor import extract_text_from_pdf
from services.case_extractor import extract_case_info, suggest_document_names
from .common import api_error

_logger = logging.getLogger("routes.templates")


def register_template_routes(mcp):
    """Register template-related routes."""

    @mcp.custom_route("/api/v1/templates/extract", methods=["POST"])
    async def api_extract_case_info(request):
        """
        Extract case information from an uploaded PDF.

        Accepts multipart/form-data with a PDF file.
        Uses AI to extract structured case information from the first 2 pages.

        Returns:
            - case_info: Extracted and editable case information
            - signing_attorney: Current user's info for document signing
        """
        if err := auth.require_auth(request):
            return err

        # Get the current user for signing attorney info
        user = auth.get_current_user(request)
        if not user:
            return api_error("Failed to get user info", "USER_ERROR", 500)

        # Fetch full user info including bar_number
        full_user = await asyncio.to_thread(get_user_by_id, user["id"])
        if not full_user:
            # Fallback for legacy env var users
            signing_attorney = {
                "name": f"{user.get('firstName', '')} {user.get('lastName', '')}".strip() or "Unknown",
                "bar_number": None,
                "email": user.get("email", ""),
            }
        else:
            signing_attorney = {
                "name": f"{full_user.get('first_name', '')} {full_user.get('last_name', '')}".strip(),
                "bar_number": full_user.get("bar_number"),
                "email": full_user.get("email", ""),
            }

        # Parse multipart form data
        try:
            form = await request.form()
        except Exception as e:
            _logger.error(f"Failed to parse form data: {e}")
            return api_error("Failed to parse form data", "INVALID_REQUEST", 400)

        # Get the uploaded file
        file = form.get("file")
        if not file:
            return api_error("No file uploaded", "MISSING_FILE", 400)

        # Validate file type
        filename = getattr(file, "filename", "")
        if not filename.lower().endswith(".pdf"):
            return api_error("Only PDF files are supported", "INVALID_FILE_TYPE", 400)

        # Read file content
        try:
            file_bytes = await file.read()
        except Exception as e:
            _logger.error(f"Failed to read uploaded file: {e}")
            return api_error("Failed to read uploaded file", "FILE_READ_ERROR", 400)

        if len(file_bytes) == 0:
            return api_error("Uploaded file is empty", "EMPTY_FILE", 400)

        # Extract text from PDF
        try:
            text = await asyncio.to_thread(extract_text_from_pdf, file_bytes)
        except ValueError as e:
            _logger.warning(f"PDF extraction failed: {e}")
            return api_error(str(e), "PDF_EXTRACTION_ERROR", 400)

        # Extract case info using AI
        try:
            case_info = await asyncio.to_thread(extract_case_info, text)
        except ValueError as e:
            _logger.warning(f"Case info extraction failed: {e}")
            return api_error(str(e), "EXTRACTION_ERROR", 500)
        except Exception as e:
            _logger.error(f"Unexpected error during case info extraction: {e}")
            return api_error("Failed to extract case information", "EXTRACTION_ERROR", 500)

        return JSONResponse({
            "success": True,
            "case_info": case_info,
            "signing_attorney": signing_attorney,
        })

    @mcp.custom_route("/api/v1/templates/suggest-names", methods=["POST"])
    async def api_suggest_document_names(request):
        """
        Suggest document name and filename based on case information.

        Accepts JSON with case_info fields.
        Returns suggested document_name and filename.
        """
        if err := auth.require_auth(request):
            return err

        try:
            data = await request.json()
        except Exception as e:
            _logger.error(f"Failed to parse JSON: {e}")
            return api_error("Invalid JSON", "INVALID_REQUEST", 400)

        case_info = data.get("case_info", {})

        try:
            suggestions = await asyncio.to_thread(suggest_document_names, case_info)
        except Exception as e:
            _logger.error(f"Failed to generate suggestions: {e}")
            return api_error("Failed to generate suggestions", "SUGGESTION_ERROR", 500)

        return JSONResponse({
            "success": True,
            **suggestions,
        })
