"""
Templates routes for PDF upload and case info extraction.

Provides endpoints for:
- Uploading PDF documents and extracting case information using AI
- TOA (Table of Authorities) extraction and generation
"""

import asyncio
import json
import logging
from fastapi.responses import JSONResponse, StreamingResponse

import auth
from db.users import get_user_by_id
from services.pdf_extractor import extract_text_from_pdf
from services.case_extractor import extract_case_info, improve_document_name, generate_filename
from services.pleading_generator import context_from_case_info, generate_pleading
from services.toa_extractor import extract_authorities
from services.toa_generator import generate_toa
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

    @mcp.custom_route("/api/v1/templates/improve-name", methods=["POST"])
    async def api_improve_document_name(request):
        """
        Improve/clean up a document name based on user input and context.

        Accepts JSON with:
        - user_input: What the user has typed (may be empty)
        - motion_title: The title of the uploaded document

        Returns improved document_name.
        """
        if err := auth.require_auth(request):
            return err

        try:
            data = await request.json()
        except Exception as e:
            _logger.error(f"Failed to parse JSON: {e}")
            return api_error("Invalid JSON", "INVALID_REQUEST", 400)

        user_input = data.get("user_input", "")
        motion_title = data.get("motion_title", "")

        try:
            result = await asyncio.to_thread(improve_document_name, user_input, motion_title)
        except Exception as e:
            _logger.error(f"Failed to improve document name: {e}")
            return api_error("Failed to improve document name", "IMPROVE_ERROR", 500)

        return JSONResponse({
            "success": True,
            "document_name": result["document_name"],
            "sections": result["sections"],
        })

    @mcp.custom_route("/api/v1/templates/generate-filename", methods=["POST"])
    async def api_generate_filename(request):
        """
        Generate a filename from a document name.

        Accepts JSON with:
        - document_name: The formal document title

        Returns generated filename.
        """
        if err := auth.require_auth(request):
            return err

        try:
            data = await request.json()
        except Exception as e:
            _logger.error(f"Failed to parse JSON: {e}")
            return api_error("Invalid JSON", "INVALID_REQUEST", 400)

        document_name = data.get("document_name", "")
        if not document_name:
            return api_error("document_name is required", "MISSING_FIELD", 400)

        try:
            filename = await asyncio.to_thread(generate_filename, document_name)
        except Exception as e:
            _logger.error(f"Failed to generate filename: {e}")
            return api_error("Failed to generate filename", "GENERATE_ERROR", 500)

        return JSONResponse({
            "success": True,
            "filename": filename,
        })

    @mcp.custom_route("/api/v1/templates/generate-document", methods=["POST"])
    async def api_generate_document(request):
        """
        Generate a pleading document from case info.

        Accepts JSON with:
        - case_info: Dict with court, case_number, plaintiffs, etc.
        - signing_attorney: Dict with name, bar_number, email
        - document_name: Title for the document being created
        - filename: Desired filename for download

        Returns the generated .docx file.
        """
        if err := auth.require_auth(request):
            return err

        try:
            data = await request.json()
        except Exception as e:
            _logger.error(f"Failed to parse JSON: {e}")
            return api_error("Invalid JSON", "INVALID_REQUEST", 400)

        case_info = data.get("case_info", {})
        signing_attorney = data.get("signing_attorney", {})
        document_name = data.get("document_name", "")
        filename = data.get("filename", "document.docx")
        sections = data.get("sections", [])  # List of section keys to include

        # Ensure filename has .docx extension
        if not filename.lower().endswith(".docx"):
            filename += ".docx"

        try:
            # Create context from the form data
            ctx = context_from_case_info(case_info, signing_attorney, document_name)

            # Override section flags based on user selection
            ctx.include_notice = "notice" in sections
            ctx.include_meet_confer = "meet_confer" in sections
            ctx.include_toc = "toc" in sections
            ctx.include_toa = "toa" in sections
            ctx.include_memo = "memo" in sections
            ctx.include_declaration = "declaration" in sections
            ctx.include_joint_stip = "joint_stip" in sections
            ctx.include_generic = "generic" in sections
            ctx.include_cert_compliance = "cert_compliance" in sections

            # Generate the document
            doc_buffer = await asyncio.to_thread(generate_pleading, ctx)

        except FileNotFoundError as e:
            _logger.error(f"Template not found: {e}")
            return api_error("Template not found", "TEMPLATE_ERROR", 500)
        except Exception as e:
            _logger.error(f"Failed to generate document: {e}")
            return api_error("Failed to generate document", "GENERATE_ERROR", 500)

        # Return as downloadable file
        return StreamingResponse(
            doc_buffer,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )

    # --- TOA (Table of Authorities) endpoints ---

    @mcp.custom_route("/api/v1/toa/extract", methods=["POST"])
    async def api_toa_extract(request):
        """
        Extract legal authorities from an uploaded PDF brief.

        Accepts multipart/form-data with a PDF file.
        Uses Claude to identify all citations and return structured JSON.
        """
        if err := auth.require_auth(request):
            return err

        try:
            form = await request.form()
        except Exception as e:
            _logger.error(f"Failed to parse form data: {e}")
            return api_error("Failed to parse form data", "INVALID_REQUEST", 400)

        file = form.get("file")
        if not file:
            return api_error("No file uploaded", "MISSING_FILE", 400)

        filename = getattr(file, "filename", "")
        if not filename.lower().endswith(".pdf"):
            return api_error(
                "Only PDF files are supported", "INVALID_FILE_TYPE", 400
            )

        try:
            file_bytes = await file.read()
        except Exception as e:
            _logger.error(f"Failed to read uploaded file: {e}")
            return api_error("Failed to read uploaded file", "FILE_READ_ERROR", 400)

        if len(file_bytes) == 0:
            return api_error("Uploaded file is empty", "EMPTY_FILE", 400)

        try:
            result = await asyncio.to_thread(extract_authorities, file_bytes)
        except ValueError as e:
            _logger.warning(f"TOA extraction failed: {e}")
            return api_error(str(e), "EXTRACTION_ERROR", 400)
        except Exception as e:
            _logger.error(f"Unexpected error during TOA extraction: {e}")
            return api_error(
                "Failed to extract authorities", "EXTRACTION_ERROR", 500
            )

        return JSONResponse({
            "success": True,
            "authorities": result["authorities"],
            "page_count": result["page_count"],
        })

    @mcp.custom_route("/api/v1/toa/generate", methods=["POST"])
    async def api_toa_generate(request):
        """
        Generate a Table of Authorities .docx from extracted authorities.

        Accepts JSON with:
        - authorities: List of authority objects
        - page_offset: Integer offset to add to all page numbers (default 0)
        - filename: Desired filename for download (default "table_of_authorities.docx")
        """
        if err := auth.require_auth(request):
            return err

        try:
            data = await request.json()
        except Exception as e:
            _logger.error(f"Failed to parse JSON: {e}")
            return api_error("Invalid JSON", "INVALID_REQUEST", 400)

        authorities = data.get("authorities", [])
        page_offset = data.get("page_offset", 0)
        filename = data.get("filename", "table_of_authorities.docx")

        if not authorities:
            return api_error(
                "No authorities provided", "MISSING_AUTHORITIES", 400
            )

        if not filename.lower().endswith(".docx"):
            filename += ".docx"

        try:
            doc_buffer = await asyncio.to_thread(
                generate_toa, authorities, page_offset
            )
        except Exception as e:
            _logger.error(f"Failed to generate TOA: {e}")
            return api_error("Failed to generate TOA document", "GENERATE_ERROR", 500)

        return StreamingResponse(
            doc_buffer,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
