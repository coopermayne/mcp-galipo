"""
RFP (Request for Production) routes.

Provides endpoints for:
- Extracting case info and requests from uploaded RFP PDFs
- Analyzing requests to suggest applicable objections
- Generating formatted DOCX response documents
"""

import asyncio
import logging
from fastapi.responses import JSONResponse, StreamingResponse

import auth
from db.users import get_user_by_id
from db.objections import get_objections, get_objection_by_id
from services.pdf_extractor import extract_text_from_pdf
from services.rfp_extractor import extract_rfp_info, extract_rfp_requests, analyze_requests
from services.rfp_generator import RFPContext, RFPRequestData, generate_rfp_response
from .common import api_error

_logger = logging.getLogger("routes.rfp")


def register_rfp_routes(mcp):
    """Register RFP-related routes."""

    @mcp.custom_route("/api/v1/rfp/extract", methods=["POST"])
    async def api_rfp_extract(request):
        """
        Extract case info and requests from an uploaded RFP PDF.

        Accepts multipart/form-data with a PDF file.
        Returns case_info, requests, and signing_attorney.
        """
        if err := auth.require_auth(request):
            return err

        # Get current user for signing attorney info
        user = auth.get_current_user(request)
        if not user:
            return api_error("Failed to get user info", "USER_ERROR", 500)

        full_user = await asyncio.to_thread(get_user_by_id, user["id"])
        if not full_user:
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

        # Parse multipart form
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
            return api_error("Only PDF files are supported", "INVALID_FILE_TYPE", 400)

        try:
            file_bytes = await file.read()
        except Exception as e:
            _logger.error(f"Failed to read uploaded file: {e}")
            return api_error("Failed to read uploaded file", "FILE_READ_ERROR", 400)

        if len(file_bytes) == 0:
            return api_error("Uploaded file is empty", "EMPTY_FILE", 400)

        # Extract text — first 2 pages for info, full doc for requests
        try:
            header_text = await asyncio.to_thread(extract_text_from_pdf, file_bytes, 2)
            full_text = await asyncio.to_thread(extract_text_from_pdf, file_bytes, 30)
        except ValueError as e:
            _logger.warning(f"PDF extraction failed: {e}")
            return api_error(str(e), "PDF_EXTRACTION_ERROR", 400)

        # Extract info and requests in parallel
        try:
            case_info, requests = await asyncio.gather(
                asyncio.to_thread(extract_rfp_info, header_text),
                asyncio.to_thread(extract_rfp_requests, full_text),
            )
        except ValueError as e:
            _logger.warning(f"RFP extraction failed: {e}")
            return api_error(str(e), "EXTRACTION_ERROR", 500)
        except Exception as e:
            _logger.error(f"Unexpected error during RFP extraction: {e}")
            return api_error("Failed to extract RFP information", "EXTRACTION_ERROR", 500)

        return JSONResponse({
            "success": True,
            "case_info": case_info,
            "requests": requests,
            "signing_attorney": signing_attorney,
        })

    @mcp.custom_route("/api/v1/rfp/analyze", methods=["POST"])
    async def api_rfp_analyze(request):
        """
        Analyze RFP requests and suggest applicable objections.

        Accepts JSON: {requests: [{number, text}]}
        Returns {analyses: {req_number: {objections: [short_names]}}}
        """
        if err := auth.require_auth(request):
            return err

        try:
            data = await request.json()
        except Exception as e:
            _logger.error(f"Failed to parse JSON: {e}")
            return api_error("Invalid JSON", "INVALID_REQUEST", 400)

        requests_data = data.get("requests", [])
        if not requests_data:
            return api_error("requests array is required", "VALIDATION_ERROR", 400)

        # Fetch available objections from DB
        objections = await asyncio.to_thread(get_objections)

        try:
            analyses = await asyncio.to_thread(analyze_requests, requests_data, objections)
        except ValueError as e:
            _logger.warning(f"Analysis failed: {e}")
            return api_error(str(e), "ANALYSIS_ERROR", 500)
        except Exception as e:
            _logger.error(f"Unexpected error during analysis: {e}")
            return api_error("Failed to analyze requests", "ANALYSIS_ERROR", 500)

        return JSONResponse({
            "success": True,
            "analyses": analyses,
        })

    @mcp.custom_route("/api/v1/rfp/generate", methods=["POST"])
    async def api_rfp_generate(request):
        """
        Generate an RFP response DOCX document.

        Accepts JSON with case_info, requests (with selected objection IDs),
        signing_attorney, and filename.
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
        requests_data = data.get("requests", [])
        signing_attorney = data.get("signing_attorney", {})
        filename = data.get("filename", "rfp_response.docx")

        if not filename.lower().endswith(".docx"):
            filename += ".docx"

        # Fetch objection formal language for selected IDs
        all_objections = await asyncio.to_thread(get_objections)
        objection_map = {o["id"]: o for o in all_objections}
        # Also index by short_name for flexibility
        objection_by_short_name = {o["short_name"]: o for o in all_objections}

        # Build request data
        rfp_requests = []
        for req in requests_data:
            selected_ids = req.get("objection_ids", [])
            selected_short_names = req.get("objection_short_names", [])

            # Resolve objection formal language
            formal_texts = []
            for oid in selected_ids:
                obj = objection_map.get(oid)
                if obj:
                    formal_texts.append(obj["formal_language"])
            for sn in selected_short_names:
                obj = objection_by_short_name.get(sn)
                if obj and obj["formal_language"] not in formal_texts:
                    formal_texts.append(obj["formal_language"])

            rfp_requests.append(RFPRequestData(
                number=req.get("number", 0),
                text=req.get("text", ""),
                objections=formal_texts,
                will_produce=req.get("will_produce", False),
                withheld_on_objections=req.get("withheld_on_objections", False),
            ))

        responding_party = case_info.get("responding_party", "Responding Party")

        ctx = RFPContext(
            court_name=case_info.get("court_name", ""),
            case_no=case_info.get("case_no", ""),
            header_plaintiffs=case_info.get("header_plaintiffs", ""),
            header_defendants=case_info.get("header_defendants", ""),
            multiple_plaintiffs=case_info.get("multiple_plaintiffs", False),
            multiple_defendants=case_info.get("multiple_defendants", False),
            propounding_party=case_info.get("propounding_party", ""),
            responding_party=responding_party,
            set_number=case_info.get("set_number", "One"),
            document_title=case_info.get("document_title", ""),
            associate_name=signing_attorney.get("name", ""),
            associate_bar=signing_attorney.get("bar_number", ""),
            associate_email=signing_attorney.get("email", ""),
            requests=rfp_requests,
        )

        try:
            doc_buffer = await asyncio.to_thread(generate_rfp_response, ctx)
        except FileNotFoundError as e:
            _logger.error(f"Template not found: {e}")
            return api_error("RFP template not found", "TEMPLATE_ERROR", 500)
        except Exception as e:
            _logger.error(f"Failed to generate document: {e}")
            return api_error("Failed to generate document", "GENERATE_ERROR", 500)

        return StreamingResponse(
            doc_buffer,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
